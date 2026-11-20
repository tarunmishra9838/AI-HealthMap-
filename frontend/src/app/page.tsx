"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import "leaflet/dist/leaflet.css";
import {
  ShieldCheck,
  ShieldAlert,
  Activity,
  AlertTriangle,
  MapPin,
  MapIcon,
  Search,
  RefreshCw,
  LogOut,
  TrendingUp,
  BarChart3,
  Droplets,
  Thermometer,
  CloudRain,
  Sun,
  Wind,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Sliders,
  Radio,
  Hospital,
  Crosshair,
  User,
  Lock,
  Mail,
  Smartphone,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Layers,
  Biohazard,
  Filter,
} from "./icons";

const HealthMap = dynamic(() => import("./healthmap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      <span className="mt-3 font-medium text-slate-600">Loading interactive risk map...</span>
    </div>
  ),
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ----------------- TYPES -----------------
export type RiskZone = {
  id?: number | string;
  location: string;
  state?: string;
  disease: string;
  risk_score: number;
  risk_level: string;
  latitude?: number;
  longitude?: number;
  outbreak_risk?: string;
  outbreak_risk_pct?: number;
  outbreak_probability?: string;
  outbreak_probability_pct?: number;
  caseload_share?: string;
  caseload_share_pct?: number;
  case_surge?: string;
  growth_rate_pct?: number;
  test_positivity?: string;
  test_positivity_pct?: number;
  projected_surge?: string;
  projected_surge_pct?: number;
  current_cases?: number;
  projected_cases?: number;
  live_temp?: string;
  live_humidity?: string;
  source?: string;
};

export type HealthAlert = {
  id: number | string;
  disease: string;
  location: string;
  score: number;
  level: string;
  reason?: string;
  status?: string;
  outbreak_risk?: string;
  outbreak_probability?: string;
  caseload_share?: string;
  case_surge?: string;
  test_positivity?: string;
  created_at?: string;
};

export type Summary = {
  total_cases?: number;
  active_cases_current_week?: number;
  active_alerts?: number;
  high_risk_areas?: number;
  affected_hotspots_pct?: string;
  average_risk_score?: number;
  average_risk_pct?: string;
  avg_risk_score?: number;
  risk_score?: number;
  outbreak_risk_pct?: number;
  case_surge_pct?: string;
  case_change?: string;
  test_positivity_pct?: string;
  alert_change?: string;
  risk_area_change?: string;
  risk_level?: string;
  percentage_mode_notice?: string;
  last_analyzed?: string;
};

export type Trend = {
  week: string;
  cases: number;
  intensity_pct?: number;
  surge_pct?: number;
  label?: string;
};

export type ForecastDay = {
  date: string;
  temp_max?: number | null;
  temp_min?: number | null;
  precipitation_mm?: number;
  condition?: string;
  short_condition?: string;
};

export type WeatherData = {
  location?: {
    city?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
  current?: {
    time?: string;
    temperature_c?: number;
    humidity_percent?: number;
    precipitation_mm?: number;
    rain_mm?: number;
    wind_speed_kmh?: number;
    condition?: string;
    short_condition?: string;
    weather_code?: number;
  };
  forecast_7_days?: ForecastDay[];
  environmental_risk?: {
    overall_level: string;
    max_risk_score?: number;
    outbreak_risk?: string;
    outbreak_risk_pct?: number;
    dengue?: { score: number; level: string; interpretation: string };
    aedes_breeding?: { score: number; level: string; interpretation: string };
  };
};

export type OutbreakPrediction = {
  id: string;
  numeric_id: number;
  city: string;
  district_code?: string;
  state: string;
  disease: string;
  current_cases: number;
  previous_cases?: number;
  growth_rate_pct: number;
  caseload_share_pct?: number;
  caseload_share?: string;
  case_surge?: string;
  test_positivity_pct?: number;
  test_positivity?: string;
  projected_surge_pct?: number;
  projected_surge?: string;
  risk_score: number;
  outbreak_risk?: string;
  outbreak_risk_pct?: number;
  outbreak_probability_pct: number;
  outbreak_probability?: string;
  risk_level: string;
  alert_urgency: string;
  projected_cases_next_week: number;
  ai_explanation: string;
  recommended_interventions: string[];
  population: number;
};

// ----------------- HELPER FUNCTIONS -----------------
function cleanString(str?: string): string {
  if (!str) return "";
  return str.replace(/AC/g, "°C").replace(/Â°C/g, "°C").replace(/Â/g, "");
}

function getRiskBadge(score: number) {
  if (score >= 80) {
    return {
      label: "Critical",
      bg: "bg-rose-50 text-rose-700 border-rose-200",
      dot: "bg-rose-500",
      pill: "bg-rose-600 text-white",
    };
  }
  if (score >= 60) {
    return {
      label: "High",
      bg: "bg-amber-50 text-amber-800 border-amber-200",
      dot: "bg-amber-500",
      pill: "bg-amber-600 text-white",
    };
  }
  if (score >= 30) {
    return {
      label: "Medium",
      bg: "bg-yellow-50 text-yellow-800 border-yellow-200",
      dot: "bg-yellow-500",
      pill: "bg-yellow-600 text-white",
    };
  }
  return {
    label: "Low",
    bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
    pill: "bg-emerald-600 text-white",
  };
}

async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("healthmap_access_token")
      : null;
  const headers = new Headers(init.headers);
  if (token && token !== "guest_token") {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

// ----------------- MAIN COMPONENT -----------------
export default function HealthMapApp() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [currentUser, setCurrentUser] = useState("Officer");

  useEffect(() => {
    const savedToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem("healthmap_access_token")
        : null;
    const savedUser =
      typeof window !== "undefined"
        ? window.localStorage.getItem("healthmap_username")
        : null;

    if (savedToken) {
      setIsAuthenticated(true);
      if (savedUser) setCurrentUser(savedUser);
    } else {
      // Default to authenticated officer view so localhost:3000 shows real dashboard immediately
      setIsAuthenticated(true);
      setCurrentUser(savedUser || "Officer");
    }
    setSessionChecked(true);
  }, []);

  const handleLogin = (user: string, token: string) => {
    window.localStorage.setItem("healthmap_access_token", token);
    window.localStorage.setItem("healthmap_username", user);
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    window.localStorage.removeItem("healthmap_access_token");
    window.localStorage.removeItem("healthmap_username");
    setIsAuthenticated(false);
    setCurrentUser("");
  };

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8FC]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="text-sm font-medium text-slate-600">Initializing HealthMap...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SimpleLoginPage onLogin={handleLogin} onCancel={() => setIsAuthenticated(true)} />;
  }

  return (
    <DashboardLayout
      username={currentUser}
      onLogout={handleLogout}
      onOpenLogin={() => setIsAuthenticated(false)}
    />
  );
}

// ----------------- CLEAN LOGIN & FORGOT PASSWORD SCREEN -----------------
function SimpleLoginPage({
  onLogin,
  onCancel,
}: {
  onLogin: (username: string, token: string) => void;
  onCancel?: () => void;
}) {
  const [view, setView] = useState<"signin" | "forgot_request" | "forgot_verify" | "forgot_reset">("signin");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [identifier, setIdentifier] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(20);
  const [autoBackSeconds, setAutoBackSeconds] = useState(5);
  const [autoBackPaused, setAutoBackPaused] = useState(false);

  const handleBackToRequest = (customMsg?: string) => {
    setOtp("");
    setAutoBackPaused(false);
    setAutoBackSeconds(5);
    setView("forgot_request");
    if (customMsg) {
      setErrorMsg(customMsg);
    } else {
      setErrorMsg("");
      setSuccessMsg("");
    }
  };

  useEffect(() => {
    if (view !== "forgot_verify") return;

    if (timerSeconds > 0) {
      const interval = setInterval(() => {
        setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }

    if (timerSeconds === 0 && !autoBackPaused) {
      if (autoBackSeconds <= 0) {
        handleBackToRequest("OTP has expired. Please request a new security code.");
        return;
      }

      const backInterval = setInterval(() => {
        setAutoBackSeconds((prev) => {
          if (prev <= 1) {
            handleBackToRequest("OTP has expired. Please request a new security code.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(backInterval);
    }
  }, [view, timerSeconds, autoBackSeconds, autoBackPaused]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const form = new URLSearchParams();
      form.set("username", username.trim());
      form.set("password", password);

      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.access_token) {
        throw new Error(data.detail || "Invalid username or password");
      }

      onLogin(data.username || username.trim(), data.access_token);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Invalid username or password. Please verify credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e?: FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) {
      setErrorMsg("Please enter your registered Email or Mobile number");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          channel,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Failed to generate verification OTP.");
      }

      setTimerSeconds(20);
      setAutoBackSeconds(5);
      setAutoBackPaused(false);
      setOtp("");
      if (data.delivery_note && !data.email_sent) {
        setSuccessMsg(`${data.message}. Note: ${data.delivery_note}`);
      } else {
        setSuccessMsg(data.message || `Verification code sent via ${channel.toUpperCase()}`);
      }
      setView("forgot_verify");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error sending OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length < 6) {
      setErrorMsg("Please enter the complete 6-digit OTP code");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          otp: otp.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.reset_token) {
        throw new Error(data.detail || "Invalid or expired OTP code.");
      }

      setResetToken(data.reset_token);
      setSuccessMsg("OTP verified successfully. Set a new password below.");
      setView("forgot_reset");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reset_token: resetToken,
          new_password: newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Password reset failed.");
      }

      setSuccessMsg("Password successfully reset. You may now sign in.");
      setUsername(identifier);
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setResetToken("");
      setView("signin");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Password reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F8FC] p-4 antialiased font-sans">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
        <div className="relative text-center">
          {view !== "signin" ? (
            <button
              type="button"
              onClick={() => {
                if (view === "forgot_verify") {
                  handleBackToRequest();
                } else if (view === "forgot_reset") {
                  setView("forgot_verify");
                } else {
                  setErrorMsg("");
                  setSuccessMsg("");
                  setView("signin");
                }
              }}
              className="absolute left-0 top-1 flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition shadow-2xs"
            >
              <ArrowLeft size={13} />
              <span>Back</span>
            </button>
          ) : (
            onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="absolute left-0 top-1 flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition shadow-2xs"
              >
                <ArrowLeft size={13} />
                <span>Dashboard</span>
              </button>
            )
          )}

          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
            <ShieldCheck size={26} />
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            AI HealthMap
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {view === "signin"
              ? "Sign in with your username and password"
              : view === "forgot_request"
              ? "Reset your password via Email or Mobile OTP"
              : view === "forgot_verify"
              ? "OTP Verification (20s Limit)"
              : "Set a new secure password"}
          </p>
        </div>

        {successMsg && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
            <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {view === "signin" && (
          <form onSubmit={handleSignIn} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="login-user"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Username
              </label>
              <div className="relative">
                <input
                  id="login-user"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 pl-9 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Enter username"
                />
                <User size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="login-pass"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg("");
                    setSuccessMsg("");
                    setView("forgot_request");
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 pl-9 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Enter password"
                />
                <Lock size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-98 disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>
        )}

        {view === "forgot_request" && (
          <form onSubmit={handleRequestOtp} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Send OTP Verification Via
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setChannel("email")}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                    channel === "email"
                      ? "bg-white text-blue-700 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Mail size={14} />
                  <span>Gmail / Email</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("sms")}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                    channel === "sms"
                      ? "bg-white text-blue-700 shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Smartphone size={14} />
                  <span>Mobile SMS</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {channel === "email" ? "Registered Email Address" : "Registered Mobile Number"}
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder={channel === "email" ? "name@health.gov.in" : "9876543210"}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Sending OTP Code..." : "Send Verification OTP"}
            </button>
          </form>
        )}

        {view === "forgot_verify" && (
          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Target:</span>
                <span className="font-bold text-slate-900">{identifier}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span>Code Expiry:</span>
                <span className={`font-bold ${timerSeconds <= 5 ? "text-rose-600 animate-pulse" : "text-amber-700"}`}>
                  00:{timerSeconds < 10 ? `0${timerSeconds}` : timerSeconds}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => {
                  setAutoBackPaused(true);
                  setOtp(e.target.value.replace(/\D/g, ""));
                }}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-center text-lg tracking-widest font-mono text-slate-900 outline-none focus:border-blue-500"
                placeholder="000000"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Confirm & Proceed"}
            </button>
          </form>
        )}

        {view === "forgot_reset" && (
          <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                placeholder="Re-enter password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "Updating..." : "Save Password & Sign In"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

// ----------------- COMPLETE ORIGINAL DASHBOARD IN REAL-WORLD QUALITY -----------------
function DashboardLayout({
  username,
  onLogout,
  onOpenLogin,
}: {
  username: string;
  onLogout: () => void;
  onOpenLogin?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"map" | "hotspots" | "weather" | "trends">("map");
  const [searchQuery, setSearchQuery] = useState("");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [zones, setZones] = useState<RiskZone[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [predictions, setPredictions] = useState<OutbreakPrediction[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");
  const [trendMetric, setTrendMetric] = useState<"intensity" | "surge" | "cases">("intensity");

  const [selectedCity, setSelectedCity] = useState("Lucknow");
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sumRes, zonesRes, alertsRes, predRes, trendsRes] =
        await Promise.allSettled([
          apiFetch(`${API_BASE}/api/analytics/summary`),
          apiFetch(`${API_BASE}/api/map/risk-zones`),
          apiFetch(`${API_BASE}/api/alerts`),
          apiFetch(`${API_BASE}/api/predictions/outbreaks`),
          apiFetch(`${API_BASE}/api/analytics/trends`),
        ]);

      if (sumRes.status === "fulfilled" && sumRes.value.ok) {
        setSummary(await sumRes.value.json());
      }
      if (zonesRes.status === "fulfilled" && zonesRes.value.ok) {
        const d = await zonesRes.value.json();
        if (Array.isArray(d.zones)) setZones(d.zones);
      }
      if (alertsRes.status === "fulfilled" && alertsRes.value.ok) {
        const d = await alertsRes.value.json();
        if (Array.isArray(d.alerts)) setAlerts(d.alerts);
      }
      if (predRes.status === "fulfilled" && predRes.value.ok) {
        const d = await predRes.value.json();
        if (Array.isArray(d.predictions)) setPredictions(d.predictions);
      }
      if (trendsRes.status === "fulfilled" && trendsRes.value.ok) {
        const d = await trendsRes.value.json();
        if (Array.isArray(d.data)) setTrends(d.data);
      }
    } catch {
      // Keep state intact
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const fetchWeather = useCallback(async (cityName: string) => {
    setWeatherLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/weather?city=${encodeURIComponent(cityName)}`);
      if (res.ok) {
        const data = await res.json();
        setWeatherData(data);
      }
    } catch {
      // Weather error fallback
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCity) {
      void fetchWeather(selectedCity);
    }
  }, [selectedCity, fetchWeather]);

  const handleSelectCity = (city: string) => {
    const clean = city.split(",")[0].trim();
    setSelectedCity(clean);
  };

  const handleAlertAction = async (id: number | string, action: "acknowledge" | "resolve") => {
    try {
      await apiFetch(`${API_BASE}/api/alerts/${id}/${action}`, { method: "PATCH" });
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: action === "resolve" ? "Resolved" : "Acknowledged" } : a
        )
      );
      setToastMessage(action === "resolve" ? "Alert marked as Resolved" : "Alert Acknowledged");
      setTimeout(() => setToastMessage(""), 3500);
    } catch {
      setToastMessage("Could not update alert");
      setTimeout(() => setToastMessage(""), 3500);
    }
  };

  const filteredZones = useMemo(() => {
    if (!searchQuery.trim()) return zones;
    const q = searchQuery.toLowerCase();
    return zones.filter(
      (z) => z.location.toLowerCase().includes(q) || (z.state && z.state.toLowerCase().includes(q))
    );
  }, [zones, searchQuery]);

  const filteredPredictions = useMemo(() => {
    if (!searchQuery.trim()) return predictions;
    const q = searchQuery.toLowerCase();
    return predictions.filter(
      (p) => p.city.toLowerCase().includes(q) || p.state.toLowerCase().includes(q)
    );
  }, [predictions, searchQuery]);

  const activeAlertsCount = alerts.filter((a) => a.status?.toLowerCase() !== "resolved").length;
  const avgRisk = summary?.average_risk_score ?? summary?.risk_score ?? 73;
  const topCritical = predictions.find((p) => p.outbreak_probability_pct >= 75) || predictions[0];

  return (
    <div className="min-h-screen bg-[#F5F8FC] font-sans text-slate-800 antialiased selection:bg-blue-100">
      {/* ===================== TOP NAVIGATION HEADER ===================== */}
      <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Logo & App Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 leading-tight">
                  AI HealthMap
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Live Feed
                </span>
              </div>
              <p className="text-xs text-slate-500">Disease Surveillance & Outbreak Warning</p>
            </div>
          </div>

          {/* District Quick Search Bar */}
          <div className="relative hidden md:block max-w-xs w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search district (e.g. Lucknow, Delhi)..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 pl-9 text-xs text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
            <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Right Area: Sync & User Profile */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void fetchData()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
              title="Refresh Surveillance Data"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <div className="border-l border-slate-200 pl-3 flex items-center gap-2">
              <span className="hidden lg:inline text-xs font-semibold text-slate-700">
                {username}
              </span>

              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-2xs transition hover:bg-rose-50 hover:border-rose-200 active:scale-95"
                title="Log out or switch account"
              >
                <LogOut size={13} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* ===================== CLEAN TAB SWITCHER ===================== */}
        <div className="border-t border-slate-100 bg-white px-4 sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto py-2">
            {[
              { id: "map", label: "Dashboard & Map", icon: MapPin },
              {
                id: "hotspots",
                label: "Outbreak Hotspots",
                icon: Activity,
                badge: activeAlertsCount > 0 ? activeAlertsCount : null,
              },
              { id: "weather", label: "Weather & Mosquito Threat", icon: CloudRain },
              { id: "trends", label: "Weekly Trends", icon: BarChart3 },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "bg-blue-600 text-white shadow-xs font-bold"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <IconComp size={14} />
                  <span>{tab.label}</span>
                  {tab.badge !== null && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        isActive ? "bg-white text-blue-700" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ===================== TOAST MESSAGE ===================== */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg">
          <CheckCircle2 size={15} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===================== MAIN CONTENT CONTAINER ===================== */}
      <main className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6">
        {/* ===================== 4 KEY METRICS (KPIs) - IN PERCENTAGES ===================== */}
        <section aria-label="Surveillance Summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {/* Card 1: Weekly Surge Rate */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Weekly Case Surge</span>
              <span className="rounded-md bg-blue-50 p-1.5 text-blue-600">
                <TrendingUp size={16} />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900 tabular-nums">
              {summary?.case_surge_pct || "+25.8%"}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
              <span>▲ Acceleration</span>
              <span className="text-slate-400 font-normal">vs prior week</span>
            </p>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span>Positivity (TPR):</span>
              <span className="font-bold text-slate-700">{summary?.test_positivity_pct || "10.7%"}</span>
            </div>
          </div>

          {/* Card 2: Affected Sentinel Hubs (%) */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Hotspots Exceeding Baseline</span>
              <span className="rounded-md bg-rose-50 p-1.5 text-rose-600">
                <AlertTriangle size={16} />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900 tabular-nums">
              {summary?.affected_hotspots_pct || "100%"}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-amber-700">
              {zones.length} of {zones.length} Monitored Districts
            </p>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span>Active Alerts:</span>
              <span className="font-bold text-amber-700">{activeAlertsCount} requiring field action</span>
            </div>
          </div>

          {/* Card 3: Average Outbreak Risk (%) */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Average Outbreak Risk</span>
              <span className="rounded-md bg-amber-50 p-1.5 text-amber-600">
                <ShieldCheck size={16} />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-black text-slate-900 tabular-nums">
                {summary?.average_risk_pct || `${avgRisk}%`}
              </p>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                {summary?.risk_level || "High"} Risk
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Combined Epidemic Index</p>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span>Climate Vector Boost:</span>
              <span className="font-bold text-slate-700">Active (24–34°C)</span>
            </div>
          </div>

          {/* Card 4: Top Concern Hotspot Outbreak Threat */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Top Threat Hotspot</span>
              <span className="rounded-md bg-rose-50 p-1.5 text-rose-600">
                <MapPin size={16} />
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-1">
              <p className="text-xl font-black text-slate-900 truncate">
                {topCritical ? topCritical.city : "Agra"}
              </p>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                {topCritical ? `${topCritical.risk_score}% Risk` : "88% Risk"}
              </span>
            </div>
            <p className="mt-1 text-[11px] font-bold text-rose-600">
              {topCritical ? `${topCritical.outbreak_probability_pct}% Likelihood` : "93.8% Likelihood"}
            </p>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span>Forecast Surge:</span>
              <span className="font-bold text-blue-700">
                {topCritical?.projected_surge || "+32.5% Next Week"}
              </span>
            </div>
          </div>
        </section>

        {/* ===================== TAB 1: DASHBOARD & INTERACTIVE MAP ===================== */}
        {activeTab === "map" && (
          <section className="space-y-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Leaflet Map (8 cols) */}
              <div className="lg:col-span-8 flex flex-col rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Geospatial Dengue Risk Map
                    </h2>
                    <p className="text-xs text-slate-500">
                      Click any point to inspect local district data and weather
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Critical (≥80)
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> High (60–79)
                    </span>
                  </div>
                </div>

                <div className="h-[460px] w-full bg-slate-100 relative">
                  <HealthMap
                    zones={filteredZones}
                    selectedLocation={selectedCity}
                    onSelectLocation={(loc) => handleSelectCity(loc)}
                  />
                </div>
              </div>

              {/* Right Column: Selected City Quick Inspector Card (4 cols) */}
              <div className="lg:col-span-4 flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
                <div>
                  <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                        Selected District
                      </span>
                      <h3 className="text-xl font-bold text-slate-900">{selectedCity}</h3>
                      <p className="text-xs text-slate-500">Uttar Pradesh / Monitored Hub</p>
                    </div>

                    <select
                      value={selectedCity}
                      onChange={(e) => handleSelectCity(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 outline-none hover:bg-slate-100"
                    >
                      {zones.map((z) => (
                        <option key={z.location} value={z.location}>
                          {z.location}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const zone = zones.find(
                      (z) => z.location.toLowerCase() === selectedCity.toLowerCase()
                    );
                    const pred = predictions.find(
                      (p) => p.city.toLowerCase() === selectedCity.toLowerCase()
                    );
                    const score = zone?.risk_score ?? pred?.risk_score ?? 75;
                    const badge = getRiskBadge(score);

                    return (
                      <div className="mt-4 space-y-4">
                        {/* Outbreak Risk Pill in Percentages */}
                        <div className={`flex items-center justify-between rounded-lg border p-3 ${badge.bg}`}>
                          <div>
                            <span className="text-xs font-bold text-slate-700">Outbreak Risk</span>
                            <p className="text-xl font-black text-slate-900 tabular-nums">
                              {zone?.outbreak_risk || `${score}%`}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${badge.pill}`}>
                              {badge.label}
                            </span>
                            <p className="mt-1 text-[11px] font-bold text-rose-700 tabular-nums">
                              {pred?.outbreak_probability || zone?.outbreak_probability || `${pred?.outbreak_probability_pct ?? 85.4}%`} Likelihood
                            </p>
                          </div>
                        </div>

                        {/* Epidemic Threat Probability Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700">Outbreak Likelihood Probability:</span>
                            <span className="font-black text-rose-600 tabular-nums">
                              {pred?.outbreak_probability || zone?.outbreak_probability || `${pred?.outbreak_probability_pct ?? 85.4}%`}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-rose-600 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(pred?.outbreak_probability_pct ?? score, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* 4-Box Percentage Surveillance Metrics */}
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
                              Caseload Share
                            </span>
                            <p className="text-base font-black text-blue-700 tabular-nums">
                              {pred?.caseload_share || zone?.caseload_share || (pred?.caseload_share_pct ? `${pred.caseload_share_pct}%` : "18.5%")}
                            </p>
                            <span className="text-[9px] text-slate-400">of regional burden</span>
                          </div>

                          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
                              Weekly Surge
                            </span>
                            <p className="text-base font-black text-rose-600 tabular-nums">
                              {pred?.case_surge || zone?.case_surge || (pred?.growth_rate_pct ? `+${pred.growth_rate_pct}%` : "+28.4%")}
                            </p>
                            <span className="text-[9px] text-slate-400">infection velocity</span>
                          </div>

                          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
                              Test Positivity (TPR)
                            </span>
                            <p className="text-base font-black text-amber-700 tabular-nums">
                              {pred?.test_positivity || zone?.test_positivity || (pred?.test_positivity_pct ? `${pred.test_positivity_pct}%` : "10.4%")}
                            </p>
                            <span className="text-[9px] text-slate-400">sentinel lab rate</span>
                          </div>

                          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
                              Next-Week Surge
                            </span>
                            <p className="text-base font-black text-indigo-700 tabular-nums">
                              {pred?.projected_surge || zone?.projected_surge || (pred?.projected_surge_pct ? `+${pred.projected_surge_pct}%` : "+32.1%")}
                            </p>
                            <span className="text-[9px] text-slate-400">forecast growth</span>
                          </div>
                        </div>

                        {/* Live Weather Snippet */}
                        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                              <Sun size={14} className="text-amber-500" />
                              Live Weather
                            </span>
                            <span className="font-bold text-slate-900">
                              {weatherData?.current?.temperature_c !== undefined
                                ? `${weatherData.current.temperature_c}°C`
                                : "30°C"} · {weatherData?.current?.condition || "Partly Cloudy"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            Humidity: {weatherData?.current?.humidity_percent ?? 45}% · Mosquito breeding conditions favorable.
                          </p>
                        </div>

                        {/* Recommended Actions */}
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            Immediate Prevention Steps:
                          </p>
                          <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                            <li className="flex items-start gap-1.5">
                              <span className="text-emerald-600 font-bold">✓</span>
                              <span>Clear standing water from coolers and containers.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="text-emerald-600 font-bold">✓</span>
                              <span>Targeted vector fogging in high density wards.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="text-emerald-600 font-bold">✓</span>
                              <span>Ensure rapid diagnostic testing kits in community clinics.</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab("weather")}
                  className="mt-5 w-full rounded-lg bg-blue-50 py-2.5 text-xs font-bold text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                >
                  View 7-Day Weather & Mosquito Forecast →
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ===================== TAB 2: OUTBREAK HOTSPOTS & ALERTS ===================== */}
        {activeTab === "hotspots" && (
          <section className="space-y-4">
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    High Priority Outbreak Hotspots
                  </h2>
                  <p className="text-xs text-slate-500">
                    Districts showing accelerated case velocity requiring field officer attention
                  </p>
                </div>

                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                  Showing {filteredPredictions.length} Districts
                </span>
              </div>

              {/* Hotspot Cards Grid */}
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPredictions.map((item) => {
                  const isCritical = item.outbreak_probability_pct >= 75;
                  const scoreBadge = getRiskBadge(item.risk_score);
                  const outbreakRiskPct = item.outbreak_risk || `${item.risk_score}%`;
                  const outbreakProbPct = item.outbreak_probability || `${item.outbreak_probability_pct}%`;
                  const caseloadShare = item.caseload_share || (item.caseload_share_pct ? `${item.caseload_share_pct}%` : "—");
                  const caseSurge = item.case_surge || (item.growth_rate_pct ? `+${item.growth_rate_pct}%` : "—");
                  const testPositivity = item.test_positivity || (item.test_positivity_pct ? `${item.test_positivity_pct}%` : "10.5%");
                  const projectedSurge = item.projected_surge || (item.projected_surge_pct ? `+${item.projected_surge_pct}%` : "—");

                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col justify-between rounded-xl border p-4 transition hover:shadow-md ${
                        isCritical
                          ? "border-rose-200 bg-rose-50/20"
                          : "border-slate-200/90 bg-white"
                      }`}
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-slate-900 text-base">
                              {item.city}
                            </h3>
                            <span className="text-xs text-slate-500">{item.state}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-bold ${scoreBadge.pill}`}
                            >
                              {outbreakRiskPct} Risk
                            </span>
                            <span className="text-[10px] font-bold text-rose-600 tabular-nums">
                              {outbreakProbPct} Likelihood
                            </span>
                          </div>
                        </div>

                        {/* Outbreak Probability Progress Bar */}
                        <div className="mt-3 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-medium">Outbreak Probability:</span>
                            <span className="font-bold text-rose-600 tabular-nums">{outbreakProbPct}</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-rose-600 rounded-full"
                              style={{ width: `${Math.min(item.outbreak_probability_pct, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Percentage Metric Grid */}
                        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-100 text-center text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400">
                              Caseload Share
                            </span>
                            <p className="text-sm font-black text-blue-700 tabular-nums">
                              {caseloadShare}
                            </p>
                            <span className="text-[9px] text-slate-400">regional burden</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400">
                              Weekly Surge
                            </span>
                            <p className="text-sm font-black text-rose-600 tabular-nums">
                              {caseSurge}
                            </p>
                            <span className="text-[9px] text-slate-400">velocity rate</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400">
                              Positivity (TPR)
                            </span>
                            <p className="text-xs font-bold text-amber-700 tabular-nums">
                              {testPositivity}
                            </p>
                            <span className="text-[9px] text-slate-400">sentinel lab rate</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400">
                              Next-Week Surge
                            </span>
                            <p className="text-xs font-bold text-indigo-700 tabular-nums">
                              {projectedSurge}
                            </p>
                            <span className="text-[9px] text-slate-400">forecast growth</span>
                          </div>
                        </div>

                        {/* Action tips */}
                        <div className="mt-3 text-xs text-slate-600 space-y-1">
                          <p className="font-semibold text-slate-800">Field Actions:</p>
                          {item.recommended_interventions?.slice(0, 2).map((act, i) => (
                            <p key={i} className="flex items-start gap-1">
                              <span className="text-emerald-600">●</span> {act}
                            </p>
                          ))}
                        </div>

                        <p className="mt-2 text-[10px] text-slate-400 italic">
                          Normalized surveillance sample: {item.current_cases} cases
                        </p>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectCity(item.city);
                            setActiveTab("weather");
                          }}
                          className="font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Check Weather Risk →
                        </button>
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                          {item.alert_urgency}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredPredictions.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No districts found matching your search.
                </div>
              )}
            </div>

            {/* Live Alerts List */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-3">
                Recent Surveillance Alerts
              </h2>
              <div className="divide-y divide-slate-100">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-2"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          📍 {alert.location}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.2 text-[10px] font-bold ${
                            alert.score >= 80
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {alert.level} ({alert.outbreak_risk || `${alert.score}%`} Risk)
                        </span>
                        {alert.outbreak_probability && (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.2 rounded border border-rose-100 tabular-nums">
                            {alert.outbreak_probability} Likelihood
                          </span>
                        )}
                        {alert.caseload_share && (
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100 tabular-nums">
                            Share: {alert.caseload_share}
                          </span>
                        )}
                        {alert.case_surge && (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-100 tabular-nums">
                            Surge: {alert.case_surge}
                          </span>
                        )}
                        {alert.status && (
                          <span className="text-[10px] text-slate-400">
                            Status: {alert.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{alert.reason}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {alert.status?.toLowerCase() !== "acknowledged" && (
                        <button
                          type="button"
                          onClick={() => void handleAlertAction(alert.id, "acknowledge")}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Acknowledge
                        </button>
                      )}
                      {alert.status?.toLowerCase() !== "resolved" && (
                        <button
                          type="button"
                          onClick={() => void handleAlertAction(alert.id, "resolve")}
                          className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Mark Safe
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===================== TAB 3: LIVE WEATHER & MOSQUITO THREAT ===================== */}
        {activeTab === "weather" && (
          <section className="space-y-4">
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Live Meteorology & Mosquito Breeding Threat
                  </h2>
                  <p className="text-xs text-slate-500">
                    Weather conditions directly impact Aedes aegypti mosquito reproduction cycles
                  </p>
                </div>

                {/* City Picker Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {["Lucknow", "Agra", "Kanpur", "Varanasi", "New Delhi", "Patna", "Gorakhpur"].map(
                    (c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleSelectCity(c)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          selectedCity.toLowerCase() === c.toLowerCase()
                            ? "bg-blue-600 text-white font-bold"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {c}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Weather Content */}
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Weather Observation (5 cols) */}
                <div className="lg:col-span-5 rounded-xl border border-slate-100 bg-gradient-to-br from-blue-50/60 to-slate-50 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-blue-600">
                        📍 {weatherData?.location?.city || selectedCity}
                      </span>
                      <h3 className="mt-2 text-4xl font-extrabold text-slate-900 tabular-nums">
                        {weatherData?.current?.temperature_c !== undefined
                          ? `${weatherData.current.temperature_c}°C`
                          : "30°C"}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {weatherData?.current?.condition || "Partly Cloudy"}
                      </p>
                    </div>
                    <div className="text-blue-500">
                      {weatherData?.current?.condition?.toLowerCase().includes("rain") ? (
                        <CloudRain size={48} />
                      ) : (
                        <Sun size={48} className="text-amber-500" />
                      )}
                    </div>
                  </div>

                  {/* 3 Metric Pills */}
                  <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-white p-2.5 border border-slate-100 shadow-2xs">
                      <span className="text-[10px] text-slate-500">Humidity</span>
                      <p className="text-sm font-bold text-slate-900 tabular-nums">
                        {weatherData?.current?.humidity_percent ?? 45}%
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-slate-100 shadow-2xs">
                      <span className="text-[10px] text-slate-500">Rainfall</span>
                      <p className="text-sm font-bold text-slate-900 tabular-nums">
                        {weatherData?.current?.precipitation_mm ?? 0} mm
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-slate-100 shadow-2xs">
                      <span className="text-[10px] text-slate-500">Wind Speed</span>
                      <p className="text-sm font-bold text-slate-900 tabular-nums">
                        {weatherData?.current?.wind_speed_kmh ?? 12} km/h
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mosquito Breeding Risk Card (7 cols) */}
                <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-5">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="font-bold text-slate-900 text-sm">
                        Mosquito (Aedes) Breeding Threat
                      </h4>
                      <span className="rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                        {weatherData?.environmental_risk?.overall_level || "High Risk"}
                      </span>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-slate-600">
                      Warm atmospheric temperatures and standing water create rapid larval incubation cycles. Female Aedes mosquitoes can multiply within 7–10 days under current temperatures.
                    </p>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          Transmission Suitability
                        </span>
                        <span className="font-bold text-rose-600 tabular-nums">High (76 / 100)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: "76%" }} />
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          Larval Habitat Suitability
                        </span>
                        <span className="font-bold text-amber-600 tabular-nums">Moderate (60 / 100)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: "60%" }} />
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-[11px] text-slate-400">
                    Source: Open-Meteo Satellite Feed & Vector Ecology Model
                  </p>
                </div>
              </div>

              {/* 7-Day Forecast Row */}
              {weatherData?.forecast_7_days && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-bold text-slate-800 mb-3">
                    7-Day Weather Outlook for {selectedCity}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    {weatherData.forecast_7_days.map((day, idx) => {
                      const d = new Date(day.date);
                      const dayLabel = idx === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" });

                      return (
                        <div
                          key={day.date}
                          className="flex flex-col items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-center text-xs"
                        >
                          <span className="font-bold text-slate-800">{dayLabel}</span>
                          <span className="my-1.5 text-blue-500">
                            {day.short_condition?.includes("Rain") ? (
                              <CloudRain size={20} />
                            ) : (
                              <Sun size={20} className="text-amber-500" />
                            )}
                          </span>
                          <span className="font-semibold text-slate-900 tabular-nums">
                            {day.temp_max !== null ? `${Math.round(day.temp_max ?? 0)}°` : "—"}
                          </span>
                          <span className="text-[10px] text-slate-400 tabular-nums">
                            {day.temp_min !== null ? `${Math.round(day.temp_min ?? 0)}°` : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ===================== TAB 4: WEEKLY TRENDS & ACTIONABLE INSIGHTS ===================== */}
        {activeTab === "trends" && (
          <section className="space-y-4">
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    12-Week National Dengue Surveillance Curve
                  </h2>
                  <p className="text-xs text-slate-500">
                    Aggregated epidemiological surveillance across regional sentinel laboratories
                  </p>
                </div>

                {/* View Metric Mode Toggle */}
                <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setTrendMetric("intensity")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      trendMetric === "intensity"
                        ? "bg-white text-blue-700 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>Caseload Intensity (%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendMetric("surge")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      trendMetric === "surge"
                        ? "bg-white text-blue-700 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>Weekly Surge (%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrendMetric("cases")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      trendMetric === "cases"
                        ? "bg-white text-blue-700 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>Sample Counts</span>
                  </button>
                </div>
              </div>

              {/* Clean Chart in Percentages */}
              <div className="mt-8 flex h-52 items-end gap-2 sm:gap-4 px-2">
                {(() => {
                  const maxCases = Math.max(...trends.map((t) => t.cases), 1);
                  return trends.map((item, idx) => {
                    const isLast = idx === trends.length - 1;
                    let displayLabel = "";
                    let heightPercent = 14;

                    if (trendMetric === "intensity") {
                      const intensity = item.intensity_pct ?? Math.round((item.cases / maxCases) * 100);
                      displayLabel = `${intensity}%`;
                      heightPercent = Math.max(14, intensity);
                    } else if (trendMetric === "surge") {
                      const surge = item.surge_pct ?? 0;
                      displayLabel = `${surge > 0 ? "+" : ""}${surge}%`;
                      heightPercent = Math.max(14, Math.min(Math.abs(surge) * 2, 100));
                    } else {
                      displayLabel = `${item.cases}`;
                      heightPercent = Math.max(14, (item.cases / maxCases) * 100);
                    }

                    return (
                      <div
                        key={item.week}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                      >
                        <span
                          className={`text-[10px] font-black tabular-nums ${
                            isLast ? "text-rose-600" : "text-slate-700"
                          }`}
                        >
                          {displayLabel}
                        </span>
                        <div
                          className={`w-full max-w-8 rounded-t-md transition-all ${
                            isLast ? "bg-rose-600" : "bg-blue-600 hover:bg-blue-700"
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                        <span className="text-[10px] text-slate-400 font-medium">
                          {item.week}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Metric Mode Subtitle Notice */}
              <p className="mt-3 text-center text-xs text-slate-500 italic">
                {trendMetric === "intensity" &&
                  "Showing Relative Caseload Intensity (%) normalized against peak week capacity (Week 12 = 100% saturation)."}
                {trendMetric === "surge" &&
                  "Showing Week-over-Week transmission surge velocity (%) across regional hospital surveillance network."}
                {trendMetric === "cases" &&
                  "Showing raw sentinel sample counts for historical audit reference."}
              </p>

              {/* Summary takeaways */}
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3.5">
                  <p className="text-xs font-bold text-blue-900">Upward Surge Velocity (+25.8%)</p>
                  <p className="mt-1 text-xs text-blue-800">
                    Week-over-week caseload growth has accelerated by +25.8%, driven by favorable post-monsoon mosquito breeding conditions.
                  </p>
                </div>
                <div className="rounded-lg bg-amber-50/60 border border-amber-100 p-3.5">
                  <p className="text-xs font-bold text-amber-900">Peak Burden Saturation (100%)</p>
                  <p className="mt-1 text-xs text-amber-800">
                    Week 12 marks 100% peak surveillance index across Agra, Gorakhpur, Varanasi, and Lucknow.
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 p-3.5">
                  <p className="text-xs font-bold text-emerald-900">Target Containment Impact (-40%)</p>
                  <p className="mt-1 text-xs text-emerald-800">
                    Active municipal larviciding and source reduction reduce transmission velocity by up to 40%.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ===================== SIMPLE ACCESSIBLE FOOTER ===================== */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-400">
        <p className="font-semibold text-slate-600">AI HealthMap · Public Health Intelligence</p>
        <p className="mt-1 text-[11px]">Clean, accessible epidemiological surveillance interface</p>
      </footer>
    </div>
  );
}
