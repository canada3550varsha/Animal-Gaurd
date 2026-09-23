import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../../components/ui/AppShell.jsx";
import PrivacyNotice from "../../components/ui/PrivacyNotice.jsx";
import { Stat, SectionTitle, Badge } from "../../components/ui/primitives.jsx";
import ImpactMetrics from "../../components/ImpactMetrics.jsx";
import ZoonoticBadge from "../../components/ZoonoticBadge.jsx";
import { api, getToken } from "../../api/client.js";
import { useOfficerData, SYMPTOM_LABEL } from "../officer/useOfficerData.js";
import { caseFlowStatus } from "../../data/health.js";
import { fmtTime } from "../../data/format.js";

export default function AdminSurveillanceScreen() {
  const navigate = useNavigate();
  const o = useOfficerData();
  const [drives, setDrives] = useState([]);

  useEffect(() => {
    let active = true;
    api
      .drives(getToken())
      .then(({ drives }) => active && setDrives(drives || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const activeDrives = drives.filter((d) => d.status === "active");

  return (
    <AppShell title="District Surveillance" subtitle="Aggregated, de-identified programme monitoring">
      <div className="space-y-6">
        <PrivacyNotice role="admin" />

        {/* KPI summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <Stat icon="🏡" iconBg="bg-green-100" label="Farms registered" value={o.farms.length} tone="ink" sub="across the district" />
          <Stat icon="🚨" iconBg="bg-red-100" label="Active outbreaks" value={o.alerts.length} tone={o.alerts.length > 0 ? "red" : "ink"} sub={`${o.criticalClusters.length} critical · ${o.alerts.length - o.criticalClusters.length} emerging`} />
          <Stat icon="🩺" iconBg="bg-blue-100" label="Reports (24h)" value={o.reports24h} tone="blue" sub="farmer + auto-sensed" />
          <Stat icon="🚚" iconBg="bg-indigo-100" label="Active drives" value={activeDrives.length} tone="ink" sub="vaccination drives running" />
          <Stat icon="⚰️" iconBg="bg-gray-100" label="Mortality (7d)" value={o.mortality.d} tone={o.mortality.d > 0 ? "red" : "ink"} sub={`crude rate ${o.mortality.rate}%`} />
        </div>

        {/* Aggregated outbreak view — village-level only, no farm identity */}
        <section>
          <SectionTitle icon="🚨" right={<Badge cls="bg-gray-900 text-white">{o.alerts.length} active</Badge>}>
            Outbreak overview (de-identified)
          </SectionTitle>
          {o.alerts.length === 0 ? (
            <p className="text-sm text-gray-400 bg-white rounded-2xl p-4 border border-gray-100">
              No active outbreaks. All reports within normal parameters.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {o.alerts.map((cluster) => {
                const critical = cluster.level === "critical";
                const dispatched = o.dispatchedClusterIds.has(cluster.id);
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
                      <span className={`text-[9px] px-2 py-1 rounded-full font-semibold shrink-0 ${st.cls}`}>
                        {st.icon} {st.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Programme impact */}
        <section>
          <SectionTitle icon="📈">Programme impact</SectionTitle>
          <ImpactMetrics />
        </section>

        {/* Drive coverage summary (aggregates only) */}
        {activeDrives.length > 0 && (
          <section>
            <SectionTitle icon="🚚">Vaccination drive coverage</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {activeDrives.map((d) => (
                <div key={d.drive_id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="font-semibold text-gray-900 truncate">📋 {d.name}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {d.disease || "—"} · {d.vaccine || "—"} · {d.animal_category} · {d.district}
                    {d.taluka ? ` / ${d.taluka}` : ""}
                  </p>
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500">Farm coverage</span>
                      <span className="font-semibold text-gray-800">{d.coverage.farm_coverage_pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${d.coverage.farm_coverage_pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-gray-500">Animal coverage</span>
                      <span className="font-semibold text-gray-800">{d.coverage.animal_coverage_pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${d.coverage.animal_coverage_pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Oversight shortcuts */}
        <section>
          <SectionTitle icon="🧭">Oversight</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              onClick={() => navigate("/admin/escalations")}
              className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              <span className="text-2xl">🔺</span>
              <p className="font-semibold text-gray-900 mt-2">Case Escalations</p>
              <p className="text-xs text-gray-500 mt-0.5">District referral ladder follow-up</p>
            </button>
            <button
              onClick={() => navigate("/admin/critical")}
              className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              <span className="text-2xl">🚨</span>
              <p className="font-semibold text-gray-900 mt-2">Critical Case Access</p>
              <p className="text-xs text-gray-500 mt-0.5">Gated, audited identified access</p>
            </button>
            <button
              onClick={() => navigate("/admin/audit")}
              className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              <span className="text-2xl">🧾</span>
              <p className="font-semibold text-gray-900 mt-2">Audit Log</p>
              <p className="text-xs text-gray-500 mt-0.5">Tamper-evident SHA-256 chain</p>
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}