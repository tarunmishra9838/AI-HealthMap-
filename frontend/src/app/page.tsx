"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import "leaflet/dist/leaflet.css";

const HealthMap = dynamic(() => import("./healthmap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">
      Loading health map...
    </div>
  ),
});

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type RiskZone = {
  id?: number | string;
  location: string;
  disease: string;
  risk_score: number;
  risk_level: string;
};

type HealthAlert = {
  id: number | string;
  disease: string;
  location: string;
  score: number;
  level: string;
  reason?: string;
  status?: string;
  created_at?: string;
};

type Summary = {
  total_cases?: number;
  active_alerts?: number;
  high_risk_areas?: number;
  average_risk_score?: number;
  avg_risk_score?: number;
  risk_score?: number;
};

type Trend = {
  week: string;
  cases: number;
};

type ApiStatus = "loading" | "connected" | "error";

const demoZones: RiskZone[] = [
  {
    id: 1,
    location: "Lucknow",
    disease: "Dengue",
    risk_score: 86,
    risk_level: "Critical",
  },
  {
    id: 2,
    location: "Kanpur",
    disease: "Influenza",
    risk_score: 72,
    risk_level: "High",
  },
  {
    id: 3,
    location: "Varanasi",
    disease: "Malaria",
    risk_score: 61,
    risk_level: "High",
  },
  {
    id: 4,
    location: "Prayagraj",
    disease: "Dengue",
    risk_score: 58,
    risk_level: "Medium",
  },
];

const demoAlerts: HealthAlert[] = [
  {
    id: 1,
    disease: "Dengue",
    location: "Lucknow",
    score: 86,
    level: "Critical",
    reason: "Cases significantly above historical baseline",
    status: "New",
  },
  {
    id: 2,
    disease: "Influenza",
    location: "Kanpur",
    score: 72,
    level: "High",
    reason: "Rapid increase detected in recent reports",
    status: "Investigating",
  },
  {
    id: 3,
    disease: "Malaria",
    location: "Varanasi",
    score: 61,
    level: "High",
    reason: "Unusual activity across nearby locations",
    status: "Acknowledged",
  },
  {
    id: 4,
    disease: "Dengue",
    location: "Prayagraj",
    score: 58,
    level: "Medium",
    reason: "Recent activity is above the expected weekly range",
    status: "New",
  },
];

const demoTrends: Trend[] = [
  { week: "W1", cases: 42 },
  { week: "W2", cases: 48 },
  { week: "W3", cases: 45 },
  { week: "W4", cases: 58 },
  { week: "W5", cases: 55 },
  { week: "W6", cases: 67 },
  { week: "W7", cases: 64 },
  { week: "W8", cases: 74 },
  { week: "W9", cases: 69 },
  { week: "W10", cases: 82 },
  { week: "W11", cases: 78 },
  { week: "W12", cases: 88 },
];

const navigation = [
  { label: "Dashboard", icon: "▦", id: "dashboard" },
  { label: "Health Map", icon: "◎", id: "health-map" },
  { label: "Disease Trends", icon: "↗", id: "disease-trends" },
  { label: "Alerts", icon: "◉", id: "alerts" },
  { label: "Reports", icon: "▤", id: "reports" },
  { label: "Data Sources", icon: "◈", id: "data-sources" },
  { label: "Settings", icon: "⚙", id: "settings" },
];

function getRiskColor(score: number) {
  if (score >= 81) return "bg-red-100 text-red-700";
  if (score >= 61) return "bg-orange-100 text-orange-700";
  if (score >= 31) return "bg-yellow-100 text-yellow-800";
  return "bg-green-100 text-green-700";
}

function getRiskLabel(score: number) {
  if (score >= 81) return "Critical";
  if (score >= 61) return "High";
  if (score >= 31) return "Medium";
  return "Low";
}

function formatNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN");
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", {
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

      return {
        id: String(item.id ?? index),
        location: String(item.location ?? item.location_name ?? "Unknown"),
        disease: String(item.disease ?? "Unspecified"),
        risk_score: Number.isFinite(score) ? score : 0,
        risk_level: String(
          item.risk_level ?? item.level ?? getRiskLabel(score),
        ),
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
        disease: String(item.disease ?? "Unknown disease"),
        location: String(item.location ?? "Unknown location"),
        score: Number.isFinite(score) ? score : 0,
        level: String(item.level ?? item.severity ?? getRiskLabel(score)),
        reason: String(item.reason ?? "No explanation provided"),
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
  iconClass,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function DashboardContent({ onLogout }: { onLogout: () => void }) {
  const [currentDate, setCurrentDate] = useState("");
  const [activeNav, setActiveNav] = useState("Dashboard");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [zones, setZones] = useState<RiskZone[]>(demoZones);
  const [alerts, setAlerts] = useState<HealthAlert[]>(demoAlerts);
  const [trends] = useState<Trend[]>(demoTrends);

  const [apiStatus, setApiStatus] = useState<ApiStatus>("loading");
  const [usingDemo, setUsingDemo] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState(false);

  const [alertBusy, setAlertBusy] = useState<string | number | null>(null);
  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    const updateDate = () => setCurrentDate(formatDate(new Date()));

    updateDate();
    const timer = window.setInterval(updateDate, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const loadDashboard = useCallback(async () => {
    setApiStatus("loading");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

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
      ]);

      let anySuccess = false;

      const summaryResult = results[0];
      if (
        summaryResult.status === "fulfilled" &&
        summaryResult.value.ok
      ) {
        const body = (await summaryResult.value.json()) as Summary;
        setSummary(body);
        anySuccess = true;
      }

      const zonesResult = results[1];
      if (
        zonesResult.status === "fulfilled" &&
        zonesResult.value.ok
      ) {
        const body: unknown = await zonesResult.value.json();
        const normalized = normalizeZones(body);

        if (normalized.length > 0) {
          setZones(normalized);
          anySuccess = true;
        }
      }

      const alertsResult = results[2];
      if (
        alertsResult.status === "fulfilled" &&
        alertsResult.value.ok
      ) {
        const body: unknown = await alertsResult.value.json();
        setAlerts(normalizeAlerts(body));
        anySuccess = true;
      }

      setApiStatus(anySuccess ? "connected" : "error");
      setUsingDemo(!anySuccess);
    } catch {
      setApiStatus("error");
      setUsingDemo(true);
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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
      zones.reduce((total, zone) => total + zone.risk_score, 0) /
        zones.length,
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

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadError(true);
      setUploadMessage("Please select a CSV file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setUploadMessage("");
    setUploadError(false);

    try {
      const response = await apiFetch(`${API_BASE}/api/cases/upload`, {
        method: "POST",
        body: formData,
      });

      const body = (await response.json().catch(() => ({}))) as {
        detail?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.detail || body.message || `Upload failed (${response.status})`,
        );
      }

      setUploadMessage(
        body.message || "File uploaded successfully. Refreshing dashboard...",
      );

      await loadDashboard();
    } catch (error) {
      setUploadError(true);
      setUploadMessage(
        error instanceof Error
          ? error.message
          : "Upload failed. Check the backend API.",
      );
    } finally {
      setUploading(false);
    }
  }

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
            ? "Alert resolved."
            : "Alert acknowledged."),
      );

      await loadDashboard();
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

    const target = document.getElementById(id);

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setAlertMessage(`${label} section is not available yet.`);
    }
  }

  return (
    <div
      id="dashboard"
      className="min-h-screen bg-slate-50 text-slate-800"
    >
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="border-b border-slate-100 px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-2xl text-white">
                +
              </div>

              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  AI HealthMap
                </h1>
                <p className="mt-0.5 text-[10px] font-semibold tracking-[0.16em] text-teal-700">
                  HEALTH INTELLIGENCE
                </p>
              </div>
            </div>
          </div>

          <div className="px-4 pt-6">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Workspace
            </p>

            <nav className="mt-3 space-y-1">
              {navigation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.label, item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                    activeNav === item.label
                      ? "bg-teal-50 text-teal-800"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="w-5 text-center text-lg">
                    {item.icon}
                  </span>
                  {item.label}
                  {item.label === "Alerts" && activeAlerts.length > 0 && (
                    <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                      {activeAlerts.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-auto border-t border-slate-100 p-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    apiStatus === "connected"
                      ? "bg-green-500"
                      : apiStatus === "loading"
                        ? "animate-pulse bg-amber-500"
                        : "bg-red-500"
                  }`}
                />
                <span className="text-sm font-semibold text-slate-700">
                  {apiStatus === "connected"
                    ? "API connected"
                    : apiStatus === "loading"
                      ? "Connecting API..."
                      : "API unavailable"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {usingDemo
                  ? "Some dashboard values may be demonstration data."
                  : "Dashboard data loaded from available API endpoints."}
              </p>
              <button
                onClick={() => void loadDashboard()}
                className="mt-3 text-xs font-semibold text-teal-700 hover:text-teal-900"
              >
                ↻ Refresh data
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-[600] border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 xl:px-8">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Health Intelligence Platform
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
                  Disease Surveillance
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-slate-800">
                    {currentDate || "Loading date..."}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Local system date
                  </p>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 sm:px-4">
                  <span className="text-lg">↑</span>
                  {uploading ? "Uploading..." : "Upload CSV"}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    disabled={uploading}
                    onChange={handleUpload}
                  />
                </label>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Log out
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden">
              {navigation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.label, item.id)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold ${
                    activeNav === item.label
                      ? "bg-teal-100 text-teal-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </header>

          <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 xl:p-8">
            <section className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-teal-700">
                  HEALTH OVERVIEW
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Good morning, Analyst
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Monitor disease activity, risk areas and public-health alerts.
                </p>
              </div>

              <button
                onClick={() => void loadDashboard()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                ↻ Refresh dashboard
              </button>
            </section>

            {uploadMessage && (
              <div
                role="status"
                className={`rounded-xl border px-4 py-3 text-sm ${
                  uploadError
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-green-200 bg-green-50 text-green-800"
                }`}
              >
                {uploadMessage}
              </div>
            )}

            {usingDemo && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <strong>Prototype data:</strong> Some values and trends may be
                demonstration data. Verify the backend response before using
                them for real public-health decisions.
              </div>
            )}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              <StatCard
                title="Total Cases"
                value={formatNumber(totalCases)}
                subtitle={
                  totalCases === undefined
                    ? "No verified summary available"
                    : "Reported cases in the API summary"
                }
                icon="▤"
                iconClass="bg-blue-50 text-blue-700"
              />

              <StatCard
                title="Active Alerts"
                value={formatNumber(alertCount)}
                subtitle="Alerts not marked as resolved"
                icon="⚑"
                iconClass="bg-red-50 text-red-700"
              />

              <StatCard
                title="High Risk Areas"
                value={formatNumber(highRiskCount)}
                subtitle="Risk score of 61 or above"
                icon="◎"
                iconClass="bg-orange-50 text-orange-700"
              />

              <StatCard
                title="Average Risk Score"
                value={riskScore === undefined ? "—" : `${riskScore}/100`}
                subtitle="Calculated from available risk zones"
                icon="⌁"
                iconClass="bg-teal-50 text-teal-700"
              />
            </section>

            <section
              id="health-map"
              className="scroll-mt-28 grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]"
            >
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Health Risk Map
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Interactive map with available location risk markers
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {zones.length} mapped locations
                  </span>
                </div>

                <div className="h-[390px] w-full sm:h-[440px]">
                  <HealthMap zones={zones} compact={false} />
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 px-5 py-4">
                  {[
                    { label: "Critical", color: "bg-red-500" },
                    { label: "High", color: "bg-orange-500" },
                    { label: "Medium", color: "bg-yellow-500" },
                    { label: "Low", color: "bg-green-500" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-2 text-xs text-slate-600"
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${item.color}`}
                      />
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Priority Alerts
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Locations requiring review
                    </p>
                  </div>

                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                    {activeAlerts.length} active
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {activeAlerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <span
                            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                              alert.score >= 81
                                ? "bg-red-500"
                                : alert.score >= 61
                                  ? "bg-orange-500"
                                  : "bg-yellow-500"
                            }`}
                          />

                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">
                              {alert.disease}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {alert.location}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${getRiskColor(
                              alert.score,
                            )}`}
                          >
                            {alert.level}
                          </span>
                          <p className="mt-2 text-sm font-bold text-slate-800">
                            {alert.score}/100
                          </p>
                        </div>
                      </div>

                      {alert.reason && (
                        <p className="ml-5 mt-3 text-xs leading-5 text-slate-500">
                          {alert.reason}
                        </p>
                      )}

                      <div className="ml-5 mt-3 flex flex-wrap gap-2">
                        {alert.status?.toLowerCase() !== "acknowledged" &&
                          alert.status?.toLowerCase() !== "investigating" && (
                            <button
                              disabled={alertBusy === alert.id}
                              onClick={() => void updateAlert(alert, "acknowledge")}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {alertBusy === alert.id
                                ? "Updating..."
                                : "Acknowledge"}
                            </button>
                          )}

                        <button
                          disabled={alertBusy === alert.id}
                          onClick={() => void updateAlert(alert, "resolve")}
                          className="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  ))}

                  {activeAlerts.length === 0 && (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No active alerts are available.
                    </div>
                  )}
                </div>

                {alertMessage && (
                  <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
                    {alertMessage}
                  </p>
                )}
              </div>
            </section>

            <section
              id="disease-trends"
              className="scroll-mt-28 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]"
            >
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Disease Trends
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Weekly sample trend · 12 periods
                    </p>
                  </div>

                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    Trend overview
                  </span>
                </div>

                <div className="mt-8 flex h-52 items-end gap-2 sm:gap-3">
                  {trends.map((item) => {
                    const height = Math.max(
                      8,
                      (item.cases / 100) * 100,
                    );

                    return (
                      <div
                        key={item.week}
                        className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                        title={`${item.week}: ${item.cases} sample cases`}
                      >
                        <span className="text-[10px] font-semibold text-slate-500 sm:text-xs">
                          {item.cases}
                        </span>

                        <div
                          className="w-full max-w-9 rounded-t-md bg-teal-500 transition-all hover:bg-teal-700"
                          style={{ height: `${height}%` }}
                        />

                        <span className="text-[9px] text-slate-400 sm:text-[10px]">
                          {item.week}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                  These bars use the prototype trend series. They will not
                  represent live case trends until a trend API is connected.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="font-bold text-slate-900">
                  Risk Distribution
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Based on the risk zones currently loaded
                </p>

                <div className="mt-6 space-y-5">
                  {[
                    {
                      label: "Critical",
                      count: zones.filter((z) => z.risk_score >= 81).length,
                      color: "bg-red-500",
                    },
                    {
                      label: "High",
                      count: zones.filter(
                        (z) => z.risk_score >= 61 && z.risk_score < 81,
                      ).length,
                      color: "bg-orange-500",
                    },
                    {
                      label: "Medium",
                      count: zones.filter(
                        (z) => z.risk_score >= 31 && z.risk_score < 61,
                      ).length,
                      color: "bg-yellow-500",
                    },
                    {
                      label: "Low",
                      count: zones.filter((z) => z.risk_score < 31).length,
                      color: "bg-green-500",
                    },
                  ].map((item) => {
                    const percent =
                      zones.length > 0
                        ? (item.count / zones.length) * 100
                        : 0;

                    return (
                      <div key={item.label}>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">
                            {item.label}
                          </span>
                          <span className="text-slate-500">
                            {item.count} areas
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${item.color}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section
              id="reports"
              className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">
                    AI Intelligence Summary
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Decision-support overview of current risk signals
                  </p>
                </div>

                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                  Analytics overview
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    Geographic monitoring
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    The map displays risk markers for locations available in
                    the current API response.
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    Alert review
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Review the disease, location, risk score and explanation
                    before taking action on an alert.
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    Early warning
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    An unusual pattern is a signal for investigation, not
                    confirmation of an outbreak.
                  </p>
                </div>
              </div>
            </section>

            <section
              id="data-sources"
              className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <h3 className="font-bold text-slate-900">Data Sources</h3>
              <p className="mt-1 text-sm text-slate-500">
                Current frontend and API connection status
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 p-4">
                <div>
                  <p className="font-semibold text-slate-800">
                    AI HealthMap FastAPI
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-500">
                    {API_BASE}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    apiStatus === "connected"
                      ? "bg-green-100 text-green-700"
                      : apiStatus === "loading"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {apiStatus === "connected"
                    ? "Connected"
                    : apiStatus === "loading"
                      ? "Connecting"
                      : "Unavailable"}
                </span>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                An available API response does not by itself mean the
                underlying health data is verified or real-time. Confirm the
                source and data status in the backend.
              </p>
            </section>

            <section
              id="settings"
              className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
              <h3 className="font-bold text-slate-900">Settings</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                The API address is currently configured using
                NEXT_PUBLIC_API_URL, with a local development default.
                Authentication and role-based settings require their backend
                endpoints to be implemented.
              </p>
            </section>

            <footer className="flex flex-col justify-between gap-2 border-t border-slate-200 py-5 text-xs text-slate-500 sm:flex-row">
              <p>AI HealthMap · Disease Surveillance Dashboard</p>
              <p>Decision support only · Verify alerts before action</p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("healthmap_access_token") : null;
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
        throw new Error(body.detail || "Login failed. Check your username and password.");
      }

      // Verify the token against the backend before opening the dashboard.
      const verify = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${body.access_token}` },
        cache: "no-store",
      });

      if (!verify.ok) {
        throw new Error("Login token could not be verified. Please try again.");
      }

      const user = (await verify.json().catch(() => ({}))) as { username?: string };
      onLogin(body.access_token, user.username || body.username || username.trim());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to the backend. Make sure the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-2">
        <section className="hidden flex-col justify-between bg-teal-700 p-10 text-white md:flex">
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-3xl font-bold">+</div>
            <p className="mt-8 text-sm font-semibold tracking-[0.2em] text-teal-100">HEALTH INTELLIGENCE</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight">AI HealthMap</h1>
            <p className="mt-4 max-w-sm leading-7 text-teal-50">
              Disease surveillance, geographic risk monitoring, and public-health alerts in one workspace.
            </p>
          </div>
          <p className="text-xs text-teal-100">Secure sign-in · Authorized users only</p>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mb-8 md:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-2xl text-white">+</div>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">AI HealthMap</h1>
          </div>
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">Admin Portal</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Sign in with your backend account to open the dashboard.</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label htmlFor="healthmap-username" className="mb-2 block text-sm font-semibold text-slate-700">Username</label>
              <input
                id="healthmap-username"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label htmlFor="healthmap-password" className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
              <input
                id="healthmap-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-teal-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in to Dashboard"}
            </button>
          </form>
          <p className="mt-6 text-xs leading-5 text-slate-400">
            Login is verified by the AI HealthMap backend. If sign-in fails, check the backend credentials and keep the API server running.
          </p>
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
      const savedToken = window.localStorage.getItem("healthmap_access_token");
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
        // Keep the user at the login screen if the backend is unreachable.
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogin(accessToken: string, username: string) {
    window.localStorage.setItem("healthmap_access_token", accessToken);
    window.localStorage.setItem("healthmap_username", username);
    setToken(accessToken);
  }

  function handleLogout() {
    window.localStorage.removeItem("healthmap_access_token");
    window.localStorage.removeItem("healthmap_username");
    setToken(null);
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-500">
        Checking your session...
      </main>
    );
  }

  if (!token) return <LoginPage onLogin={handleLogin} />;
  return <DashboardContent onLogout={handleLogout} />;
}
