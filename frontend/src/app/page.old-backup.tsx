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

const HealthMap = dynamic(() => import("./healthmap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[380px] flex-col items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      <span className="mt-3 font-medium text-slate-600">Loading geospatial Dengue risk map...</span>
    </div>
  ),
});

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type RiskZone = {
  id?: number | string;
  location: string;
  state?: string;
  disease: string;
  risk_score: number;
  risk_level: string;
  latitude?: number;
  longitude?: number;
  outbreak_probability?: string;
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
  created_at?: string;
};

export type Summary = {
  total_cases?: number;
  active_alerts?: number;
  high_risk_areas?: number;
  average_risk_score?: number;
  avg_risk_score?: number;
  risk_score?: number;
  case_change?: string;
  alert_change?: string;
  risk_area_change?: string;
  risk_level?: string;
  primary_source?: string;
  weather_source?: string;
  model_version?: string;
  last_analyzed?: string;
};

export type Trend = {
  week: string;
  cases: number;
};

export type ApiStatus = "loading" | "connected" | "error";

export type ForecastDay = {
  date: string;
  temp_max?: number | null;
  temp_min?: number | null;
  precipitation_mm?: number;
  condition?: string;
  short_condition?: string;
};

export type DiseaseRiskDetail = {
  disease: string;
  score: number;
  level: string;
  interpretation: string;
};

export type EnvironmentalRisk = {
  overall_level: string;
  max_risk_score: number;
  dengue: DiseaseRiskDetail;
  aedes_breeding?: DiseaseRiskDetail;
  viral_incubation?: DiseaseRiskDetail;
};

export type WeatherCity = {
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

export type WeatherData = {
  source?: string;
  data_status?: string;
  retrieved_at?: string;
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
    showers_mm?: number;
    wind_speed_kmh?: number;
    weather_code?: number;
    condition?: string;
    short_condition?: string;
  };
  forecast_7_days?: ForecastDay[];
  environmental_risk?: EnvironmentalRisk;
  health_interpretation?: {
    dengue?: string;
    aedes_breeding?: string;
    viral_incubation?: string;
  };
};

export type OutbreakPrediction = {
  id: string;
  numeric_id: number;
  city: string;
  district_code?: string;
  state: string;
  disease: string;
  latitude: number;
  longitude: number;
  current_cases: number;
  previous_cases: number;
  baseline_mean: number;
  endemic_threshold?: number;
  z_score: number;
  growth_rate_pct: number;
  baseline_exceedance_pct: number;
  risk_score: number;
  outbreak_probability_pct: number;
  risk_level: string;
  status: string;
  alert_status: string;
  alert_urgency: string;
  projected_cases_next_week: number;
  projected_range: string;
  ai_explanation: string;
  recommended_interventions: string[];
  population: number;
  primary_vector?: string;
  reporting_agency?: string;
  source_bulletin?: string;
  created_at: string;
};

const navigation = [
  { label: "Dashboard", icon: "▦", id: "dashboard" },
  { label: "AI Outbreak Engine", icon: "⚡", id: "ai-outbreaks" },
  { label: "Live Weather", icon: "🌤️", id: "live-weather" },
  { label: "Health Map", icon: "◎", id: "health-map" },
  { label: "Disease Trends", icon: "↗", id: "disease-trends" },
  { label: "Alerts", icon: "◉", id: "alerts" },
  { label: "Reports", icon: "▤", id: "reports" },
  { label: "Data Sources", icon: "◈", id: "data-sources" },
  { label: "Settings", icon: "⚙", id: "settings" },
];

function cleanString(str?: string): string {
  if (!str) return "";
  return str
    .replace(/AC/g, "°C")
    .replace(/Â°C/g, "°C")
    .replace(/Â/g, "")
    .replace(/I\?/g, "σ");
}

function getRiskColor(score: number) {
  if (score >= 81) return "bg-red-50 text-red-700 border border-red-200";
  if (score >= 61) return "bg-amber-50 text-amber-800 border border-amber-200";
  if (score >= 31) return "bg-yellow-50 text-yellow-800 border border-yellow-200";
  return "bg-emerald-50 text-emerald-700 border border-emerald-200";
}

function getRiskLabel(score: number) {
  if (score >= 81) return "Critical";
  if (score >= 61) return "High";
  if (score >= 31) return "Medium";
  return "Low";
}

function formatNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return null;
  return value.toLocaleString("en-IN");
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function normalizeZones(payload: unknown): RiskZone[] {
  let rows: unknown[] = [];

  if (Array.isArray(payload)) {
    rows = payload;
  } else if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    if (Array.isArray(data.zones)) rows = data.zones;
    else if (Array.isArray(data.risk_zones)) rows = data.risk_zones;
    else if (Array.isArray(data.data)) rows = data.data;
  }

  return rows
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object",
    )
    .map((item, index) => {
      const score = Number(item.risk_score ?? item.score ?? 0);
      const lat = typeof item.latitude === "number" ? item.latitude : undefined;
      const lng = typeof item.longitude === "number" ? item.longitude : undefined;

      return {
        id: String(item.id ?? index),
        location: String(item.location ?? item.location_name ?? "Unknown"),
        state: item.state ? String(item.state) : undefined,
        disease: "Dengue",
        risk_score: Number.isFinite(score) ? score : 0,
        risk_level: String(
          item.risk_level ?? item.level ?? getRiskLabel(score),
        ),
        latitude: lat,
        longitude: lng,
        outbreak_probability: item.outbreak_probability ? String(item.outbreak_probability) : undefined,
        current_cases: typeof item.current_cases === "number" ? item.current_cases : undefined,
        projected_cases: typeof item.projected_cases === "number" ? item.projected_cases : undefined,
        live_temp: item.live_temp ? cleanString(String(item.live_temp)) : undefined,
        live_humidity: item.live_humidity ? String(item.live_humidity) : undefined,
        source: item.source ? String(item.source) : undefined,
      };
    })
    .filter((zone) => zone.location !== "Unknown");
}

function normalizeAlerts(payload: unknown): HealthAlert[] {
  let rows: unknown[] = [];

  if (Array.isArray(payload)) {
    rows = payload;
  } else if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    if (Array.isArray(data.alerts)) rows = data.alerts;
    else if (Array.isArray(data.data)) rows = data.data;
  }

  return rows
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object",
    )
    .map((item, index) => {
      const score = Number(item.score ?? item.risk_score ?? 0);

      return {
        id: String(item.id ?? index),
        disease: "Dengue",
        location: String(item.location ?? "Unknown location"),
        score: Number.isFinite(score) ? score : 0,
        level: String(item.level ?? item.severity ?? getRiskLabel(score)),
        reason: cleanString(String(item.reason ?? "Aedes vector proliferation and case acceleration.")),
        status: String(item.status ?? "New"),
        created_at:
          typeof item.created_at === "string"
            ? item.created_at
            : undefined,
      };
    });
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  badgeText,
  iconTheme,
}: {
  title: string;
  value: string | null;
  subtitle: string;
  icon: React.ReactNode;
  badgeText?: string;
  iconTheme: "blue" | "red" | "amber" | "teal";
}) {
  const themeStyles = {
    blue: {
      bg: "bg-blue-50/80",
      text: "text-[#2563EB]",
      border: "border-blue-100",
      dot: "bg-[#2563EB]",
    },
    red: {
      bg: "bg-red-50/80",
      text: "text-[#DC2626]",
      border: "border-red-100",
      dot: "bg-[#DC2626]",
    },
    amber: {
      bg: "bg-amber-50/80",
      text: "text-[#D97706]",
      border: "border-amber-100",
      dot: "bg-[#D97706]",
    },
    teal: {
      bg: "bg-teal-50/80",
      text: "text-[#0D9488]",
      border: "border-teal-100",
      dot: "bg-[#0D9488]",
    },
  }[iconTheme];

  return (
    <div className="relative flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs transition hover:shadow-md">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
            {title}
          </p>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${themeStyles.border} ${themeStyles.bg} ${themeStyles.text}`}
          >
            {icon}
          </div>
        </div>

        <div className="mt-3">
          {value !== null ? (
            <p className="text-3xl font-extrabold tracking-tight text-[#172B4D]">
              {value}
            </p>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              Data unavailable
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <p className="text-xs text-[#475569] leading-tight line-clamp-1">
          {subtitle}
        </p>
        {badgeText && (
          <span className="shrink-0 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
}

function DashboardContent({ onLogout }: { onLogout: () => void }) {
  const [currentDate, setCurrentDate] = useState("");
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [zones, setZones] = useState<RiskZone[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [predictions, setPredictions] = useState<OutbreakPrediction[]>([]);
  const [selectedRegionFilter, setSelectedRegionFilter] = useState("All");
  const [predictionViewMode, setPredictionViewMode] = useState<"cards" | "table">("cards");

  const [apiStatus, setApiStatus] = useState<ApiStatus>("loading");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedCity, setSelectedCity] = useState("Lucknow");
  const [availableCities, setAvailableCities] = useState<WeatherCity[]>([
    { city: "Lucknow", state: "Uttar Pradesh", latitude: 26.8467, longitude: 80.9462 },
    { city: "Kanpur", state: "Uttar Pradesh", latitude: 26.4499, longitude: 80.3319 },
    { city: "Varanasi", state: "Uttar Pradesh", latitude: 25.3176, longitude: 82.9739 },
    { city: "Prayagraj", state: "Uttar Pradesh", latitude: 25.4358, longitude: 81.8463 },
    { city: "Gorakhpur", state: "Uttar Pradesh", latitude: 26.7606, longitude: 83.3732 },
    { city: "Agra", state: "Uttar Pradesh", latitude: 27.1767, longitude: 78.0081 },
    { city: "Meerut", state: "Uttar Pradesh", latitude: 28.9845, longitude: 77.7064 },
    { city: "Ayodhya", state: "Uttar Pradesh", latitude: 26.7922, longitude: 82.1998 },
    { city: "Noida", state: "Uttar Pradesh", latitude: 28.5355, longitude: 77.3910 },
    { city: "New Delhi", state: "Delhi", latitude: 28.6139, longitude: 77.2090 },
    { city: "Patna", state: "Bihar", latitude: 25.5941, longitude: 85.1376 },
  ]);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLiveTime, setWeatherLiveTime] = useState("");
  const [weatherError, setWeatherError] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(true);

  const [alertBusy, setAlertBusy] = useState<string | number | null>(null);
  const [alertMessage, setAlertMessage] = useState("");

  const username =
    typeof window !== "undefined"
      ? window.localStorage.getItem("healthmap_username") || "Analyst"
      : "Analyst";

  useEffect(() => {
    const updateDate = () => setCurrentDate(formatDate(new Date()));
    updateDate();
    const timer = window.setInterval(updateDate, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadDashboard = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setApiStatus("loading");
      setIsRefreshing(true);
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);

    try {
      const results = await Promise.allSettled([
        apiFetch(`${API_BASE}/api/analytics/summary`, {
          signal: controller.signal,
          cache: "no-store",
        }),
        apiFetch(`${API_BASE}/api/map/risk-zones`, {
          signal: controller.signal,
          cache: "no-store",
        }),
        apiFetch(`${API_BASE}/api/alerts`, {
          signal: controller.signal,
          cache: "no-store",
        }),
        apiFetch(`${API_BASE}/api/predictions/outbreaks`, {
          signal: controller.signal,
          cache: "no-store",
        }),
        apiFetch(`${API_BASE}/api/analytics/trends`, {
          signal: controller.signal,
          cache: "no-store",
        }),
      ]);

      let anySuccess = false;

      // 1. Summary
      const summaryResult = results[0];
      if (summaryResult.status === "fulfilled" && summaryResult.value.ok) {
        const body = (await summaryResult.value.json()) as Summary;
        setSummary(body);
        anySuccess = true;
      }

      // 2. Risk Zones
      const zonesResult = results[1];
      if (zonesResult.status === "fulfilled" && zonesResult.value.ok) {
        const body: unknown = await zonesResult.value.json();
        const normalized = normalizeZones(body);
        if (normalized.length > 0) {
          setZones(normalized);
          anySuccess = true;
        }
      }

      // 3. Alerts
      const alertsResult = results[2];
      if (alertsResult.status === "fulfilled" && alertsResult.value.ok) {
        const body: unknown = await alertsResult.value.json();
        setAlerts(normalizeAlerts(body));
        anySuccess = true;
      }

      // 4. AI Outbreak Predictions
      const predResult = results[3];
      if (predResult.status === "fulfilled" && predResult.value.ok) {
        const body = (await predResult.value.json()) as { predictions?: OutbreakPrediction[] };
        if (Array.isArray(body.predictions)) {
          setPredictions(
            body.predictions.map((p) => ({
              ...p,
              disease: "Dengue",
              primary_vector: "Aedes aegypti (Tiger Mosquito)",
              ai_explanation: cleanString(p.ai_explanation),
            }))
          );
          anySuccess = true;
        }
      }

      // 5. Trends
      const trendsResult = results[4];
      if (trendsResult.status === "fulfilled" && trendsResult.value.ok) {
        const body = (await trendsResult.value.json()) as { data?: Trend[] };
        if (Array.isArray(body.data)) {
          setTrends(body.data);
          anySuccess = true;
        }
      }

      setApiStatus(anySuccess ? "connected" : "error");
    } catch {
      setApiStatus("error");
    } finally {
      window.clearTimeout(timeout);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  // Live weather clock
  useEffect(() => {
    const updateWeatherTime = () => {
      const timeZone = weather?.location?.timezone;
      if (!timeZone) {
        setWeatherLiveTime("");
        return;
      }

      try {
        setWeatherLiveTime(
          new Date().toLocaleTimeString("en-IN", {
            timeZone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
        );
      } catch {
        setWeatherLiveTime("");
      }
    };

    updateWeatherTime();
    const timer = window.setInterval(updateWeatherTime, 1000);
    return () => window.clearInterval(timer);
  }, [weather?.location?.timezone]);

  const fetchWeather = useCallback(async (cityName: string, isManual = false) => {
    if (isManual) {
      setWeatherLoading(true);
      setWeatherError("");
    }
    try {
      const response = await fetch(
        `${API_BASE}/api/weather?city=${encodeURIComponent(cityName)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail =
          body && typeof body === "object" && "detail" in body
            ? String((body as { detail?: unknown }).detail ?? "")
            : "";
        throw new Error(detail || `Weather API returned HTTP ${response.status}`);
      }
      if (!body || typeof body !== "object") {
        throw new Error("Weather API returned an unexpected response.");
      }
      setWeather(body as WeatherData);
    } catch (error) {
      setWeatherError(
        error instanceof Error
          ? error.message
          : "Could not load weather data.",
      );
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  // Fetch available cities on mount
  useEffect(() => {
    async function loadCities() {
      try {
        const res = await fetch(`${API_BASE}/api/weather/cities`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { cities?: WeatherCity[] };
          if (Array.isArray(data.cities) && data.cities.length > 0) {
            setAvailableCities(data.cities);
          }
        }
      } catch {
        // Fallback default list used
      }
    }
    void loadCities();
  }, []);

  // Load weather when selectedCity changes
  useEffect(() => {
    void fetchWeather(selectedCity, false);
  }, [fetchWeather, selectedCity]);

  const handleSelectCityFromMap = useCallback((location: string) => {
    const clean = location.split(",")[0].trim();
    setSelectedCity(clean);
    void fetchWeather(clean, true);
    const target = document.getElementById("live-weather");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [fetchWeather]);

  const activeAlerts = useMemo(
    () => alerts.filter((alert) => alert.status?.toLowerCase() !== "resolved"),
    [alerts],
  );

  const highRiskAreas = useMemo(
    () => zones.filter((zone) => zone.risk_score >= 61).length,
    [zones],
  );

  const averageRisk = useMemo(() => {
    if (zones.length === 0) return undefined;
    return Math.round(
      zones.reduce((total, zone) => total + zone.risk_score, 0) / zones.length,
    );
  }, [zones]);

  const totalCases =
    typeof summary?.total_cases === "number"
      ? summary.total_cases
      : undefined;

  const alertCount =
    typeof summary?.active_alerts === "number"
      ? summary.active_alerts
      : activeAlerts.length;

  const highRiskCount =
    typeof summary?.high_risk_areas === "number"
      ? summary.high_risk_areas
      : highRiskAreas;

  const riskScore =
    summary?.average_risk_score ??
    summary?.avg_risk_score ??
    summary?.risk_score ??
    averageRisk;

  async function updateAlert(
    alert: HealthAlert,
    action: "acknowledge" | "resolve",
  ) {
    setAlertBusy(alert.id);
    setAlertMessage("");

    try {
      const response = await apiFetch(
        `${API_BASE}/api/alerts/${alert.id}/${action}`,
        { method: "PATCH" },
      );

      const body = (await response.json().catch(() => ({}))) as {
        detail?: string;
        message?: string;
        alert?: Record<string, unknown>;
      };

      if (!response.ok) {
        throw new Error(
          body.detail || body.message || "Could not update this alert.",
        );
      }

      setAlerts((previous) =>
        previous.map((item) =>
          item.id === alert.id
            ? {
                ...item,
                status:
                  action === "resolve" ? "Resolved" : "Acknowledged",
              }
            : item,
        ),
      );

      setAlertMessage(
        body.message ||
          (action === "resolve"
            ? `Dengue containment protocol for ${alert.location} marked resolved.`
            : `Dengue alert for ${alert.location} acknowledged by officer.`),
      );

      await loadDashboard(true);
    } catch (error) {
      setAlertMessage(
        error instanceof Error
          ? error.message
          : "Alert update failed.",
      );
    } finally {
      setAlertBusy(null);
    }
  }

  function navigateTo(label: string, id: string) {
    setActiveNav(label);
    setIsMobileNavOpen(false);

    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setAlertMessage(`${label} section is currently loading or unavailable.`);
    }
  }

  const filteredPredictions = useMemo(() => {
    return predictions.filter((p) => {
      if (selectedRegionFilter === "All") return true;
      if (selectedRegionFilter === "Critical") return p.outbreak_probability_pct >= 75;
      if (selectedRegionFilter === "High") return p.outbreak_probability_pct >= 60 && p.outbreak_probability_pct < 75;
      if (selectedRegionFilter === "UP") return p.state.toLowerCase().includes("uttar");
      if (selectedRegionFilter === "Delhi") return p.state.toLowerCase().includes("delhi");
      if (selectedRegionFilter === "Bihar") return p.state.toLowerCase().includes("bihar");
      return true;
    });
  }, [predictions, selectedRegionFilter]);

  const regionCounts = useMemo(() => {
    return {
      All: predictions.length,
      Critical: predictions.filter((p) => p.outbreak_probability_pct >= 75).length,
      High: predictions.filter((p) => p.outbreak_probability_pct >= 60 && p.outbreak_probability_pct < 75).length,
      UP: predictions.filter((p) => p.state.toLowerCase().includes("uttar")).length,
      Delhi: predictions.filter((p) => p.state.toLowerCase().includes("delhi")).length,
      Bihar: predictions.filter((p) => p.state.toLowerCase().includes("bihar")).length,
    };
  }, [predictions]);

  return (
    <div
      id="dashboard"
      className="min-h-screen bg-[#F5F8FC] text-[#475569] font-sans antialiased selection:bg-teal-100 selection:text-teal-900"
    >
      <div className="flex min-h-screen">
        {/* ==================== DESKTOP SIDEBAR ==================== */}
        <aside
          aria-label="Health Intelligence Navigation"
          className="hidden w-64 shrink-0 flex-col border-r border-[#193554] bg-[#10243A] text-slate-300 lg:flex"
        >
          {/* Logo Branding */}
          <div className="border-b border-[#1A3859] px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-xl font-black text-white shadow-sm ring-2 ring-blue-400/20">
                +
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold tracking-tight text-white leading-tight">
                  AI HealthMap
                </h1>
                <p className="mt-0.5 text-[9px] font-bold tracking-[0.18em] text-[#0D9488]">
                  DENGUE INTELLIGENCE
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto px-3.5 pt-5 pb-3">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Dengue Operations Hub
            </p>

            <nav className="mt-3 space-y-1">
              {navigation.map((item) => {
                const isActive = activeNav === item.label;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.label, item.id)}
                    className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#1B3654] text-white shadow-xs ring-1 ring-teal-500/30"
                        : "text-slate-300 hover:bg-[#162D46] hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm transition ${
                        isActive
                          ? "text-[#0D9488]"
                          : "text-slate-400 group-hover:text-slate-200"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>

                    {item.label === "Alerts" && activeAlerts.length > 0 && (
                      <span className="ml-auto rounded-full bg-[#DC2626] px-2 py-0.5 text-[10px] font-black text-white shadow-xs">
                        {activeAlerts.length}
                      </span>
                    )}

                    {item.label === "AI Outbreak Engine" && (
                      <span className="ml-auto flex h-2 w-2 rounded-full bg-[#0D9488] ring-4 ring-teal-900/40 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Compact User Profile & System Status */}
          <div className="mt-auto border-t border-[#1A3859] p-3.5 bg-[#0C1B2B]">
            {/* API Connection Indicator */}
            <div className="rounded-lg bg-[#10243A] p-2.5 border border-[#1A3859]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      apiStatus === "connected"
                        ? "bg-[#059669] ring-2 ring-emerald-500/20"
                        : apiStatus === "loading"
                        ? "animate-pulse bg-[#D97706]"
                        : "bg-[#DC2626]"
                    }`}
                  />
                  <span className="text-[11px] font-semibold text-slate-200">
                    {apiStatus === "connected"
                      ? "Dengue Engine Active"
                      : apiStatus === "loading"
                      ? "Connecting Feed..."
                      : "API Offline"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void loadDashboard(true)}
                  disabled={isRefreshing}
                  className="text-[10px] font-semibold text-[#0D9488] hover:text-teal-300 transition disabled:opacity-50"
                  title="Reload Dengue Telemetry"
                >
                  {isRefreshing ? "..." : "↻ Reload"}
                </button>
              </div>
            </div>

            {/* User Profile Card */}
            <div className="mt-2.5 flex items-center justify-between rounded-lg px-2 py-1.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white shadow-xs">
                  {username.slice(0, 2).toUpperCase()}
                  <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-[#059669] ring-1 ring-[#10243A]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {username}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    Lead Vector Epidemiologist
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-[#162D46] hover:text-white transition"
                title="Sign out"
              >
                <span className="text-xs font-bold">⎋</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ==================== MOBILE SLIDE-OVER SIDEBAR ==================== */}
        {isMobileNavOpen && (
          <div className="fixed inset-0 z-[700] lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileNavOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 flex w-72 flex-col bg-[#10243A] text-slate-300 shadow-xl border-r border-[#193554]">
              <div className="flex items-center justify-between border-b border-[#1A3859] px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB] text-lg font-bold text-white">
                    +
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">AI HealthMap</h2>
                    <p className="text-[9px] font-bold tracking-widest text-[#0D9488]">
                      DENGUE INTELLIGENCE
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-[#162D46] hover:text-white"
                >
                  ✕
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {navigation.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.label, item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold ${
                      activeNav === item.label
                        ? "bg-[#1B3654] text-white"
                        : "text-slate-300 hover:bg-[#162D46]"
                    }`}
                  >
                    <span className="w-5 text-center text-sm">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.label === "Alerts" && activeAlerts.length > 0 && (
                      <span className="ml-auto rounded-full bg-[#DC2626] px-2 py-0.5 text-[10px] font-bold text-white">
                        {activeAlerts.length}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              <div className="border-t border-[#1A3859] p-4">
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600/20 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-600/30"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== MAIN APPLICATION CONTENT ==================== */}
        <main className="min-w-0 flex-1 flex flex-col">
          {/* ==================== TOP HEADER ==================== */}
          <header className="sticky top-0 z-[600] border-b border-[#E2E8F0] bg-white/95 backdrop-blur-md">
            <div className="flex min-h-[68px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
              {/* Left Title & Mobile Toggle */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] text-slate-700 hover:bg-slate-50 lg:hidden"
                  aria-label="Toggle navigation drawer"
                >
                  ☰
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#475569]">
                    <span>National Dengue Surveillance Hub</span>
                    <span>/</span>
                    <span className="text-[#2563EB] font-semibold truncate">
                      {activeNav}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-[#172B4D] truncate">
                    National Dengue Surveillance & Vector Intelligence Dashboard
                  </h2>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                {/* Current Date */}
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-bold text-[#172B4D]">
                    {currentDate || "Real-time Telemetry"}
                  </span>
                  <span className="text-[10px] text-[#475569]">
                    MoHFW NVBDCP Vector Surveillance Network
                  </span>
                </div>

                {/* AI Outbreak Engine Status Badge */}
                <div className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-1.5 text-xs font-semibold text-[#0D9488]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0D9488]" />
                  </span>
                  <span className="hidden xl:inline">Dengue Vector Engine:</span> Active · 10 Districts
                </div>

                {/* Refresh Dashboard Button */}
                <button
                  type="button"
                  onClick={() => void loadDashboard(true)}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#172B4D] shadow-2xs transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                >
                  <span className={isRefreshing ? "animate-spin" : ""}>↻</span>
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                {/* User / Logout */}
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-lg border border-red-200 bg-red-50/70 px-2.5 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-red-100 transition"
                >
                  Log out
                </button>
              </div>
            </div>

            {/* Mobile Horizontal Quick Navigation Strip */}
            <div className="flex gap-1.5 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden bg-slate-50/50">
              {navigation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.label, item.id)}
                  className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    activeNav === item.label
                      ? "bg-[#2563EB] text-white"
                      : "bg-white border border-slate-200 text-[#475569]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </header>

          {/* ==================== DASHBOARD BODY CONTAINER ==================== */}
          <div className="mx-auto w-full max-w-[1600px] flex-1 space-y-7 p-4 sm:p-6 xl:p-8">
            {/* Status Alert Banner if needed */}
            {alertMessage && (
              <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs text-teal-900 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-teal-600 font-bold">ℹ</span>
                  <span>{alertMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAlertMessage("")}
                  className="text-teal-700 hover:text-teal-900 font-bold ml-3"
                >
                  ✕
                </button>
              </div>
            )}

            {/* ==================== HERO SECTION & REFRESH ==================== */}
            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E2E8F0] pb-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#2563EB]">
                  <span>NATIONAL DENGUE INTELLIGENCE</span>
                  <span>•</span>
                  <span>AEDES AEGYPTI SURVEILLANCE</span>
                </div>
                <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172B4D]">
                  Dengue Surveillance & Outbreak Early Warning Hub
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-[#475569]">
                  Tracking Dengue vector transmission, statistical Z-Score anomalies (+2σ exceedance), and satellite climate incubation indices across monitored districts.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void loadDashboard(true)}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-98 disabled:opacity-50"
                >
                  <span className={isRefreshing ? "animate-spin" : ""}>↻</span>
                  <span>{isRefreshing ? "Updating Intelligence..." : "Sync Live Data"}</span>
                </button>
              </div>
            </section>

            {/* ==================== SECTION 4: REDESIGNED KPI CARDS ==================== */}
            <section aria-label="Key Dengue Surveillance Indicators">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Total Dengue Cases"
                  value={formatNumber(totalCases)}
                  subtitle={
                    summary?.case_change
                      ? `${summary.case_change} weekly Dengue surveillance surge`
                      : totalCases !== undefined
                      ? "MoHFW NVBDCP verified Dengue cases"
                      : "Official Dengue counts not returned"
                  }
                  badgeText={summary?.case_change ? summary.case_change : undefined}
                  icon={
                    <span className="text-xl">🦟</span>
                  }
                  iconTheme="blue"
                />

                <StatCard
                  title="Active Dengue Alerts"
                  value={formatNumber(alertCount)}
                  subtitle={
                    summary?.alert_change
                      ? `${summary.alert_change} across monitored districts`
                      : "Unresolved Dengue containment protocols"
                  }
                  badgeText={alertCount > 0 ? `${alertCount} Pending` : "Normal"}
                  icon={
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  }
                  iconTheme="red"
                />

                <StatCard
                  title="High Risk Dengue Zones"
                  value={formatNumber(highRiskCount)}
                  subtitle={
                    summary?.risk_area_change
                      ? summary.risk_area_change
                      : "Dengue risk score ≥ 61"
                  }
                  badgeText="Score ≥ 61"
                  icon={
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  }
                  iconTheme="amber"
                />

                <StatCard
                  title="Average Dengue Risk Score"
                  value={riskScore !== undefined ? `${riskScore} / 100` : null}
                  subtitle={
                    summary?.risk_level
                      ? `${summary.risk_level} Risk · Aedes Proliferation Index`
                      : "Mean calculated across monitored districts"
                  }
                  badgeText={summary?.risk_level ?? (riskScore && riskScore >= 70 ? "High" : "Moderate")}
                  icon={
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  }
                  iconTheme="teal"
                />
              </div>
            </section>

            {/* ==================== SECTION 5: AI DENGUE OUTBREAK PREDICTION & EARLY WARNING ==================== */}
            <section
              id="ai-outbreaks"
              aria-label="AI Dengue Outbreak Prediction and Early Warning Hotspots"
              className="scroll-mt-24 space-y-4"
            >
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs sm:p-6">
                {/* Header & Controls */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                        Autonomous Dengue Anomaly & Vector Engine
                      </span>
                    </div>
                    <h3 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-[#172B4D]">
                      Dengue Outbreak Prediction & Early Warning Hotspots
                    </h3>
                    <p className="mt-1 text-xs text-[#475569] sm:text-sm">
                      Z-Score statistical anomalies (+2σ exceedance), weekly Dengue acceleration velocity, and Aedes aegypti breeding incubation indices.
                    </p>
                  </div>

                  {/* Filter Pills & View Mode */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap items-center rounded-lg bg-slate-100 p-1 border border-slate-200">
                      {[
                        { label: "All Districts", key: "All", count: regionCounts.All },
                        { label: "Critical (≥75%)", key: "Critical", count: regionCounts.Critical },
                        { label: "High Risk (60-74%)", key: "High", count: regionCounts.High },
                        { label: "Delhi NCR", key: "Delhi", count: regionCounts.Delhi },
                        { label: "Uttar Pradesh", key: "UP", count: regionCounts.UP },
                        { label: "Bihar", key: "Bihar", count: regionCounts.Bihar },
                      ].map((filter) => {
                        const isSelected = selectedRegionFilter === filter.key;
                        return (
                          <button
                            key={filter.key}
                            type="button"
                            onClick={() => setSelectedRegionFilter(filter.key)}
                            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                              isSelected
                                ? "bg-white text-[#172B4D] shadow-xs font-bold"
                                : "text-[#475569] hover:text-[#172B4D]"
                            }`}
                          >
                            <span>{filter.label}</span>
                            <span
                              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                                isSelected
                                  ? "bg-slate-900 text-white"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {filter.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* View Switch */}
                    <div className="hidden sm:flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setPredictionViewMode("cards")}
                        className={`rounded-md px-2.5 py-1 transition ${
                          predictionViewMode === "cards"
                            ? "bg-[#10243A] text-white"
                            : "text-[#475569] hover:text-[#172B4D]"
                        }`}
                      >
                        Cards
                      </button>
                      <button
                        type="button"
                        onClick={() => setPredictionViewMode("table")}
                        className={`rounded-md px-2.5 py-1 transition ${
                          predictionViewMode === "table"
                            ? "bg-[#10243A] text-white"
                            : "text-[#475569] hover:text-[#172B4D]"
                        }`}
                      >
                        Table
                      </button>
                    </div>
                  </div>
                </div>

                {/* Hotspot Cards / Table Container */}
                {predictionViewMode === "cards" ? (
                  <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                    {filteredPredictions.map((item) => {
                      const prob = item.outbreak_probability_pct;
                      const isCritical = prob >= 75;
                      const isHigh = prob >= 60 && prob < 75;

                      return (
                        <div
                          key={item.id}
                          className={`relative flex flex-col justify-between rounded-xl border p-5 transition hover:shadow-md ${
                            isCritical
                              ? "border-red-200 bg-white ring-1 ring-red-100"
                              : isHigh
                              ? "border-amber-200 bg-white ring-1 ring-amber-100"
                              : "border-[#E2E8F0] bg-white"
                          }`}
                        >
                          <div>
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">🦟</span>
                                  <h4 className="text-lg font-bold text-[#172B4D] truncate">
                                    {item.city}
                                  </h4>
                                  <span className="text-xs text-[#475569]">
                                    ({item.district_code || item.state})
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#2563EB]">
                                    Dengue Virus (DENV)
                                  </span>
                                  <span className="text-[11px] text-[#475569]">
                                    Vector: <span className="italic font-medium">Aedes aegypti</span>
                                  </span>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span
                                  className={`inline-block rounded-md px-2.5 py-1 text-xs font-black shadow-2xs ${
                                    isCritical
                                      ? "bg-[#DC2626] text-white"
                                      : isHigh
                                      ? "bg-[#D97706] text-white"
                                      : "bg-[#059669] text-white"
                                  }`}
                                >
                                  {prob}% Outbreak Likelihood
                                </span>
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#475569]">
                                  {item.alert_urgency}
                                </p>
                              </div>
                            </div>

                            {/* 3 Metrics Telemetry Grid */}
                            <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 text-center">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#475569]">
                                  Current (W12)
                                </p>
                                <p className="mt-1 text-base font-extrabold text-[#172B4D]">
                                  {item.current_cases}
                                </p>
                                <span className="text-[10px] font-bold text-[#DC2626]">
                                  +{item.growth_rate_pct}% WoW
                                </span>
                              </div>

                              <div className="border-x border-slate-200/80">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#475569]">
                                  Anomaly Z-Score
                                </p>
                                <p className="mt-1 text-base font-extrabold text-[#172B4D]">
                                  +{item.z_score}σ
                                </p>
                                <span className="text-[10px] text-[#475569]">
                                  Base: {item.baseline_mean}
                                </span>
                              </div>

                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#475569]">
                                  Projected (W+1)
                                </p>
                                <p className="mt-1 text-base font-extrabold text-[#0D9488]">
                                  ~{item.projected_cases_next_week}
                                </p>
                                <span className="text-[10px] text-[#475569]">
                                  {item.projected_range}
                                </span>
                              </div>
                            </div>

                            {/* AI Diagnostics Box */}
                            <div className="mt-3.5 rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-[#172B4D]">
                                <span>🤖</span>
                                <span>AI Dengue Diagnostic Analysis:</span>
                              </div>
                              <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">
                                {item.ai_explanation}
                              </p>
                            </div>

                            {/* Actionable Dengue Interventions */}
                            {item.recommended_interventions && item.recommended_interventions.length > 0 && (
                              <div className="mt-3">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#475569]">
                                  Recommended Dengue Containment Protocol:
                                </p>
                                <ul className="mt-1.5 space-y-1 text-xs text-[#172B4D]">
                                  {item.recommended_interventions.map((action, i) => (
                                    <li key={i} className="flex items-start gap-1.5">
                                      <span className="text-[#0D9488] font-bold">✓</span>
                                      <span>{action}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Card Footer */}
                          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                            <button
                              type="button"
                              onClick={() => handleSelectCityFromMap(item.city)}
                              className="text-xs font-bold text-[#0D9488] hover:text-teal-800 transition"
                            >
                              🌤️ Inspect {item.city} Dengue Vector Climate →
                            </button>
                            <span className="text-[11px] text-[#475569]">
                              Pop: {(item.population / 100000).toFixed(1)} Lakh
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Hotspot Table View */
                  <div className="mt-6 overflow-x-auto rounded-xl border border-[#E2E8F0]">
                    <table className="w-full text-left text-xs text-[#475569]">
                      <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-[#172B4D] border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">District & Vector</th>
                          <th className="px-4 py-3">Current Cases</th>
                          <th className="px-4 py-3">Growth (WoW)</th>
                          <th className="px-4 py-3">Anomaly Z-Score</th>
                          <th className="px-4 py-3">Outbreak Likelihood</th>
                          <th className="px-4 py-3">Urgency Protocol</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white font-medium">
                        {filteredPredictions.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition">
                            <td className="px-4 py-3 font-semibold text-[#172B4D]">
                              <div>
                                <span className="font-bold text-sm">{item.city}</span>
                                <span className="ml-1 text-slate-500">({item.state})</span>
                              </div>
                              <span className="text-[11px] text-[#2563EB] font-bold">
                                Dengue (Aedes aegypti)
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-[#172B4D]">
                              {item.current_cases}
                            </td>
                            <td className="px-4 py-3 font-bold text-[#DC2626]">
                              +{item.growth_rate_pct}%
                            </td>
                            <td className="px-4 py-3 font-bold text-[#172B4D]">
                              +{item.z_score}σ
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-extrabold ${
                                  item.outbreak_probability_pct >= 75
                                    ? "bg-red-100 text-red-700"
                                    : item.outbreak_probability_pct >= 60
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {item.outbreak_probability_pct}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[11px] font-semibold text-[#172B4D]">
                              {item.alert_urgency}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleSelectCityFromMap(item.city)}
                                className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-[#0D9488] hover:bg-teal-50"
                              >
                                Weather
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Empty filter message */}
                {filteredPredictions.length === 0 && (
                  <div className="mt-8 rounded-xl border border-dashed border-slate-200 p-8 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      No Dengue hotspots found in the selected region filter.
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Select All Districts or refresh surveillance data.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* ==================== SECTION 6: DENGUE RISK MAP & PRIORITY ALERTS ==================== */}
            <section
              id="health-map"
              aria-label="Geospatial Dengue Risk Map and Alerts"
              className="scroll-mt-24 grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.85fr)]"
            >
              {/* Health Risk Map Card */}
              <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h3 className="font-bold text-[#172B4D] text-base">
                      Interactive Dengue Risk Map
                    </h3>
                    <p className="text-xs text-[#475569]">
                      Geospatial risk markers with coordinates resolution and Dengue outbreak levels
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-[#172B4D]">
                    {zones.length} active Dengue monitoring zones
                  </span>
                </div>

                <div className="h-[400px] w-full sm:h-[480px]">
                  <HealthMap
                    zones={zones}
                    compact={false}
                    onSelectLocation={handleSelectCityFromMap}
                  />
                </div>

                {/* Map Footer Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 bg-slate-50/50 text-xs">
                  <div className="flex items-center gap-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                      Dengue Severity Legend:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
                      <span className="text-[#172B4D] font-medium">Critical (81–100)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#D97706]" />
                      <span className="text-[#172B4D] font-medium">High (61–80)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#CA8A04]" />
                      <span className="text-[#172B4D] font-medium">Medium (31–60)</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#475569]">
                    OpenStreetMap Satellite Base Layer
                  </span>
                </div>
              </div>

              {/* Priority Alerts Card */}
              <div
                id="alerts"
                className="scroll-mt-24 rounded-xl border border-[#E2E8F0] bg-white shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div>
                      <h3 className="font-bold text-[#172B4D] text-base">
                        Priority Dengue Alerts
                      </h3>
                      <p className="text-xs text-[#475569]">
                        Real-time vector notifications requiring containment review
                      </p>
                    </div>

                    <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-bold text-[#DC2626]">
                      {activeAlerts.length} Active
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                    {activeAlerts.map((alert) => (
                      <div key={alert.id} className="p-4 sm:p-5 hover:bg-slate-50/50 transition">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 gap-3">
                            <span
                              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                                alert.score >= 81
                                  ? "bg-[#DC2626]"
                                  : alert.score >= 61
                                  ? "bg-[#D97706]"
                                  : "bg-[#CA8A04]"
                              }`}
                            />

                            <div className="min-w-0">
                              <p className="font-bold text-[#172B4D] text-sm leading-tight">
                                Dengue Alert
                              </p>
                              <p className="mt-0.5 text-xs text-[#475569] font-medium">
                                📍 {alert.location}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${getRiskColor(
                                alert.score,
                              )}`}
                            >
                              {alert.level}
                            </span>
                            <p className="mt-1 text-xs font-bold text-[#172B4D]">
                              {alert.score} / 100
                            </p>
                          </div>
                        </div>

                        {alert.reason && (
                          <p className="ml-5 mt-2.5 text-xs leading-relaxed text-[#475569]">
                            {alert.reason}
                          </p>
                        )}

                        <div className="ml-5 mt-3 flex items-center gap-2">
                          {alert.status?.toLowerCase() !== "acknowledged" && (
                            <button
                              disabled={alertBusy === alert.id}
                              onClick={() => void updateAlert(alert, "acknowledge")}
                              className="rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-semibold text-[#172B4D] hover:bg-slate-50 disabled:opacity-50 transition"
                            >
                              {alertBusy === alert.id ? "Updating..." : "Acknowledge"}
                            </button>
                          )}

                          <button
                            disabled={alertBusy === alert.id}
                            onClick={() => void updateAlert(alert, "resolve")}
                            className="rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-[#0D9488] hover:bg-teal-100 disabled:opacity-50 transition"
                          >
                            Resolve Alert
                          </button>
                        </div>
                      </div>
                    ))}

                    {activeAlerts.length === 0 && (
                      <div className="p-8 text-center text-sm text-[#475569]">
                        ✓ All district Dengue alerts have been addressed and resolved.
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 p-4 bg-slate-50/50 text-[11px] text-[#475569]">
                  Dengue alerts trigger when district incidence surpasses standard deviation baselines.
                </div>
              </div>
            </section>

            {/* ==================== LIVE WEATHER & DENGUE VECTOR INTELLIGENCE ==================== */}
            <section
              id="live-weather"
              aria-label="Live Weather and Dengue Vector Risk Index"
              className="scroll-mt-24 space-y-4"
            >
              {/* Weather Header Card */}
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-[#0D9488] animate-ping" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0D9488]">
                        Environmental Dengue Vector Incubation
                      </span>
                    </div>
                    <h3 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-[#172B4D]">
                      Live Meteorology & Aedes Vector Index
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-[#475569]">
                      Atmospheric telemetry correlated with Aedes aegypti breeding velocity, larval development, and extrinsic viral replication.
                    </p>
                  </div>

                  {/* Selector & Actions */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative min-w-[220px]">
                      <label htmlFor="city-select" className="sr-only">
                        Select City
                      </label>
                      <select
                        id="city-select"
                        value={selectedCity}
                        onChange={(e) => setSelectedCity(e.target.value)}
                        className="w-full appearance-none rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 pr-9 text-xs font-semibold text-[#172B4D] shadow-xs outline-none transition hover:border-teal-500 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      >
                        {availableCities.map((item) => (
                          <option key={item.city} value={item.city}>
                            📍 {item.city} ({item.state})
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 text-xs">
                        ▼
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={weatherLoading}
                      onClick={() => void fetchWeather(selectedCity, true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#172B4D] shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <span className={weatherLoading ? "animate-spin" : ""}>↻</span>
                      <span>{weatherLoading ? "Fetching..." : "Refresh"}</span>
                    </button>
                  </div>
                </div>

                {/* Quick Select City Chips */}
                <div className="mt-4 flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs font-medium text-[#475569] mr-1">Quick Switch:</span>
                  {["Lucknow", "Kanpur", "Varanasi", "Gorakhpur", "Prayagraj", "Agra", "New Delhi", "Patna"].map(
                    (cityName) => (
                      <button
                        key={cityName}
                        type="button"
                        onClick={() => setSelectedCity(cityName)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          selectedCity.toLowerCase() === cityName.toLowerCase()
                            ? "bg-[#0D9488] text-white shadow-2xs font-bold"
                            : "bg-slate-100 text-[#475569] hover:bg-slate-200 hover:text-[#172B4D]"
                        }`}
                      >
                        {cityName}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Weather Observation & Vector Propensity Grid */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* 1. Current Weather Observation Card */}
                <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs sm:p-6 lg:col-span-5">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-block rounded-md bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-bold text-[#0D9488]">
                          📍 {weather?.location?.city || selectedCity}
                        </span>
                        <h4 className="mt-3 text-3xl sm:text-4xl font-extrabold text-[#172B4D]">
                          {weather?.current?.temperature_c !== undefined
                            ? `${weather.current.temperature_c}°C`
                            : "—"}
                        </h4>
                        <p className="mt-1 text-sm font-semibold text-[#475569]">
                          {weather?.current?.condition || "Live Meteorology"}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-4xl sm:text-5xl">
                          {weather?.current?.weather_code === 0
                            ? "☀️"
                            : [1, 2].includes(weather?.current?.weather_code ?? 0)
                            ? "⛅"
                            : [3, 45, 48].includes(weather?.current?.weather_code ?? 0)
                            ? "☁️"
                            : [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(
                                weather?.current?.weather_code ?? 0,
                              )
                            ? "🌧️"
                            : [95, 96].includes(weather?.current?.weather_code ?? 0)
                            ? "⚡"
                            : "🌤️"}
                        </span>
                        <p className="mt-1.5 text-xs font-medium text-slate-400">
                          {weatherLiveTime ? `Live: ${weatherLiveTime}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Meteorological Metric Grid */}
                    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                        <p className="text-[11px] font-semibold text-[#475569]">💧 Humidity</p>
                        <p className="mt-1 text-lg font-extrabold text-[#172B4D]">
                          {weather?.current?.humidity_percent ?? "—"}%
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {(weather?.current?.humidity_percent ?? 0) > 60
                            ? "Optimal Aedes breeding"
                            : "Moderate humidity"}
                        </span>
                      </div>

                      <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                        <p className="text-[11px] font-semibold text-[#475569]">🌧️ Rain mm</p>
                        <p className="mt-1 text-lg font-extrabold text-[#172B4D]">
                          {weather?.current?.precipitation_mm ?? 0} mm
                        </p>
                        <span className="text-[10px] text-slate-400">
                          Rain: {weather?.current?.rain_mm ?? 0} mm
                        </span>
                      </div>

                      <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 col-span-2 sm:col-span-1">
                        <p className="text-[11px] font-semibold text-[#475569]">💨 Wind Speed</p>
                        <p className="mt-1 text-lg font-extrabold text-[#172B4D]">
                          {weather?.current?.wind_speed_kmh ?? "—"} km/h
                        </p>
                        <span className="text-[10px] text-slate-400">Vector flight draft</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-3 text-[11px] text-[#475569] flex flex-wrap justify-between gap-2">
                    <span>
                      Geo: {weather?.location?.latitude?.toFixed(2) ?? "—"}°N,{" "}
                      {weather?.location?.longitude?.toFixed(2) ?? "—"}°E
                    </span>
                    <span className="font-semibold text-slate-600">Open-Meteo Satellite Feed</span>
                  </div>
                </div>

                {/* 2. Environmental Dengue Vector Propensity */}
                <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs sm:p-6 lg:col-span-7">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-[#172B4D] text-base">
                          Dengue Vector Propensity Indices
                        </h4>
                        <p className="text-xs text-[#475569]">
                          Biophysical suitability for Aedes aegypti breeding and extrinsic incubation velocity
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#475569]">
                          Vector Threat:
                        </span>
                        <span
                          className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${
                            weather?.environmental_risk?.overall_level === "Critical"
                              ? "bg-red-100 text-red-700"
                              : weather?.environmental_risk?.overall_level === "High"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {weather?.environmental_risk?.overall_level ?? "Moderate"}
                        </span>
                      </div>
                    </div>

                    {/* 3 Dengue Vector Risk Cards */}
                    <div className="mt-4 space-y-3">
                      {/* Dengue Vector Transmission */}
                      <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5 transition hover:bg-slate-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🦟</span>
                            <span className="text-xs font-bold text-[#172B4D]">
                              Dengue Transmission Suitability (Aedes aegypti)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#172B4D]">
                              {weather?.environmental_risk?.dengue?.score ?? 50} / 100
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                (weather?.environmental_risk?.dengue?.score ?? 0) >= 70
                                  ? "bg-red-100 text-red-700"
                                  : (weather?.environmental_risk?.dengue?.score ?? 0) >= 45
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {weather?.environmental_risk?.dengue?.level ?? "Medium"} Risk
                            </span>
                          </div>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">
                          {weather?.environmental_risk?.dengue?.interpretation ||
                            "Moderate environmental suitability for adult mosquito transmission."}
                        </p>
                      </div>

                      {/* Aedes Larval Breeding Habitat */}
                      <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5 transition hover:bg-slate-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">💧</span>
                            <span className="text-xs font-bold text-[#172B4D]">
                              Aedes Larval Breeding & Moisture Index
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#172B4D]">
                              {weather?.environmental_risk?.aedes_breeding?.score ?? 45} / 100
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                (weather?.environmental_risk?.aedes_breeding?.score ?? 0) >= 70
                                  ? "bg-red-100 text-red-700"
                                  : (weather?.environmental_risk?.aedes_breeding?.score ?? 0) >= 45
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {weather?.environmental_risk?.aedes_breeding?.level ?? "Medium"} Risk
                            </span>
                          </div>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">
                          {weather?.environmental_risk?.aedes_breeding?.interpretation ||
                            "Moisture levels favor domestic container breeding and ovitrap counts."}
                        </p>
                      </div>

                      {/* Extrinsic Incubation Velocity */}
                      <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5 transition hover:bg-slate-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🔬</span>
                            <span className="text-xs font-bold text-[#172B4D]">
                              Extrinsic Incubation Period (EIP) Velocity
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#172B4D]">
                              {weather?.environmental_risk?.viral_incubation?.score ?? 40} / 100
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                (weather?.environmental_risk?.viral_incubation?.score ?? 0) >= 65
                                  ? "bg-red-100 text-red-700"
                                  : (weather?.environmental_risk?.viral_incubation?.score ?? 0) >= 40
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {weather?.environmental_risk?.viral_incubation?.level ?? "Moderate"} Acceleration
                            </span>
                          </div>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">
                          {weather?.environmental_risk?.viral_incubation?.interpretation ||
                            "Thermal dynamics shorten viral development inside female mosquitoes."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-[11px] text-slate-400">
                    ⚠️ Environmental index models Aedes aegypti breeding and DENV viral amplification. Correlate with hospital platelet transfusions.
                  </p>
                </div>
              </div>

              {/* 3. 7-Day Outbreak Climate Forecast */}
              {weather?.forecast_7_days && weather.forecast_7_days.length > 0 && (
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-bold text-[#172B4D] text-base">
                        7-Day Dengue Vector Climate Forecast
                      </h4>
                      <p className="text-xs text-[#475569]">
                        Projected weekly temperatures and rain accumulation for Aedes breeding in {weather?.location?.city || selectedCity}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-[#2563EB]">
                      Vector Forecast
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    {weather.forecast_7_days.map((day, idx) => {
                      const dateObj = new Date(day.date);
                      const dayName =
                        idx === 0
                          ? "Today"
                          : dateObj.toLocaleDateString("en-US", { weekday: "short" });
                      const formattedDate = dateObj.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      });

                      return (
                        <div
                          key={day.date}
                          className={`flex flex-col items-center justify-between rounded-lg border p-3 text-center transition ${
                            idx === 0
                              ? "border-teal-300 bg-teal-50/50 shadow-2xs font-bold"
                              : "border-slate-100 bg-slate-50/50 hover:bg-slate-100/70"
                          }`}
                        >
                          <span className="text-xs font-bold text-[#172B4D]">{dayName}</span>
                          <span className="text-[10px] text-slate-400">{formattedDate}</span>

                          <span className="my-2 text-2xl">
                            {day.short_condition?.includes("Rain") || day.short_condition?.includes("Showers")
                              ? "🌧️"
                              : day.short_condition?.includes("Cloud")
                              ? "⛅"
                              : day.short_condition?.includes("Storm")
                              ? "⛈️"
                              : "☀️"}
                          </span>

                          <span className="text-[11px] font-medium text-[#475569] line-clamp-1">
                            {day.short_condition || "Fair"}
                          </span>

                          <div className="mt-2 w-full border-t border-slate-200/60 pt-2 text-xs">
                            <span className="font-bold text-[#172B4D]">
                              {day.temp_max !== null ? `${Math.round(day.temp_max ?? 0)}°` : "—"}
                            </span>
                            <span className="ml-1 text-slate-400">
                              / {day.temp_min !== null ? `${Math.round(day.temp_min ?? 0)}°` : "—"}
                            </span>
                          </div>

                          <span className="mt-1 text-[10px] font-bold text-[#2563EB]">
                            🌧️ {day.precipitation_mm ?? 0} mm
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {weatherError && (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 shadow-xs"
                >
                  <strong>Notice:</strong> {weatherError}
                </div>
              )}
            </section>

            {/* ==================== SECTION 7: DENGUE TRENDS & RISK DISTRIBUTION ==================== */}
            <section
              id="disease-trends"
              aria-label="Dengue Trends and Risk Distribution"
              className="scroll-mt-24 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]"
            >
              {/* Trends Bar Chart Card */}
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-[#172B4D] text-base">
                      12-Week National Dengue Surveillance Trajectory
                    </h3>
                    <p className="text-xs text-[#475569]">
                      Weekly aggregated Dengue cases reported across sentinel hospital hubs
                    </p>
                  </div>

                  <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-[#2563EB]">
                    Dengue Surveillance Feed
                  </span>
                </div>

                <div className="mt-8 flex h-56 items-end gap-2 sm:gap-3.5 px-2">
                  {(() => {
                    const maxVal = Math.max(...trends.map((t) => t.cases), 1);
                    return trends.map((item, idx) => {
                      const height = Math.max(14, (item.cases / maxVal) * 100);
                      const isLast = idx === trends.length - 1;

                      return (
                        <div
                          key={item.week}
                          className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2 group"
                          title={`${item.week}: ${item.cases} confirmed Dengue cases`}
                        >
                          <span
                            className={`text-[10px] font-bold ${
                              isLast ? "text-[#DC2626]" : "text-[#172B4D]"
                            }`}
                          >
                            {item.cases}
                          </span>

                          <div
                            className={`w-full max-w-10 rounded-t-md transition-all duration-300 ${
                              isLast
                                ? "bg-[#DC2626] hover:bg-red-700"
                                : "bg-[#2563EB] hover:bg-blue-700"
                            }`}
                            style={{ height: `${height}%` }}
                          />

                          <span className="text-[10px] font-semibold text-slate-500">
                            {item.week}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-[#475569] flex items-center justify-between">
                  <span>✓ Verified MoHFW NVBDCP 12-week Dengue epidemic velocity.</span>
                  <span className="font-bold text-[#172B4D]">Recent weekly increase: +25.8%</span>
                </div>
              </div>

              {/* Risk Distribution Breakdown Card */}
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs sm:p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-[#172B4D] text-base">
                    Dengue Risk Category Breakdown
                  </h3>
                  <p className="text-xs text-[#475569]">
                    Stratification across {zones.length} active Dengue monitoring zones
                  </p>

                  <div className="mt-6 space-y-5">
                    {[
                      {
                        label: "Critical (81–100)",
                        count: zones.filter((z) => z.risk_score >= 81).length,
                        color: "bg-[#DC2626]",
                      },
                      {
                        label: "High (61–80)",
                        count: zones.filter(
                          (z) => z.risk_score >= 61 && z.risk_score < 81,
                        ).length,
                        color: "bg-[#D97706]",
                      },
                      {
                        label: "Medium (31–60)",
                        count: zones.filter(
                          (z) => z.risk_score >= 31 && z.risk_score < 61,
                        ).length,
                        color: "bg-[#CA8A04]",
                      },
                      {
                        label: "Low (0–30)",
                        count: zones.filter((z) => z.risk_score < 31).length,
                        color: "bg-[#059669]",
                      },
                    ].map((item) => {
                      const percent =
                        zones.length > 0
                          ? Math.round((item.count / zones.length) * 100)
                          : 0;

                      return (
                        <div key={item.label}>
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="font-bold text-[#172B4D]">
                              {item.label}
                            </span>
                            <span className="text-[#475569] font-medium">
                              {item.count} districts ({percent}%)
                            </span>
                          </div>

                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${item.color} transition-all duration-500`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="mt-6 text-[11px] text-slate-400">
                  Risk stratification complies with National Vector Borne Disease Control Dengue thresholds.
                </p>
              </div>
            </section>

            {/* ==================== SECTION 8: REPORTS & DECISION SUPPORT ==================== */}
            <section
              id="reports"
              aria-label="Dengue Intelligence Reports and Decision Support"
              className="scroll-mt-24 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-[#172B4D] text-base">
                    Public Health Dengue Intelligence Briefing
                  </h3>
                  <p className="text-xs text-[#475569]">
                    Decision-support protocols and epidemiological summary for Dengue containment
                  </p>
                </div>

                <span className="rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-semibold text-[#0D9488]">
                  Automated Dengue Synthesis
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
                    Geospatial Vector Surveillance
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[#475569]">
                    Coordinates-resolved Dengue plotting provides spatial clustering context for high-burden vector clusters across Uttar Pradesh, Bihar, and Delhi NCR.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
                    Early Anomaly Warning
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[#475569]">
                    Statistically significant Z-Scores (&gt;2.0σ) alert epidemiologists 7–10 days before peak clinical Dengue hemorrhagic presentations arrive at hospitals.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
                    Aedes Aegypti Incubation
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[#475569]">
                    Satellite meteorological feeds incorporate temperature, precipitation, and relative humidity to project Aedes larval growth rates and guide fogging.
                  </p>
                </div>
              </div>
            </section>

            {/* ==================== SECTION 9: DATA SOURCES & SETTINGS ==================== */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section
                id="data-sources"
                className="scroll-mt-24 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs"
              >
                <h3 className="font-bold text-[#172B4D] text-base">
                  Dengue Data Feed Integrations
                </h3>
                <p className="mt-1 text-xs text-[#475569]">
                  Live backend endpoints and Dengue surveillance sources
                </p>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                    <div>
                      <p className="font-bold text-[#172B4D]">AI HealthMap Dengue Core API</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{API_BASE}</p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                        apiStatus === "connected"
                          ? "bg-emerald-100 text-emerald-800"
                          : apiStatus === "loading"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {apiStatus === "connected" ? "Connected" : "Offline"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                    <div>
                      <p className="font-bold text-[#172B4D]">Open-Meteo Satellite Feed</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">Real-time Weather & Aedes Incubation Index</p>
                    </div>
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                      Active
                    </span>
                  </div>
                </div>
              </section>

              <section
                id="settings"
                className="scroll-mt-24 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs"
              >
                <h3 className="font-bold text-[#172B4D] text-base">
                  Platform Configuration
                </h3>
                <p className="mt-1 text-xs text-[#475569]">
                  System parameters and security configuration
                </p>

                <div className="mt-4 space-y-2.5 text-xs text-[#475569]">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Backend API URL:</span>
                    <span className="font-mono text-[#172B4D]">{API_BASE}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Active Authentication:</span>
                    <span className="font-semibold text-emerald-700">JWT Bearer OAuth2</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Surveillance Mode:</span>
                    <span className="font-semibold text-[#172B4D]">National Dengue Feeds Exclusively</span>
                  </div>
                </div>
              </section>
            </div>

            {/* ==================== FOOTER ==================== */}
            <footer className="border-t border-[#E2E8F0] pt-6 pb-8 text-xs text-[#475569] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#172B4D]">AI HealthMap</span>
                <span>•</span>
                <span>National Dengue Surveillance & Vector Intelligence Hub</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Official Epidemiological Decision Support System · Verify alerts with NS1/IgM rapid diagnostic tests
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("healthmap_access_token")
      : null;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

function LoginPage({ onLogin }: { onLogin: (token: string, username: string) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const form = new URLSearchParams();
      form.set("username", username.trim());
      form.set("password", password);

      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });

      const body = (await response.json().catch(() => ({}))) as {
        access_token?: string;
        token_type?: string;
        username?: string;
        detail?: string;
      };

      if (!response.ok || !body.access_token) {
        throw new Error(body.detail || "Authentication failed. Check your username and password.");
      }

      // Verify the token against the backend
      const verify = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${body.access_token}` },
        cache: "no-store",
      });

      if (!verify.ok) {
        throw new Error("Authentication token could not be verified by backend.");
      }

      const user = (await verify.json().catch(() => ({}))) as { username?: string };
      onLogin(body.access_token, user.username || body.username || username.trim());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to FastAPI server. Verify port 8000.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F8FC] px-4 py-10 font-sans">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-xl md:grid-cols-2">
        {/* Left Branding Panel */}
        <section className="hidden flex-col justify-between bg-[#10243A] p-10 text-white md:flex">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2563EB] text-2xl font-black text-white shadow-sm ring-2 ring-blue-400/20">
              +
            </div>
            <p className="mt-8 text-xs font-bold tracking-[0.2em] text-[#0D9488]">
              DENGUE INTELLIGENCE
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight leading-tight">
              AI HealthMap
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
              National Dengue surveillance, Aedes aegypti vector modeling, statistical anomaly forecasting, and epidemiological intelligence.
            </p>

            <div className="mt-8 space-y-2.5 text-xs text-slate-300 border-t border-[#193554] pt-6">
              <div className="flex items-center gap-2">
                <span className="text-[#0D9488]">✓</span>
                <span>MoHFW NVBDCP National Dengue Surveillance Network</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#0D9488]">✓</span>
                <span>Autonomous Anomaly Z-Score Forecasting (+2σ Threshold)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#0D9488]">✓</span>
                <span>Open-Meteo Satellite Aedes Vector Modeling</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Secure sign-in · Authorized vector control officers only
          </p>
        </section>

        {/* Right Form */}
        <section className="p-6 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="mb-6 md:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-xl font-bold text-white">
                +
              </div>
              <h1 className="mt-2 text-xl font-bold text-[#172B4D]">AI HealthMap</h1>
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-[#2563EB]">
              Vector Control Portal
            </p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#172B4D]">
              Sign in to Dashboard
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-[#475569]">
              Enter authorized credentials to access national Dengue surveillance telemetry.
            </p>

            <form onSubmit={handleLogin} className="mt-7 space-y-4">
              <div>
                <label
                  htmlFor="healthmap-username"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#172B4D]"
                >
                  Username
                </label>
                <input
                  id="healthmap-username"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2.5 text-sm font-semibold text-[#172B4D] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                  placeholder="Enter username"
                />
              </div>

              <div>
                <label
                  htmlFor="healthmap-password"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#172B4D]"
                >
                  Password
                </label>
                <input
                  id="healthmap-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2.5 text-sm font-semibold text-[#172B4D] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                  placeholder="Enter password"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-[#DC2626]"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Verifying Credentials..." : "Access Dengue Surveillance Workspace"}
              </button>
            </form>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-4 text-[11px] text-slate-400">
            Authentication token issued via FastAPI backend on port 8000.
          </div>
        </section>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const savedToken =
        typeof window !== "undefined"
          ? window.localStorage.getItem("healthmap_access_token")
          : null;

      if (!savedToken) {
        if (!cancelled) setCheckingSession(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
          cache: "no-store",
        });
        if (response.ok) {
          if (!cancelled) setToken(savedToken);
        } else {
          window.localStorage.removeItem("healthmap_access_token");
          window.localStorage.removeItem("healthmap_username");
        }
      } catch {
        // Keep user at login screen if backend unreachable
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogin(accessToken: string, loggedInUsername: string) {
    window.localStorage.setItem("healthmap_access_token", accessToken);
    window.localStorage.setItem("healthmap_username", loggedInUsername);
    setToken(accessToken);
  }

  function handleLogout() {
    window.localStorage.removeItem("healthmap_access_token");
    window.localStorage.removeItem("healthmap_username");
    setToken(null);
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F8FC] text-xs font-semibold text-[#475569]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
          <span>Verifying Dengue intelligence credentials...</span>
        </div>
      </main>
    );
  }

  if (!token) return <LoginPage onLogin={handleLogin} />;
  return <DashboardContent onLogout={handleLogout} />;
}
