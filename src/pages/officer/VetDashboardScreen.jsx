import { useNavigate } from "react-router-dom";
import AppShell from "../../components/ui/AppShell.jsx";
import PrivacyNotice from "../../components/ui/PrivacyNotice.jsx";
import { Stat, SectionTitle } from "../../components/ui/primitives.jsx";
import { useOfficerData } from "./useOfficerData.js";
import { caseFlowStatus } from "../../data/health.js";

const MODULES = [
  { to: "/vet/cases", icon: "🚨", label: "Cases & Alerts", desc: "Live clusters, response actions, AI alerts", tint: "bg-red-50 border-red-100" },
  { to: "/vet/map", icon: "🗺️", label: "Outbreak Map", desc: "Spatial view of critical rings", tint: "bg-green-50 border-green-100" },
  { to: "/vet/farms", icon: "🏡", label: "District Farms", desc: "Herd risk & emergency status", tint: "bg-blue-50 border-blue-100" },
  { to: "/vet/samples", icon: "🧪", label: "Lab Referrals", desc: "Collect samples, refer to district lab", tint: "bg-amber-50 border-amber-100" },
  { to: "/vet/health", icon: "💉", label: "Herd Health", desc: "Vaccination & treatment ledger, drives, live sensing", tint: "bg-indigo-50 border-indigo-100" },
  { to: "/vet/escalations", icon: "🔺", label: "Escalations", desc: "Referral ladder to district / hospital", tint: "bg-orange-50 border-orange-100" },
  { to: "/vet/impact", icon: "📈", label: "Impact & Mortality", desc: "Response time, coverage, mortality trend", tint: "bg-purple-50 border-purple-100" },
];

export default function VetDashboardScreen() {
  const navigate = useNavigate();
  const o = useOfficerData();
  const { user } = o;

  return (
    <AppShell
      title="Veterinary Dashboard"
      subtitle={`${user?.district || "District"} · ${o.farms.length} farms in scope`}
    >
      <div className="space-y-6">
        <PrivacyNotice role="vet" />

        {/* KPI summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <Stat icon="🏡" iconBg="bg-green-100" label="Farms in scope" value={o.farms.length} tone="ink" sub="identified holdings in jurisdiction" />
          <Stat icon="🚨" iconBg="bg-red-100" label="Active outbreaks" value={o.alerts.length} tone={o.alerts.length > 0 ? "red" : "ink"} sub={`${o.criticalClusters.length} critical · ${o.alerts.length - o.criticalClusters.length} emerging`} />
          <Stat icon="🧪" iconBg="bg-amber-100" label="Samples in lab" value={o.sampleByCluster.size > 0 ? [...o.sampleByCluster.values()].filter((s) => s?.status === "awaiting_result").length : "—"} tone="amber" sub="referred, awaiting result" />
          <Stat icon="⚠️" iconBg="bg-orange-100" label="Zoonotic clusters" value={o.zoonoticClusters} tone={o.zoonoticClusters > 0 ? "amber" : "ink"} sub="animal → human spillover risk" />
          <Stat icon="⚰️" iconBg="bg-gray-100" label="Mortality (7d)" value={o.mortality.d} tone={o.mortality.d > 0 ? "red" : "ink"} sub={o.mortality.d > 0 ? `crude rate ${o.mortality.rate}%` : "no deaths recorded"} />
        </div>

        {/* Priority attention */}
        {o.alerts.length > 0 && (
          <section>
            <SectionTitle icon="🚨">Priority cases</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {o.alerts.slice(0, 6).map((cluster) => {
                const critical = cluster.level === "critical";
                const dispatched = o.dispatchedClusterIds.has(cluster.id);
                const st = caseFlowStatus(cluster, {
                  dispatched,
                  resolved: o.resolvedClusterIds.has(cluster.id),
                  sample: o.sampleByCluster.get(cluster.id),
                });
                return (
                  <button
                    key={cluster.id}
                    onClick={() => navigate("/vet/cases")}
                    className={`w-full text-left rounded-2xl p-4 border ${
                      critical ? "border-2 border-red-600 bg-red-50" : "border border-amber-400 bg-amber-50"
                    } hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-bold ${critical ? "text-red-800" : "text-amber-800"}`}>
                        {critical ? "🚨 CRITICAL" : "⚠️ EMERGING"} — {cluster.village}
                      </p>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${st.cls}`}>
                        {st.icon} {st.label}
                      </span>
                    </div>
                    <p className={`text-sm mt-0.5 ${critical ? "text-red-700" : "text-amber-700"}`}>
                      {cluster.report_count} report(s) · {cluster.farm_count} farm(s) · {o.kindLabel(cluster.animal_category)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {dispatched ? "✅ Office responded" : "No response yet — action needed"}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Module nav */}
        <section>
          <SectionTitle icon="🧭">Response modules</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {MODULES.map((m) => (
              <button
                key={m.to}
                onClick={() => navigate(m.to)}
                className={`w-full text-left bg-white rounded-2xl border p-4 hover:shadow-md transition-shadow ${m.tint}`}
              >
                <span className="text-2xl">{m.icon}</span>
                <p className="font-semibold text-gray-900 mt-2">{m.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}