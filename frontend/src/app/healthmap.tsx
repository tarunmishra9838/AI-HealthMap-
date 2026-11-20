"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import {
  ShieldAlert,
  Activity,
  Droplets,
  Thermometer,
  Layers,
  Crosshair,
  ArrowRight,
} from "./icons";

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

type HealthMapProps = {
  zones: RiskZone[];
  compact?: boolean;
  selectedLocation?: string;
  onSelectLocation?: (location: string) => void;
};

const CITY_COORDINATES: Record<string, [number, number]> = {
  lucknow: [26.8467, 80.9462],
  kanpur: [26.4499, 80.3319],
  varanasi: [25.3176, 82.9739],
  prayagraj: [25.4358, 81.8463],
  allahabad: [25.4358, 81.8463],
  agra: [27.1767, 78.0081],
  meerut: [28.9845, 77.7064],
  gorakhpur: [26.7606, 83.3732],
  ayodhya: [26.7922, 82.1998],
  noida: [28.5355, 77.391],
  ghaziabad: [28.6692, 77.4538],
  "new delhi": [28.6139, 77.209],
  delhi: [28.6139, 77.209],
  patna: [25.5941, 85.1376],
  mumbai: [19.076, 72.8777],
  bengaluru: [12.9716, 77.5946],
  kolkata: [22.5726, 88.3639],
  jaipur: [26.9124, 75.7873],
  hyderabad: [17.385, 78.4867],
  chennai: [13.0827, 80.2707],
};

function findCoordinates(zone: RiskZone): [number, number] | null {
  if (
    typeof zone.latitude === "number" &&
    typeof zone.longitude === "number" &&
    !Number.isNaN(zone.latitude) &&
    !Number.isNaN(zone.longitude)
  ) {
    return [zone.latitude, zone.longitude];
  }

  const key = zone.location
    .trim()
    .toLowerCase()
    .split(",")[0]
    .trim();

  return CITY_COORDINATES[key] ?? null;
}

function markerColor(score: number): string {
  if (score >= 80) return "#dc2626"; // Critical
  if (score >= 60) return "#ea580c"; // High / Warning
  if (score >= 35) return "#d97706"; // Medium
  return "#059669"; // Controlled
}

function cleanEncoding(str?: string): string {
  if (!str) return "";
  return str.replace(/AC/g, "°C").replace(/Â°C/g, "°C").replace(/Â/g, "");
}

function MapResizeHandler() {
  const map = useMap();
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const container = map.getContainer();

    const resizeMap = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = requestAnimationFrame(() => {
        map.invalidateSize({ pan: false, animate: false });
        frameRef.current = null;
      });
    };

    resizeMap();

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        resizeMap();
      });
      observer.observe(container);
      if (container.parentElement) {
        observer.observe(container.parentElement);
      }
    }

    window.addEventListener("resize", resizeMap);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resizeMap);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [map]);

  return null;
}

function MapFocusController({ targetCoords }: { targetCoords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (targetCoords) {
      map.flyTo(targetCoords, 9, { duration: 1.2 });
    }
  }, [map, targetCoords]);
  return null;
}

export default function HealthMap({
  zones,
  compact = false,
  selectedLocation,
  onSelectLocation,
}: HealthMapProps) {
  const [tileSource, setTileSource] = useState<"carto" | "osm">("carto");

  const points = useMemo(() => {
    return zones
      .map((zone, index) => ({
        zone,
        index,
        coordinates: findCoordinates(zone),
      }))
      .filter(
        (
          item
        ): item is {
          zone: RiskZone;
          index: number;
          coordinates: [number, number];
        } => item.coordinates !== null
      );
  }, [zones]);

  const selectedCoords = useMemo(() => {
    if (!selectedLocation) return null;
    const clean = selectedLocation.trim().toLowerCase().split(",")[0].trim();
    const match = points.find(
      (p) => p.zone.location.trim().toLowerCase().split(",")[0].trim() === clean
    );
    return match ? match.coordinates : null;
  }, [points, selectedLocation]);

  const center: LatLngExpression = [26.8, 80.9];

  return (
    <div
      className="relative isolate h-full min-h-[400px] w-full overflow-hidden rounded-xl bg-slate-100 border border-slate-200 shadow-xs"
      style={{ minHeight: compact ? 340 : 480 }}
    >
      {/* Top Map HUD overlay */}
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 shadow-xs backdrop-blur-sm">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
        </span>
        <span className="text-[11px] font-semibold text-slate-700 tracking-tight">
          GIS SURVEILLANCE RADAR · {points.length} SENTINEL STATIONS
        </span>
      </div>

      {/* Layer Toggle Button */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-xs backdrop-blur-sm text-xs">
        <button
          type="button"
          onClick={() => setTileSource("carto")}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition ${
            tileSource === "carto"
              ? "bg-blue-600 text-white shadow-2xs font-bold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
          title="Clinical High-Contrast Carto Map"
        >
          <Layers size={13} />
          <span>Carto</span>
        </button>
        <button
          type="button"
          onClick={() => setTileSource("osm")}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition ${
            tileSource === "osm"
              ? "bg-blue-600 text-white shadow-2xs font-bold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
          title="OpenStreetMap Standard Map"
        >
          <span>OSM</span>
        </button>
      </div>

      <MapContainer
        center={center}
        zoom={6}
        minZoom={4}
        maxZoom={18}
        scrollWheelZoom
        preferCanvas
        className="healthmap-leaflet"
        style={{
          height: "100%",
          width: "100%",
          minHeight: compact ? 340 : 480,
          background: "#F1F5F9",
        }}
      >
        <MapResizeHandler />
        <MapFocusController targetCoords={selectedCoords} />

        {tileSource === "carto" ? (
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            maxZoom={19}
            keepBuffer={3}
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            keepBuffer={3}
          />
        )}

        {points.map(({ zone, index, coordinates }) => {
          const isCritical = zone.risk_score >= 80;
          const isHigh = zone.risk_score >= 60 && zone.risk_score < 80;
          const isSelected =
            selectedLocation &&
            zone.location.toLowerCase().includes(selectedLocation.toLowerCase());

          return (
            <Fragment key={`${zone.location}-${zone.disease}-${index}`}>
              {/* Outer pulsing ring for critical / selected hotspots */}
              {(isCritical || isSelected) && (
                <CircleMarker
                  center={coordinates}
                  radius={isCritical ? 18 : 14}
                  pathOptions={{
                    color: isCritical ? "#dc2626" : "#2563eb",
                    weight: 1.5,
                    opacity: 0.5,
                    fillColor: isCritical ? "#ef4444" : "#3b82f6",
                    fillOpacity: 0.15,
                  }}
                />
              )}

              {/* Core Sentinel Marker */}
              <CircleMarker
                center={coordinates}
                radius={isCritical ? 10 : isHigh ? 8 : 7}
                pathOptions={{
                  color: "#ffffff",
                  weight: 2,
                  fillColor: markerColor(zone.risk_score),
                  fillOpacity: 0.95,
                }}
              >
                <Popup className="healthmap-custom-popup">
                  <div className="w-[260px] p-1 font-sans text-slate-800">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            SENTINEL ID #{100 + index}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 leading-snug">
                          {zone.location}
                        </h4>
                        {zone.state && (
                          <p className="text-[11px] text-slate-500 font-medium">
                            {zone.state} Division
                          </p>
                        )}
                      </div>
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-bold font-mono text-white shadow-xs shrink-0"
                        style={{ backgroundColor: markerColor(zone.risk_score) }}
                      >
                        {zone.risk_score}% RISK
                      </span>
                    </div>

                    {/* Clinical Indices */}
                    <div className="mt-2.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                        <span className="text-slate-500 text-[11px]">Outbreak Likelihood:</span>
                        <span className="font-mono font-bold text-rose-600">
                          {zone.outbreak_probability || `${zone.risk_score}%`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                        <span className="text-slate-500 text-[11px]">Regional Caseload Share:</span>
                        <span className="font-mono font-semibold text-blue-700">
                          {zone.caseload_share || (zone.caseload_share_pct ? `${zone.caseload_share_pct}%` : "—")}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                        <span className="text-slate-500 text-[11px]">Weekly Velocity Surge:</span>
                        <span className="font-mono font-semibold text-amber-700">
                          {zone.case_surge || (zone.growth_rate_pct ? `+${zone.growth_rate_pct}%` : "—")}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                        <span className="text-slate-500 text-[11px]">Test Positivity (TPR):</span>
                        <span className="font-mono font-bold text-slate-800">
                          {zone.test_positivity || (zone.test_positivity_pct ? `${zone.test_positivity_pct}%` : "10.5%")}
                        </span>
                      </div>

                      {(zone.live_temp || zone.live_humidity) && (
                        <div className="mt-2 rounded bg-slate-50 border border-slate-200/80 p-2 text-[11px] text-slate-600 flex items-center justify-between font-mono">
                          <span className="flex items-center gap-1 text-slate-500">
                            <Thermometer size={12} /> Climate
                          </span>
                          <span className="font-bold text-slate-800">
                            {cleanEncoding(zone.live_temp)} · {cleanEncoding(zone.live_humidity)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action trigger */}
                    {onSelectLocation && (
                      <button
                        type="button"
                        onClick={() => onSelectLocation(zone.location)}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 active:scale-98"
                      >
                        <Crosshair size={13} />
                        <span>Inspect District Dossier</span>
                        <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            </Fragment>
          );
        })}
      </MapContainer>

      {/* Floating Legend HUD */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] max-w-[280px] rounded-xl border border-slate-200/90 bg-white/95 p-3 text-xs text-slate-700 shadow-md backdrop-blur-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-[10px] tracking-wider text-slate-500 font-bold uppercase">
          <span>SURVEILLANCE SEVERITY</span>
          <span className="text-emerald-700 font-bold">● LIVE TELEMETRY</span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#dc2626]" />
            <span className="text-slate-800 font-medium">Critical (≥80%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#ea580c]" />
            <span className="text-slate-800 font-medium">High (60–79%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#d97706]" />
            <span className="text-slate-800 font-medium">Medium (35–59%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#059669]" />
            <span className="text-slate-800 font-medium">Controlled (&lt;35%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
