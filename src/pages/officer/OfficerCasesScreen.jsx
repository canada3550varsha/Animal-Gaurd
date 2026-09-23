import { useState } from "react";
import AppShell from "../../components/ui/AppShell.jsx";
import ZoonoticBadge from "../../components/ZoonoticBadge.jsx";
import { Stat, SectionTitle, EmptyState, Badge } from "../../components/ui/primitives.jsx";
import { useOfficerData, SYMPTOM_LABEL } from "./useOfficerData.js";
import { recommendedAction } from "../../api/clustering.js";
import { caseFlowStatus } from "../../data/health.js";
import { fmtTime, fmtNum, fmtCel, fmtMoisture } from "../../data/format.js";

export default function OfficerCasesScreen() {
  const o = useOfficerData();
  const [expandedReadingId, setExpandedReadingId] = useState(null);

  return (
    <AppShell title="Cases & Alerts" subtitle="Live clusters · response actions · sensor-detected alerts">
      <div className="space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon="🚨" iconBg="bg-red-100" label="Active outbreaks" value={o.alerts.length} tone={o.alerts.length > 0 ? "red" : "ink"} sub={`${o.criticalClusters.length} critical`} />
          <Stat icon="🩺" iconBg="bg-blue-100" label="Reports (24h)" value={o.reports24h} tone="blue" sub="farmer + auto-sensed" />
          <Stat icon="🤖" iconBg="bg-indigo-100" label="AI alerts" value={o.aiAlerts.length} tone="ink" sub="from remote sensing" />
          <Stat icon="⚰️" iconBg="bg-gray-100" label="Mortality (7d)" value={o.mortality.d} tone={o.mortality.d > 0 ? "red" : "ink"} sub={`crude rate ${o.mortality.rate}%`} />
        </div>

        {/* Live outbreak attention banner */}
        {o.newAlerts.length > 0 && (
          <div className="bg-red-600 text-white rounded-2xl p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🆘</span>
                <div>
                  <p className="font-bold leading-tight">
                    {o.newAlerts.length} NEW OUTBREAK ALERT{o.newAlerts.length > 1 ? "S" : ""} DETECTED
                  </p>
                  <p className="text-xs mt-1 opacity-90">
                    Just received from live farmer reports — {o.newAlerts[0].village}, {o.newAlerts[0].report_count} case(s). Review and respond below.
                  </p>
                </div>
              </div>
              <button
                onClick={o.markSeen}
                className="text-xs bg-white text-red-700 font-semibold px-3 py-1.5 rounded-full hover:bg-red-50 transition-colors shrink-0"
              >
                Mark seen
              </button>
            </div>
          </div>
        )}

        {/* Active alerts with response status + workflow state */}
        <section>
          <SectionTitle icon="🚨" right={<Badge cls="bg-gray-900 text-white">{o.alerts.length} active</Badge>}>
            Alerts / notifications
          </SectionTitle>
          {o.actionErr && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2">{o.actionErr}</p>}
          {o.alerts.length === 0 ? (
            <EmptyState icon="✅" title="No active alerts" sub="All reports within normal parameters." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {o.alerts.map((cluster) => {
                const critical = cluster.level === "critical";
                const dispatched = o.dispatchedClusterIds.has(cluster.id);
                const isNew = cluster.last_report_at && new Date(cluster.last_report_at).getTime() > o.seenAt;
                const autoDetected = cluster.reports ? cluster.reports.some((rid) => o.reportSource[rid] === "ai_auto") : false;
                const st = caseFlowStatus(cluster, {
                  dispatched,
                  resolved: o.resolvedClusterIds.has(cluster.id),
                  sample: o.sampleByCluster.get(cluster.id),
                });
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
                        </p>
                        <p className={`text-sm mt-0.5 ${critical ? "text-red-700" : "text-amber-700"}`}>
                          {cluster.report_count} report(s) · {cluster.farm_count} farm(s) ·{" "}
                          {cluster.affected_animals ?? 0} affected animals · {o.kindLabel(cluster.animal_category)}
                        </p>
                        {(cluster.symptoms || []).length > 0 && (
                          <p className="text-xs mt-1 text-gray-600">
                            Signs: {cluster.symptoms.map((s) => SYMPTOM_LABEL[s] || s).join(", ")}
                          </p>
                        )}
                        {cluster.last_report_at && (
                          <p className="text-[10px] text-gray-500 mt-1">Last report {fmtTime(cluster.last_report_at)}</p>
                        )}
                        <div className="mt-1.5">
                          <ZoonoticBadge item={cluster} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[9px] px-2 py-1 rounded-full font-semibold ${st.cls}`}>
                          {st.icon} {st.label}
                        </span>
                        {dispatched && <span className="text-[9px] px-2 py-1 rounded-full bg-green-600 text-white font-semibold">✅ RESPONDED</span>}
                        {isNew && <span className="text-[9px] px-2 py-1 rounded-full bg-red-600 text-white font-semibold">🆕 NEW</span>}
                        {autoDetected && (
                          <span className="text-[9px] px-2 py-1 rounded-full bg-indigo-600 text-white font-semibold">🛰️ sensor</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-[11px] text-gray-600">
                        Recommended: <span className="font-medium">{recommendedAction(cluster)}</span>
                      </p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => o.actOn("dispatch", cluster)}
                        disabled={o.acting !== null}
                        className="flex-1 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {o.acting?.id === cluster.id && o.acting.kind === "dispatch" ? "Sending…" : "🐮 Dispatch Vet"}
                      </button>
                      <button
                        onClick={() => o.actOn("advisory", cluster)}
                        disabled={o.acting !== null}
                        className="flex-1 py-2 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {o.acting?.id === cluster.id && o.acting.kind === "advisory" ? "Sending…" : "📢 Send Advisory"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* CRITICAL OUTBREAK banners */}
        {o.criticalClusters.map((cluster) => {
          const dispatched = o.dispatchedClusterIds.has(cluster.id);
          return (
            <div key={cluster.id} className="border-2 border-red-600 bg-red-50 rounded-2xl p-4">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-2xl">🚨</span>
                <h2 className="font-bold text-red-800 text-lg leading-tight">
                  CRITICAL OUTBREAK: {cluster.report_count} cases across {cluster.farm_count}{" "}
                  {o.kindLabel(cluster.animal_category)} farms in {cluster.village}
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
              <div className="mb-3">
                <ZoonoticBadge item={cluster} />
              </div>
              {dispatched && (
                <p className="text-xs text-green-700 bg-green-100 rounded-lg px-2 py-1 mb-3">
                  ✅ Vet already dispatched for this cluster
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => o.actOn("dispatch", cluster)}
                  disabled={o.acting !== null}
                  className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {o.acting?.id === cluster.id && o.acting.kind === "dispatch" ? "Sending…" : "🐮 Dispatch Vet"}
                </button>
                <button
                  onClick={() => o.actOn("advisory", cluster)}
                  disabled={o.acting !== null}
                  className="flex-1 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {o.acting?.id === cluster.id && o.acting.kind === "advisory" ? "Sending…" : "📢 Send Advisory"}
                </button>
              </div>
            </div>
          );
        })}

        {/* AI Alerts — only when sensing AI actually fired */}
        {o.aiAlerts.length > 0 && (
          <section>
            <SectionTitle icon="🤖">AI alerts ({o.aiAlerts.length})</SectionTitle>
            <div className="grid gap-2 lg:grid-cols-2">
              {o.aiAlerts.map((alert) => {
                const f = o.farmById.get(alert.farm_id);
                const sr = alert.sensing_reading || null;
                const expanded = expandedReadingId === alert.id;
                return (
                  <div key={alert.id} className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-indigo-900 flex items-center gap-1.5 flex-wrap">
                          🤖 {f?.name || alert.farm_id}
                          <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium">AI Alert</span>
                        </p>
                        <p className="text-xs text-indigo-800 mt-0.5">
                          {alert.village}, {alert.district} · {alert.affected_count || 0} predicted affected · {fmtTime(alert.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <ZoonoticBadge item={alert} compact />
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
                              Source sensing reading · {fmtTime(sr.fetched_at)}
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
      </div>
    </AppShell>
  );
}