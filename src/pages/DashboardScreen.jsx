import { Fragment, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Circle, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useApp } from "../context/AppContext.jsx";
import { ANIMAL_ICONS, CATEGORY_LABELS, SYMPTOMS } from "../data/constants.js";
import { recommendedAction, RING_INNER_KM, RING_OUTER_KM } from "../api/clustering.js";
import { fdrsBand } from "../api/agro.js";
import ImpactMetrics from "../components/ImpactMetrics.jsx";
import HealthPanel from "../components/HealthPanel.jsx";

const SYMPTOM_LABEL = Object.fromEntries(
  Object.values(SYMPTOMS)
    .flat()
    .map((s) => [s.id, s.label])
);

const farmMarker = L.divIcon({
  className: "",
  html: '<div style="font-size:20px;text-align:center">📍</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { reports, farms, clusters, criticalClusters, inbox, user, getFDRS, dispatchVet, sendAdvisory, lastSyncedAt, sensing } = useApp();

  // Feedback state for Dispatch Vet / Send Advisory so a click always shows
  // what happened (success badge updates via inbox; failures are shown, never silent).
  const [acting, setActing] = useState(null); // { id, kind } while a request is in flight
  const [actionErr, setActionErr] = useState("");

  const actOn = async (kind, cluster) => {
    if (acting) return;
    setActing({ id: cluster.id, kind });
    setActionErr("");
    try {
      const fn = kind === "dispatch" ? dispatchVet : sendAdvisory;
      await fn(cluster);
    } catch (e) {
      setActionErr(`${kind === "dispatch" ? "Dispatch" : "Advisory"} failed: ${e?.message || "server error"}`);
    } finally {
      setActing(null);
    }
  };

  // A "NEW" alert = a critical/emerging cluster that arrived after this screen
  // opened (live report -> next poll tick). Marking seen re-baselines it.
  const [seenAt, setSeenAt] = useState(() => Date.now());

  // Seconds since the last live sync (re-ticked every second so the label moves).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const syncedAgo = lastSyncedAt ? Math.max(0, Math.round((now - lastSyncedAt) / 1000)) : null;

  const farmById = useMemo(() => new Map(farms.map((f) => [f.farm_id, f])), [farms]);

  // "Routine" reports = those NOT part of any cluster at/above Emerging threshold.
  const clusteredReportIds = useMemo(() => {
    const ids = new Set();
    for (const c of clusters) for (const r of c.reports) ids.add(r.id);
    return ids;
  }, [clusters]);

  // Sort routine reports newest first, ignore seed routine entries with no live value.
  // "Manual Reports" section = farmer-submitted only; AI-sensed alerts live in their own
  // dedicated section so the two are never merged.
  const routineReports = useMemo(
    () =>
      reports
        .filter((r) => !clusteredReportIds.has(r.id) && r.source !== "ai_auto")
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [reports, clusteredReportIds]
  );

  // 🤖 AI Alerts — AI-sensed reports filed from the remote-sensing signal itself,
  // each linked to the exact sensing_readings row whose values pushed it over the
  // prediction trigger. Distinct from cluster alerts, which aggregate everything.
  const aiAlerts = useMemo(
    () =>
      reports
        .filter((r) => r.source === "ai_auto")
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [reports]
  );

  // Expand/collapse per AI alert to show the raw reading that triggered it.
  const [expandedReadingId, setExpandedReadingId] = useState(null);

  const kindLabel = (cat) => (cat === "poultry" ? "poultry" : "livestock");
  const iconFor = (report) =>
    ANIMAL_ICONS[report.animal_category]?.[report.animal_type] || "🐾";

  // Highest-severity cluster level (if any) for each farm.
  const clusterLevelByFarm = useMemo(() => {
    const ord = { critical: 0, emerging: 1 };
    const map = new Map();
    for (const c of clusters) {
      for (const fid of c.farms) {
        const cur = map.get(fid);
        if (!cur || ord[c.level] < ord[cur]) map.set(fid, c.level);
      }
    }
    return map;
  }, [clusters]);

  // Newest report per farm (for "affected now" + disease chips on farm rows).
  const latestReportByFarm = useMemo(() => {
    const map = new Map();
    for (const r of reports) {
      const cur = map.get(r.farm_id);
      if (!cur || new Date(r.created_at) > new Date(cur.created_at)) map.set(r.farm_id, r);
    }
    return map;
  }, [reports]);

  // Clusters a vet already responded to (dispatch/advisory messages exist in-scope).
  const dispatchedClusterIds = useMemo(() => {
    const s = new Set();
    for (const m of inbox) {
      if ((m.type === "vet" || m.type === "advisory") && m.cluster_id) s.add(m.cluster_id);
    }
    return s;
  }, [inbox]);

  const alerts = useMemo(
    () =>
      clusters
        .filter((c) => c.level === "critical" || c.level === "emerging")
        .slice()
        .sort((a, b) => b.report_count - a.report_count),
    [clusters]
  );

  const newAlerts = useMemo(
    () =>
      alerts.filter((c) => c.last_report_at && new Date(c.last_report_at).getTime() > seenAt),
    [alerts, seenAt]
  );

  // ⚰️ Structured-mortality stats from the deaths field on farmer reports.
  const mortality = useMemo(() => {
    const deaths = (r) => Number(r.deaths) || 0;
    const WITHIN = (r, days) => new Date(r.created_at).getTime() > now - days * 86400000;
    const in7 = reports.filter((r) => WITHIN(r, 7));
    const in14 = reports.filter((r) => WITHIN(r, 14));
    const totalDeaths = (list) => list.reduce((s, r) => s + deaths(r), 0);
    const totalAffected = (list) => list.reduce((s, r) => s + (Number(r.affected_count) || 0), 0);
    // Crude mortality rate = deaths / affected across reports that recorded deaths.
    const d = totalDeaths(in7);
    const a = totalAffected(in7.filter((r) => deaths(r) > 0));
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = dayStart.getTime() + 86400000;
      const count = in7
        .filter((r) => {
          const t = new Date(r.created_at).getTime();
          return t >= dayStart.getTime() && t < dayEnd;
        })
        .reduce((s, r) => s + deaths(r), 0);
      const label = dayStart.toLocaleDateString("en-IN", { weekday: "short" });
      trend.push({ label, count });
    }
    const byVillage = {};
    for (const r of in14) {
      const key = r.village || "Unknown";
      byVillage[key] = byVillage[key] || { village: key, deaths: 0, farms: new Set(), affected: 0 };
      byVillage[key].deaths += deaths(r);
      byVillage[key].farms.add(r.farm_id);
      byVillage[key].affected += Number(r.affected_count) || 0;
    }
    const villages = Object.values(byVillage)
      .map((v) => ({ ...v, farms: v.farms.size }))
      .filter((v) => v.deaths > 0)
      .sort((x, y) => y.deaths - x.deaths);
    const maxVillage = Math.max(1, ...villages.map((v) => v.deaths));
    const maxTrend = Math.max(1, ...trend.map((t) => t.count));
    return { d, a, rate: a ? Math.round((d / a) * 1000) / 10 : 0, trend, villages, maxVillage, maxTrend };
  }, [reports, now]);

  // id -> source for sensor-detected tagging on alerts.
  const reportSource = useMemo(() => {
    const map = {};
    for (const r of reports) map[r.id] = r.source || "farmer";
    return map;
  }, [reports]);

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-gray-900 text-white px-4 py-4 shadow-md">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-xl">←</button>
            <div>
              <h1 className="text-lg font-bold">
                {user?.role === "vet" ? "Veterinary Dashboard" : "Officer Dashboard"}
              </h1>
              <p className="text-xs text-gray-400">
                {user?.role === "vet" ? `${user.district || "District"} surveillance` : "District surveillance"} · {farms.length} farms in scope
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] text-green-300 bg-white/10 px-2 py-1 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              LIVE{typeof syncedAgo === "number" ? ` · ${syncedAgo}s` : ""}
            </span>
            <button
              onClick={() => navigate("/walkthrough")}
              className="text-xs bg-amber-500 hover:bg-amber-600 px-2.5 py-1.5 rounded-lg text-white font-medium transition-colors"
            >
              🎬 Walkthrough
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Live outbreak attention banner — appears within seconds of a farmer report */}
        {newAlerts.length > 0 && (
          <div className="bg-red-600 text-white rounded-2xl p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🆘</span>
                <div>
                  <p className="font-bold leading-tight">
                    {newAlerts.length} NEW OUTBREAK ALERT{newAlerts.length > 1 ? "S" : ""} DETECTED
                  </p>
                  <p className="text-xs mt-1 opacity-90">
                    Just received from live farmer reports — {newAlerts[0].village}, {newAlerts[0].report_count} case(s).
                    Review and respond below.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSeenAt(Date.now())}
                className="text-xs bg-white text-red-700 font-semibold px-3 py-1.5 rounded-full hover:bg-red-50 transition-colors shrink-0"
              >
                Mark seen
              </button>
            </div>
          </div>
        )}

        {/* Impact metrics */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Programme Impact</h2>
          <ImpactMetrics />
        </section>

        {/* ⚰️ Mortality rate & trend (structured deaths field) */}
        {mortality.d > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Mortality &amp; Trend (last 7 days)
            </h2>
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center justify-around gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold text-red-600">{mortality.d}</p>
                  <p className="text-[10px] text-gray-500">deaths (7d)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{mortality.rate}%</p>
                  <p className="text-[10px] text-gray-500">crude mortality rate</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{Math.max(mortality.a, mortality.d)}</p>
                  <p className="text-[10px] text-gray-500">affected, deaths reported</p>
                </div>
              </div>

              {/* 7-day trend */}
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-gray-500 mb-2">Daily deaths — 7-day trend</p>
                <div className="flex items-end gap-1.5 h-20">
                  {mortality.trend.map((t, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-gray-700">
                        {t.count > 0 ? t.count : ""}
                      </span>
                      <div
                        className={`w-full rounded-t ${
                          t.count === 0 ? "h-1 bg-gray-100" : t.count >= mortality.maxTrend ? "bg-red-500" : "bg-orange-400"
                        }`}
                        style={{ height: `${t.count === 0 ? 4 : Math.max(8, (t.count / mortality.maxTrend) * 64)}px` }}
                      />
                      <span className="text-[9px] text-gray-400">{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-village deaths */}
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-gray-500 mb-2">Deaths by village (14d)</p>
                <div className="space-y-2">
                  {mortality.villages.map((v) => (
                    <div key={v.village}>
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="text-gray-700 font-medium truncate">
                          {v.village} · {v.farms} farm{v.farms !== 1 ? "s" : ""}
                        </span>
                        <span className="text-gray-500">{v.deaths} dead</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${v.deaths >= mortality.maxVillage ? "bg-red-500" : "bg-orange-400"}`}
                          style={{ width: `${(v.deaths / mortality.maxVillage) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 💉 Vaccination & treatment health ledger (vet records; farms + audit reflect instantly) */}
        <HealthPanel />

        {/* 📡 Live Sensing Data — raw, plain, always-on. Pure readings, no risk coloring. */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            📡 Live Sensing Data
          </h2>
          <p className="text-[11px] text-gray-500 bg-white border border-gray-100 rounded-xl px-3 py-2 mb-3 leading-snug">
            One raw row per farm per Agro poll (satellite NDVI + soil temperature + soil moisture), captured regardless of whether any alert fires. Shown as-is — no risk interpretation.
          </p>
          <div className="space-y-2">
            {sensing.length === 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4 text-sm text-gray-500">
                Awaiting the first Agro poll for in-scope farms…
              </div>
            )}
            {sensing.map(({ farm, reading }) => (
              <div key={farm.farm_id} className="bg-white rounded-xl border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{farm.name}</p>
                    <p className="text-xs text-gray-500">
                      {CATEGORY_LABELS[farm.animal_category]} · {farm.village}, {farm.taluka}
                    </p>
                  </div>
                  {reading ? (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                        reading.fetch_status === "success"
                          ? "bg-green-600 text-white"
                          : reading.fetch_status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {reading.fetch_status === "success"
                        ? "● LIVE"
                        : reading.fetch_status === "pending"
                          ? "PENDING — no fresh pass"
                          : "FETCH FAILED"}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold shrink-0">
                      NO READING YET
                    </span>
                  )}
                </div>
                {reading ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 mt-2.5">
                      <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                        <p className="text-[10px] text-gray-400 font-medium uppercase">NDVI</p>
                        <p className="text-sm font-semibold text-gray-800">{fmtNum(reading.ndvi)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                        <p className="text-[10px] text-gray-400 font-medium uppercase">Soil temp</p>
                        <p className="text-sm font-semibold text-gray-800">{fmtCel(reading.soil_temp)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                        <p className="text-[10px] text-gray-400 font-medium uppercase">Soil moisture</p>
                        <p className="text-sm font-semibold text-gray-800">{fmtMoisture(reading.soil_moisture)}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      Reading {reading.id} · {formatTime(reading.fetched_at)}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 mt-2">No reading yet — waiting for the first satellite pass.</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 🤖 AI Alerts — only shown when the sensing AI actually fired an alert. */}
        {aiAlerts.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              🤖 AI Alerts ({aiAlerts.length})
            </h2>
            <p className="text-[11px] text-gray-500 bg-white border border-gray-100 rounded-xl px-3 py-2 mb-3 leading-snug">
              Filed automatically by the disease-prediction AI from remote-sensing data (not typed by anyone). Expand any alert to see the exact raw sensing values that triggered it.
            </p>
            <div className="space-y-2">
              {aiAlerts.map((alert) => {
                const f = farmById.get(alert.farm_id);
                const sr = alert.sensing_reading || null;
                const expanded = expandedReadingId === alert.id;
                return (
                  <div key={alert.id} className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-indigo-900 flex items-center gap-1.5 flex-wrap">
                          🤖 {f?.name || alert.farm_id}
                          <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium">
                            AI Alert
                          </span>
                        </p>
                        <p className="text-xs text-indigo-800 mt-0.5">
                          {alert.village}, {alert.district} · {alert.affected_count || 0} predicted affected ·{" "}
                          {formatTime(alert.created_at)}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 mt-2 leading-snug">{alert.notes}</p>
                    {(alert.symptoms || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {alert.symptoms.map((s) => (
                          <span key={s} className="bg-white text-indigo-700 px-2 py-0.5 rounded-full text-[10px]">
                            {SYMPTOM_LABEL[s] || s}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setExpandedReadingId(expanded ? null : alert.id)}
                      className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${expanded ? "text-indigo-900" : "text-indigo-700"} hover:underline`}
                    >
                      {expanded ? "▾ Hide source sensing data" : "▸ View source sensing data"}
                      {sr && <span className="text-[10px] font-normal text-indigo-400">({sr.id})</span>}
                    </button>
                    {expanded && (
                      <div className="mt-2 bg-white rounded-xl border border-indigo-100 p-3">
                        {sr ? (
                          <>
                            <p className="text-[10px] text-gray-400 uppercase font-medium mb-1.5">
                              Source sensing reading · {formatTime(sr.fetched_at)}
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                                <p className="text-[10px] text-gray-400 font-medium uppercase">NDVI</p>
                                <p className="text-sm font-semibold text-gray-800">{fmtNum(sr.ndvi)}</p>
                              </div>
                              <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                                <p className="text-[10px] text-gray-400 font-medium uppercase">Soil temp</p>
                                <p className="text-sm font-semibold text-gray-800">{fmtCel(sr.soil_temp)}</p>
                              </div>
                              <div className="bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                                <p className="text-[10px] text-gray-400 font-medium uppercase">Soil moisture</p>
                                <p className="text-sm font-semibold text-gray-800">{fmtMoisture(sr.soil_moisture)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-2">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                  sr.fetch_status === "success"
                                    ? "bg-green-600 text-white"
                                    : sr.fetch_status === "pending"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-red-100 text-red-700"
                                }`}
                              >
                                {sr.fetch_status.toUpperCase()}
                              </span>
                              <span className="text-[10px] text-gray-400">row {sr.id}</span>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-gray-500">Source sensing_data unavailable for this alert.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Outbreak map */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Outbreak Map</h2>
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" /> Critical</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" /> 1km/5km ring</span>
            </div>
          </div>
          <MapContainer center={[18.456, 73.888]} zoom={13} style={{ height: 280, width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {farms.map((f) => (
              <Marker key={f.farm_id} position={[f.lat, f.lng]} icon={farmMarker} />
            ))}
            {criticalClusters.map((cluster) => (
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

        {/* Active alerts (critical + emerging) with response status */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Alerts / Notifications ({alerts.length})
            {newAlerts.length > 0 && (
              <span className="ml-2 text-[11px] text-red-600 bg-red-100 px-2 py-0.5 rounded-full normal-case">
                {newAlerts.length} new
              </span>
            )}
          </h2>
          {actionErr && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2">{actionErr}</p>}
          {alerts.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-green-800 text-sm">
              ✅ No active alerts. All reports within normal parameters.
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((cluster) => {
                const dispatched = dispatchedClusterIds.has(cluster.id);
                const critical = cluster.level === "critical";
                const isNew = cluster.last_report_at && new Date(cluster.last_report_at).getTime() > seenAt;
                const autoDetected = cluster.reports
                  ? cluster.reports.some((rid) => reportSource[rid] === "ai_auto")
                  : false;
                return (
                  <div
                    key={cluster.id}
                    className={`rounded-2xl p-4 border ${
                      critical ? "border-2 border-red-600 bg-red-50" : "border border-amber-400 bg-amber-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`font-bold ${critical ? "text-red-800" : "text-amber-800"}`}>
                          {critical ? "🚨 CRITICAL" : "⚠️ EMERGING"} — {cluster.village}
                          {autoDetected && (
                            <span className="ml-2 inline-block bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full align-middle">
                              🛰️ sensor-detected
                            </span>
                          )}
                          {isNew && (
                            <span className="ml-2 inline-block bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full align-middle">
                              🆕 NEW
                            </span>
                          )}
                        </p>
                        <p className={`text-sm mt-0.5 ${critical ? "text-red-700" : "text-amber-700"}`}>
                          {cluster.report_count} report(s) · {cluster.farm_count} farm(s) ·{" "}
                          {cluster.affected_animals ?? 0} affected animals · {kindLabel(cluster.animal_category)}
                        </p>
                        {(cluster.symptoms || []).length > 0 && (
                          <p className="text-xs mt-1 text-gray-600">
                            Signs: {cluster.symptoms.map((s) => SYMPTOM_LABEL[s] || s).join(", ")}
                          </p>
                        )}
                        {cluster.last_report_at && (
                          <p className="text-[10px] text-gray-500 mt-1">Last report {formatTime(cluster.last_report_at)}</p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full font-semibold shrink-0 ${
                          dispatched ? "bg-green-600 text-white" : "bg-white text-red-700 border border-red-600"
                        }`}
                      >
                        {dispatched ? "✅ RESPONDED" : critical ? "OPEN" : "MONITOR"}
                      </span>
                    </div>
                    {!dispatched && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => actOn("dispatch", cluster)}
                          disabled={acting !== null}
                          className="flex-1 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {acting?.id === cluster.id && acting.kind === "dispatch" ? "Sending…" : "🐮 Dispatch Vet"}
                        </button>
                        <button
                          onClick={() => actOn("advisory", cluster)}
                          disabled={acting !== null}
                          className="flex-1 py-2 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {acting?.id === cluster.id && acting.kind === "advisory" ? "Sending…" : "📢 Send Advisory"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CRITICAL OUTBREAK banners */}
        {criticalClusters.map((cluster) => {
          const kind = kindLabel(cluster.animal_category);
          const dispatched = dispatchedClusterIds.has(cluster.id);
          return (
            <div key={cluster.id} className="border-2 border-red-600 bg-red-50 rounded-2xl p-4">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-2xl">🚨</span>
                <h2 className="font-bold text-red-800 text-lg leading-tight">
                  CRITICAL OUTBREAK: {cluster.report_count} cases across {cluster.farm_count}{" "}
                  {kind} farms in {cluster.village}
                </h2>
              </div>
              <p className="text-sm text-red-800 mb-2">
                {cluster.affected_animals ?? 0} affected animals
                {(cluster.symptoms || []).length > 0 && (
                  <span> · Signs: {cluster.symptoms.map((s) => SYMPTOM_LABEL[s] || s).join(", ")}</span>
                )}
              </p>
              <p className="text-sm text-red-800 mb-3">
                Recommended: <span className="font-medium">{recommendedAction(cluster)}</span>
              </p>
              {dispatched && (
                <p className="text-xs text-green-700 bg-green-100 rounded-lg px-2 py-1 mb-3">
                  ✅ Vet already dispatched for this cluster
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => actOn("dispatch", cluster)}
                  disabled={acting !== null}
                  className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {acting?.id === cluster.id && acting.kind === "dispatch" ? "Sending…" : "🐮 Dispatch Vet"}
                </button>
                <button
                  onClick={() => actOn("advisory", cluster)}
                  disabled={acting !== null}
                  className="flex-1 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {acting?.id === cluster.id && acting.kind === "advisory" ? "Sending…" : "📢 Send Advisory"}
                </button>
              </div>
            </div>
          );
        })}

        {/* District farm status board */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            District Farms — risk & emergency status
          </h2>
          <div className="space-y-2">
            {farms.map((farm) => {
              const fdrs = getFDRS(farm);
              const band = fdrs ? fdrsBand(fdrs.total) : fdrsBand(0);
              const level = clusterLevelByFarm.get(farm.farm_id) || "normal";
              const latest = latestReportByFarm.get(farm.farm_id);
              const emoji = ANIMAL_ICONS[farm.animal_category]?.[farm.animal_type] || "🐾";
              return (
                <button
                  key={farm.farm_id}
                  onClick={() => {
                    console.log("farm:click", farm.farm_id);
                    navigate(`/farm/${farm.farm_id}`);
                  }}
                  className="w-full text-left bg-white rounded-xl border border-gray-100 p-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{farm.name}</p>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            level === "critical"
                              ? "bg-red-600 text-white"
                              : level === "emerging"
                                ? "bg-amber-400 text-amber-900"
                                : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {level === "critical" ? "🚨 CRITICAL" : level === "emerging" ? "⚠️ EMERGING" : "normal"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {CATEGORY_LABELS[farm.animal_category]} · {farm.village} · herd {farm.herd_size}
                      </p>
                      {latest && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            {latest.affected_count || 0} affected
                          </span>
                          {(Number(latest.deaths) || 0) > 0 && (
                            <span className="text-[10px] font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                              ⚰️ {latest.deaths}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 truncate">
                            {(latest.symptoms || []).map((s) => SYMPTOM_LABEL[s] || s).slice(0, 2).join(", ")} · {formatTime(latest.created_at)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${band.bg} ${band.text}`}>
                        FDRS {fdrs?.total ?? "--"}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">{band.label} risk</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 📝 Manual Reports — farmer-submitted only (voice or typing) */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-3">
            📝 Manual Reports <span className="text-sm font-normal text-gray-400">({routineReports.length})</span>
          </h2>
          <p className="text-[11px] text-gray-500 bg-white border border-gray-100 rounded-xl px-3 py-2 mb-3 leading-snug">
            <span className="font-semibold text-gray-700">✍️ Manual</span> = reported by the farmer (voice or typing). AI-detected alerts live in the separate <span className="font-semibold text-indigo-700">🤖 AI Alerts</span> section above.
          </p>
          {routineReports.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-4xl mb-2">📄</p>
              <p>No manual reports yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {routineReports.map((report) => {
                const f = farmById.get(report.farm_id);
                return (
                  <div key={report.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-start gap-3">
                    <span className="text-2xl">{iconFor(report)}</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{f?.name || report.farm_name}</p>
                      <p className="text-xs text-gray-500">
                        {CATEGORY_LABELS[report.animal_category]} · {report.village}, {report.district}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {report.source === "ai_auto" ? (
                          <span className="inline-block bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-medium">
                            🛰️ AI-sensed (auto)
                          </span>
                        ) : (
                          <span className="inline-block bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[10px] font-medium">
                            ✍️ Manual (farmer)
                          </span>
                        )}
                        {(report.symptoms || []).map((s) => (
                          <span key={s} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px]">
                            {SYMPTOM_LABEL[s] || s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatTime(report.created_at)} · {report.affected_count || 0} affected
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

// ---- Live-sensing formatters (plain numbers; Kelvin surfaces only) ----
function fmtNum(v) {
  return typeof v === "number" ? Number(v).toFixed(3) : "—";
}
function fmtCel(v) {
  if (typeof v !== "number") return "—";
  const c = v > 150 ? v - 273.15 : v; // remote sensors return Kelvin soil/air temps
  return `${c.toFixed(1)}°C`;
}
function fmtMoisture(v) {
  if (typeof v !== "number") return "—";
  // volumetric fraction (0..1) from the soil probe -> readout as %
  const pct = v <= 1 ? v * 100 : v;
  return `${Math.round(pct)}%`;
}
