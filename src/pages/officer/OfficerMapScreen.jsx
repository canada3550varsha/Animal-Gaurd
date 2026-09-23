import { Fragment } from "react";
import { MapContainer, TileLayer, Marker, Circle, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import AppShell from "../../components/ui/AppShell.jsx";
import { RING_INNER_KM, RING_OUTER_KM } from "../../api/clustering.js";
import { useOfficerData } from "./useOfficerData.js";

const farmMarker = L.divIcon({
  className: "",
  html: '<div style="font-size:20px;text-align:center">📍</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

export default function OfficerMapScreen() {
  const o = useOfficerData();

  return (
    <AppShell title="Outbreak Map" subtitle="Critical 1km / 5km containment rings · in-jurisdiction farms">
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Outbreak Map</h2>
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" /> Critical</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" /> 1km/5km ring</span>
            </div>
          </div>
          <MapContainer center={[18.456, 73.888]} zoom={13} style={{ height: "max(320px, 55vh)", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {o.farms.map((f) => (
              <Marker key={f.farm_id} position={[f.lat, f.lng]} icon={farmMarker} />
            ))}
            {o.criticalClusters.map((cluster) => (
              <Fragment key={cluster.id}>
                <Circle
                  center={[cluster.centroid.lat, cluster.centroid.lng]}
                  radius={RING_INNER_KM * 1000}
                  pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.1, weight: 2 }}
                />
                <Circle
                  center={[cluster.centroid.lat, cluster.centroid.lng]}
                  radius={RING_OUTER_KM * 1000}
                  pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.05, weight: 1.5, dashArray: "6 4" }}
                />
                <CircleMarker
                  center={[cluster.centroid.lat, cluster.centroid.lng]}
                  radius={7}
                  pathOptions={{ color: "#dc2626", fillColor: "#dc2626", fillOpacity: 1, weight: 1 }}
                />
              </Fragment>
            ))}
          </MapContainer>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Active clusters</h2>
          {o.clusters.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 border border-gray-100">No clusters currently above threshold.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {o.clusters.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-2xl p-4 border ${
                    c.level === "critical" ? "border-2 border-red-600 bg-red-50" : "border border-amber-400 bg-amber-50"
                  }`}
                >
                  <p className={`font-bold ${c.level === "critical" ? "text-red-800" : "text-amber-800"}`}>
                    {c.level === "critical" ? "🚨 CRITICAL" : "⚠️ EMERGING"} — {c.village}
                  </p>
                  <p className="text-sm mt-0.5 text-gray-700">
                    {c.report_count} reports · {c.farm_count} farms · {o.kindLabel(c.animal_category)}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Centroid {c.centroid.lat.toFixed(4)}, {c.centroid.lng.toFixed(4)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}