import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { ANIMAL_ICONS, SYMPTOMS } from "../data/constants.js";
import { fdrsBand } from "../api/agro.js";
import AppShell from "../components/ui/AppShell.jsx";
import PrivacyNotice from "../components/ui/PrivacyNotice.jsx";
import { Stat, SectionTitle, EmptyState } from "../components/ui/primitives.jsx";
import { api, getToken } from "../api/client.js";

// Summary-only dashboard. It never renders a sidebar section's full content:
// farms/risk/sensing/reports/alerts all live on their own pages and tabs,
// reachable from the sidebar. Here we show only compact summaries + counts.
export default function HomeScreen() {
  const { user, getUserFarms, getFDRS, getLatestReading, reports, getFarmInbox } = useApp();
  const navigate = useNavigate();
  const farms = getUserFarms();
  const [health, setHealth] = useState([]);

  useEffect(() => {
    let active = true;
    api
      .health(getToken())
      .then(({ records }) => active && setHealth(records || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const livestockCount = farms.filter((f) => f.animal_category === "large_livestock").length;
  const reports7 = reports.filter((r) => Date.now() - new Date(r.created_at).getTime() < 7 * 86400000).length;

  const ownInbox = farms.flatMap((f) => getFarmInbox(f.farm_id)).sort((a, b) => b.ts - a.ts);
  const unread = ownInbox.filter((m) => !m.read).length;

  const recentAlerts = ownInbox.slice(0, 3);
  const recentReports = reports
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3);

  const symptomLabel = (farm, id) =>
    (SYMPTOMS[farm.animal_category] || []).find((s) => s.id === id)?.label || id;

  return (
    <AppShell title="My Dashboard" subtitle={`Welcome, ${user?.name}`}>
      <div className="space-y-6">
        <PrivacyNotice role="farmer" />

        {/* KPI summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon="🏡" iconBg="bg-green-100" label="My farms" value={farms.length} tone="ink" sub={`${livestockCount} livestock · ${farms.length - livestockCount} poultry`} />
          <Stat icon="🩺" iconBg="bg-blue-100" label="Reports (7d)" value={reports7} tone="blue" sub="submitted by you" />
          <Stat icon="💉" iconBg="bg-indigo-100" label="Health records" value={health.length} tone="ink" sub="all-time records" />
          <Stat icon="🔔" iconBg="bg-amber-100" label="Unread alerts" value={unread} tone={unread > 0 ? "red" : "ink"} sub="messages for your farms" />
        </div>

        {/* Farm risk at a glance — compact rows, full detail lives in My Farm */}
        <section>
          <SectionTitle
            icon="🏡"
            right={
              <button onClick={() => navigate("/my-farm")} className="text-xs font-semibold text-primary hover:underline shrink-0">
                Open My Farm →
              </button>
            }
          >
            Farm risk at a glance
          </SectionTitle>
          {farms.length === 0 ? (
            <EmptyState
              icon="🏡"
              title="No farms registered yet"
              sub="Register your farm to start tracking its health and disease risk."
              action={
                <button onClick={() => navigate("/register-farm")} className="btn-primary px-5 py-2.5">
                  ➕ Register Farm
                </button>
              }
            />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
              {farms.map((farm) => {
                const fdrs = getFDRS(farm);
                const band = fdrs ? fdrsBand(fdrs.total) : fdrsBand(0);
                const reading = getLatestReading(farm.farm_id);
                const icon = ANIMAL_ICONS[farm.animal_category]?.[farm.animal_type] || "🐾";
                const live = reading?.fetch_status === "success";
                const pending = reading && !live;
                return (
                  <button
                    key={farm.farm_id}
                    onClick={() => navigate(`/farm/${farm.farm_id}?tab=risk`)}
                    className="w-full text-left px-4 py-3 hover:bg-surface transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl shrink-0">{icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 truncate">{farm.name}</p>
                        <p className="text-xs text-gray-400">{farm.herd_size} {farm.animal_type}(s)</p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-semibold shrink-0 ${
                          live ? "bg-green-600 text-white" : pending ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {live ? "● LIVE sensing" : pending ? "⏳ Sensing pending" : "○ No reading"}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${band.bg} ${band.text}`}>
                        FDRS {fdrs ? fdrs.total : "--"}/100
                      </span>
                      {fdrs && (
                        <span className="hidden sm:block w-16 shrink-0">
                          <span className="block h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <span className={`block h-full ${band.bar}`} style={{ width: `${fdrs.total}%` }} />
                          </span>
                        </span>
                      )}
                      <span className="text-gray-400 shrink-0">→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent reports — summary feed, full list on My Reports */}
        <section>
          <SectionTitle
            icon="📄"
            right={
              <button onClick={() => navigate("/my-reports")} className="text-xs font-semibold text-primary hover:underline shrink-0">
                My Reports →
              </button>
            }
          >
            Recent reports
          </SectionTitle>
          {recentReports.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-sm text-gray-500">
              No reports yet. {" "}
              <button onClick={() => navigate("/report")} className="text-primary font-semibold hover:underline">
                Report symptoms →
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
              {recentReports.map((r) => {
                const farm = farms.find((f) => f.farm_id === r.farm_id);
                const flagged = r.ai_screened === true && (r.ai_status === "high" || r.ai_status === "suspicious");
                return (
                  <button
                    key={r.id}
                    onClick={() => navigate(farm ? `/farm/${farm.farm_id}?tab=reports` : "/my-reports")}
                    className="w-full text-left px-4 py-3 hover:bg-surface transition-colors flex items-center gap-3"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${flagged ? "bg-red-500" : r.ai_screened === true ? "bg-green-500" : "bg-gray-300"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-800 truncate">
                        {farm?.name || r.farm_id}
                      </span>
                      <span className="block text-xs text-gray-500 truncate">
                        {(r.symptoms || []).map((id) => symptomLabel(farm || {}, id)).join(", ")}
                      </span>
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">{fmtShortDate(r.created_at)}</span>
                    <span className="text-gray-400 shrink-0">→</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent alerts — summary feed, full inbox on My Alerts */}
        <section>
          <SectionTitle
            icon="🔔"
            right={
              <button onClick={() => navigate("/my-alerts")} className="text-xs font-semibold text-primary hover:underline shrink-0">
                My Alerts →
              </button>
            }
          >
            Recent alerts
          </SectionTitle>
          {recentAlerts.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-sm text-gray-500">
              No alerts yet. Vet dispatches and advisories for your farms appear here.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
              {recentAlerts.map((m) => {
                const farm = farms.find((f) => f.farm_id === m.farm_id);
                return (
                  <button
                    key={m.id}
                    onClick={() => navigate("/my-alerts")}
                    className="w-full text-left px-4 py-3 hover:bg-surface transition-colors flex items-center gap-3"
                  >
                    <span className="text-base shrink-0">{m.type === "vet" ? "🐮" : m.type === "advisory" ? "📢" : "🔔"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {m.type === "vet" ? "Vet Dispatch" : m.type === "advisory" ? "Advisory" : "Update"}
                        </span>
                        {!m.read && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold shrink-0">NEW</span>
                        )}
                      </span>
                      <span className="block text-xs text-gray-500 truncate">
                        {farm?.name ? `${farm.name} · ` : ""}{m.en}
                      </span>
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">{fmtShortDate(new Date(m.ts).toISOString())}</span>
                    <span className="text-gray-400 shrink-0">→</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function fmtShortDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}