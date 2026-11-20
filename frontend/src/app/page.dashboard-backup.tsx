"use client";

import { useState } from "react";

const stats = [
  {
    title: "Total Cases",
    value: "12,846",
    change: "+8.4%",
    note: "vs last week",
    icon: "▣",
  },
  {
    title: "Active Alerts",
    value: "18",
    change: "+3",
    note: "need attention",
    icon: "!",
  },
  {
    title: "High Risk Areas",
    value: "07",
    change: "+2",
    note: "this week",
    icon: "⌖",
  },
  {
    title: "Risk Score",
    value: "64",
    change: "Medium",
    note: "overall level",
    icon: "◈",
  },
];

const alerts = [
  {
    disease: "Dengue",
    location: "Lucknow",
    score: 86,
    level: "Critical",
    reason: "Cases significantly above historical baseline",
  },
  {
    disease: "Dengue",
    location: "Kanpur",
    score: 72,
    level: "High",
    reason: "Rapid increase detected in recent reports",
  },
  {
    disease: "Dengue",
    location: "Varanasi",
    score: 61,
    level: "High",
    reason: "Unusual activity across nearby locations",
  },
];

const trendData = [42, 48, 45, 58, 55, 67, 64, 74, 69, 82, 78, 88];

export default function Home() {
  const [activeNav, setActiveNav] = useState("Dashboard");

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-[250px] flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-lg font-bold text-white">
              H
            </div>

            <div>
              <h1 className="text-[17px] font-bold tracking-tight">
                AI HealthMap
              </h1>
              <p className="text-[11px] font-medium text-slate-400">
                HEALTH INTELLIGENCE
              </p>
            </div>
          </div>

          <div className="px-4 py-6">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Overview
            </p>

            <nav className="space-y-1">
              {[
                ["Dashboard", "⌂"],
                ["Health Map", "⌖"],
                ["Disease Trends", "⌁"],
                ["Alerts", "!"],
                ["Reports", "▤"],
              ].map(([name, icon]) => (
                <button
                  key={name}
                  onClick={() => setActiveNav(name)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    activeNav === name
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-base">
                    {icon}
                  </span>
                  {name}
                </button>
              ))}
            </nav>

            <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              System
            </p>

            <nav className="space-y-1">
              {[
                ["Data Sources", "◫"],
                ["Settings", "⚙"],
              ].map(([name, icon]) => (
                <button
                  key={name}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg text-base">
                    {icon}
                  </span>
                  {name}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-auto border-t border-slate-100 p-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-800">
                Decision Support
              </p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                AI signals require human investigation.
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <section className="min-w-0 flex-1">
          {/* Header */}
          <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
            <div>
              <p className="text-xs font-medium text-slate-400">
                Health Intelligence Platform
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">
                Disease Surveillance
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <button className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm sm:block">
                Last 7 days ▾
              </button>

              <button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm">
                ♢
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
              </button>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                TA
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
            {/* Welcome */}
            <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-400">
                  Wednesday, October 7, 2026
                </p>
                <h3 className="text-3xl font-bold tracking-tight text-slate-950">
                  Good morning, Analyst
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Here&apos;s the latest disease activity across monitored
                  locations.
                </p>
              </div>

              <button className="w-fit rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800">
                + Upload Health Data
              </button>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      {stat.title}
                    </p>

                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                      {stat.icon}
                    </span>
                  </div>

                  <div className="mt-5 flex items-end gap-3">
                    <p className="text-3xl font-bold tracking-tight">
                      {stat.value}
                    </p>

                    <span className="mb-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-600">
                      {stat.change}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-400">{stat.note}</p>
                </div>
              ))}
            </div>

            {/* Main Grid */}
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
              {/* Map */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 p-5">
                  <div>
                    <h4 className="font-bold text-slate-900">
                      Health Risk Map
                    </h4>
                    <p className="mt-1 text-xs text-slate-400">
                      Current disease activity by location
                    </p>
                  </div>

                  <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                    View full map →
                  </button>
                </div>

                <div className="relative h-[390px] overflow-hidden bg-[#eef2f5]">
                  {/* Map background */}
                  <div className="absolute inset-0 opacity-50">
                    <div className="h-full w-full bg-[linear-gradient(#d7dde3_1px,transparent_1px),linear-gradient(90deg,#d7dde3_1px,transparent_1px)] bg-[size:45px_45px]" />
                  </div>

                  {/* India-like map silhouette */}
                  <div className="absolute left-1/2 top-1/2 h-[270px] w-[230px] -translate-x-1/2 -translate-y-1/2 rotate-[7deg] rounded-[45%_55%_45%_50%] border-[25px] border-slate-300 bg-slate-200/70 shadow-inner" />

                  {/* Risk points */}
                  <div className="absolute left-[48%] top-[32%]">
                    <span className="absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-red-400/20" />
                    <span className="relative flex h-4 w-4 rounded-full border-2 border-white bg-red-500 shadow-lg" />
                  </div>

                  <div className="absolute left-[42%] top-[52%]">
                    <span className="absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400/20" />
                    <span className="relative flex h-4 w-4 rounded-full border-2 border-white bg-orange-500 shadow-lg" />
                  </div>

                  <div className="absolute left-[58%] top-[59%]">
                    <span className="absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-400/20" />
                    <span className="relative flex h-4 w-4 rounded-full border-2 border-white bg-yellow-500 shadow-lg" />
                  </div>

                  <div className="absolute left-[35%] top-[68%]">
                    <span className="relative flex h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-lg" />
                  </div>

                  {/* Map labels */}
                  <div className="absolute left-[51%] top-[26%] rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-bold shadow-md">
                    Lucknow · 86
                  </div>

                  <div className="absolute left-[45%] top-[57%] rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-bold shadow-md">
                    Kanpur · 72
                  </div>

                  <div className="absolute bottom-5 left-5 rounded-xl border border-white/70 bg-white/90 p-3 shadow-sm backdrop-blur">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Risk level
                    </p>
                    <div className="flex gap-3 text-[10px] font-semibold text-slate-600">
                      <span>● Low</span>
                      <span>● Medium</span>
                      <span>● High</span>
                      <span>● Critical</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 p-5">
                  <div>
                    <h4 className="font-bold">Priority Alerts</h4>
                    <p className="mt-1 text-xs text-slate-400">
                      Conditions requiring attention
                    </p>
                  </div>

                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">
                    18 active
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {alerts.map((alert) => (
                    <div key={alert.disease} className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            <h5 className="text-sm font-bold">
                              {alert.disease}
                            </h5>
                          </div>

                          <p className="mt-2 text-xs text-slate-400">
                            {alert.location}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xl font-bold">{alert.score}</p>
                          <p className="text-[10px] font-bold uppercase text-red-500">
                            {alert.level}
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        {alert.reason}
                      </p>

                      <button className="mt-4 text-xs font-bold text-slate-900 hover:underline">
                        Investigate alert →
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 p-4">
                  <button className="w-full rounded-xl bg-slate-50 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100">
                    View all alerts
                  </button>
                </div>
              </div>
            </div>

            {/* Analytics */}
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold">Disease Activity Trend</h4>
                    <p className="mt-1 text-xs text-slate-400">
                      Weekly reported cases across monitored areas
                    </p>
                  </div>

                  <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600">
                    +14.8%
                  </span>
                </div>

                <div className="mt-8 flex h-[220px] items-end gap-2 sm:gap-4">
                  {trendData.map((height, index) => (
                    <div
                      key={index}
                      className="group flex h-full flex-1 flex-col justify-end"
                    >
                      <div className="relative flex flex-1 items-end">
                        <div
                          className="w-full rounded-t-md bg-slate-900 transition-all group-hover:bg-slate-700"
                          style={{ height: `${height}%` }}
                        />
                      </div>

                      <p className="mt-3 text-center text-[9px] font-medium text-slate-400">
                        W{index + 1}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Insight */}
              <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg">
                    ✦
                  </div>
                  <div>
                    <p className="text-sm font-bold">AI Intelligence</p>
                    <p className="text-[10px] text-slate-400">
                      Latest analytical signal
                    </p>
                  </div>
                </div>

                <div className="mt-7">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Key finding
                  </p>

                  <h4 className="mt-3 text-xl font-bold leading-8">
                    Activity in Lucknow is significantly above the historical
                    baseline.
                  </h4>

                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    Recent case growth and nearby activity are contributing to
                    the elevated risk signal.
                  </p>
                </div>

                <div className="mt-7 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      Current risk score
                    </span>
                    <span className="text-lg font-bold">86 / 100</span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[86%] rounded-full bg-white" />
                  </div>
                </div>

                <p className="mt-5 text-[10px] leading-4 text-slate-500">
                  AI output is an investigation signal and does not confirm an
                  outbreak.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 flex flex-col justify-between gap-3 border-t border-slate-200 pt-5 text-[11px] text-slate-400 sm:flex-row">
              <p>AI HealthMap · Disease & Outbreak Intelligence Platform</p>
              <p>Decision support system · Human investigation required</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}