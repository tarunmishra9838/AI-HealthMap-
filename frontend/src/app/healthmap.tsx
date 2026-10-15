
"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";

type RiskZone = {
  location: string;
  disease: string;
  risk_score: number;
  risk_level: string;
};

type HealthMapProps = {
  zones: RiskZone[];
  compact?: boolean;
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
};

function findCoordinates(
  location: string
): [number, number] | null {
  const key = location
    .trim()
    .toLowerCase()
    .split(",")[0]
    .trim();

  return CITY_COORDINATES[key] ?? null;
}

function markerColor(score: number): string {
  if (score >= 81) return "#dc2626";
  if (score >= 61) return "#ea580c";
  if (score >= 31) return "#ca8a04";
  return "#16a34a";
}

/*
  Resize the map only when its container changes size.
  No repeating timer or state update: this avoids
  unnecessary map redraws and visible flickering.
*/
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

export default function HealthMap({
  zones,
  compact = false,
}: HealthMapProps) {
  const points = useMemo(() => {
    return zones
      .map((zone, index) => ({
        zone,
        index,
        coordinates: findCoordinates(zone.location),
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

  const center: LatLngExpression = [26.8, 80.9];

  return (
    <div
      className="relative isolate h-full min-h-[320px] w-full overflow-hidden rounded-xl bg-slate-100"
      style={{ minHeight: compact ? 320 : 420 }}
    >
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
          minHeight: compact ? 320 : 420,
          background: "#e8eef2",
        }}
      >
        <MapResizeHandler />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          keepBuffer={3}
          updateWhenIdle
        />

        {points.map(({ zone, index, coordinates }) => (
          <CircleMarker
            key={`${zone.location}-${zone.disease}-${index}`}
            center={coordinates}
            radius={compact ? 7 : 9}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: markerColor(zone.risk_score),
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <div className="min-w-[150px] text-sm text-slate-900">
                <strong className="text-base">
                  {zone.location}
                </strong>
                <p className="mt-2">
                  Disease: {zone.disease}
                </p>
                <p>
                  Risk score: {zone.risk_score}/100
                </p>
                <p>
                  Risk level: {zone.risk_level}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Verify risk signals against official health data.
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] max-w-[90%] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-sm">
        <p className="font-semibold">Disease Risk Map</p>
        <p className="mt-1">
          {points.length} mapped location
          {points.length === 1 ? "" : "s"}
        </p>
        {points.length < zones.length && (
          <p className="mt-1 text-amber-700">
            Some locations have no configured city coordinates.
          </p>
        )}
        <p className="mt-1 text-[10px] text-slate-500">
          OpenStreetMap contributors
        </p>
      </div>
    </div>
  );
}
