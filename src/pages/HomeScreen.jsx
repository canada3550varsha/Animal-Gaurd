import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { ANIMAL_ICONS, SYMPTOMS } from "../data/constants.js";
import { fdrsBand } from "../api/agro.js";
import AppShell from "../components/ui/AppShell.jsx";
import PrivacyNotice from "../components/ui/PrivacyNotice.jsx";
import { Stat, SectionTitle } from "../components/ui/primitives.jsx";
import { api, getToken } from "../api/client.js";
import { T } from "../data/i18n.js";

// Summary-only dashboard. It never renders a full page's content — each section
// is a compact glance (or single latest item) that links to the real page.
export default function HomeScreen() {
  const { user, getUserFarms, getFDRS, reports, getFarmInbox, sensing, lang } = useApp();
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
  const poultryCount = farms.filter((f) => f.animal_category === "poultry").length;
  const reports7 = reports.filter((r) => Date.now() - new Date(r.created_at).getTime() < 7 * 86400000).length;

  // Own-farm messages, newest first — used only for the unread count + latest one.
  const ownInbox = farms
    .flatMap((f) => getFarmInbox(f.farm_id))
    .sort((a, b) => b.ts - a.ts);
  const unread = ownInbox.filter((m) => !m.read).length;
  const latestMessage = ownInbox[0];

  const latestReport = reports
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const latestReportFarm = latestReport
    ? farms.find((f) => f.farm_id === latestReport.farm_id)
    : undefined;

  // Summary of sensing: how many of the farmer's farms have a live reading.
  const liveCount = sensing.filter(({ reading }) => reading?.fetch_status === "success").length;

  const getCategoryIcon = (farm) => ANIMAL_ICONS[farm.animal_category]?.[farm.animal_type] || "🐾";

  const symptomLabel = (farm, id) => {
    const label = (SYMPTOMS[farm.animal_category] || []).find((s) => s.id === id)?.label;
    return label ? T(lang, label) : id;
  };

  return (
    <AppShell title={T(lang, "My Dashboard")} subtitle={`${T(lang, "Welcome, ")}${user?.name}`}>
      <div className="space-y-6">
        <PrivacyNotice role="farmer" />

        {/* Summary stats — own data only */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon="🏡" iconBg="bg-green-100" label={T(lang, "My farms")} value={farms.length} tone="ink" sub={`${livestockCount} ${T(lang, "livestock")} · ${poultryCount} ${T(lang, "poultry")}`} />
          <Stat icon="🩺" iconBg="bg-blue-100" label={T(lang, "Reports (7d)")} value={reports7} tone="blue" sub={T(lang, "submitted by you")} />
          <Stat icon="💉" iconBg="bg-indigo-100" label={T(lang, "Health records")} value={health.length} tone="ink" sub={T(lang, "vaccinations · treatments · deworming")} />
          <Stat icon="🔔" iconBg="bg-amber-100" label={T(lang, "Unread alerts")} value={unread} tone={unread > 0 ? "red" : "ink"} sub={T(lang, "messages for your farms")} />
        </div>

        {/* My farms — compact glance, click through to the full farm */}
        <section>
          <SectionTitle
            icon="🏡"
            right={
              <button onClick={() => navigate("/my-farm")} className="text-xs font-semibold text-primary hover:underline">
                {T(lang, "Open My Farm →")}
              </button>
            }
          >
            {T(lang, "My farms")}
          </SectionTitle>
          {farms.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center">
              <p className="text-sm text-gray-500">{T(lang, "No farms registered yet.")}</p>
              <button onClick={() => navigate("/register-farm")} className="mt-3 btn-primary px-4 py-2">
                {T(lang, "Register Farm")}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
              {farms.map((farm) => {
                const fdrs = getFDRS(farm);
                const band = fdrs ? fdrsBand(fdrs.total) : fdrsBand(0);
                return (
                  <button
                    key={farm.farm_id}
                    onClick={() => navigate(`/farm/${farm.farm_id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-2xl shrink-0">{getCategoryIcon(farm)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-gray-900 truncate">{farm.name}</span>
                      <span className="block text-xs text-gray-500 truncate">
                        {farm.herd_size} {T(lang, farm.animal_type)} · {farm.village}, {farm.taluka}
                      </span>
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${band.bg} ${band.text}`}>
                      FDRS {fdrs ? fdrs.total : "--"}/100
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Latest highlights — one item each, full lists live on their own pages */}
        <section>
          <SectionTitle icon="⚡">{T(lang, "Latest")}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Latest report */}
            <button
              onClick={() => navigate("/my-reports")}
              className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase">{T(lang, "Latest report")}</p>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    latestReport?.ai_screened === true
                      ? latestReport.ai_status === "high" || latestReport.ai_status === "suspicious"
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {latestReport?.ai_screened === true
                    ? latestReport.ai_status === "high" || latestReport.ai_status === "suspicious"
                      ? `⚠ ${T(lang, "SCREENED")}`
                      : `✓ ${T(lang, "SCREENED")}`
                    : latestReport
                      ? T(lang, "PENDING")
                      : ""}
                </span>
              </div>
              {latestReport ? (
                <>
                  <p className="text-sm font-semibold text-gray-900 mt-1 truncate">
                    {latestReportFarm?.name || `Farm ${latestReport.farm_id.slice(-4)}`} —{" "}
                    {(latestReport.symptoms || []).map((id) => symptomLabel(latestReportFarm || {}, id)).slice(0, 3).join(", ")}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">{T(lang, "View all reports in My Reports →")}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500 mt-1">{T(lang, "No reports yet.")}</p>
              )}
            </button>

            {/* Latest alert */}
            <button
              onClick={() => navigate("/my-alerts")}
              className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase">{T(lang, "Latest alert")}</p>
                {latestMessage && !latestMessage.read && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold">{T(lang, "NEW")}</span>
                )}
              </div>
              {latestMessage ? (
                <>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {latestMessage.type === "vet"
                      ? `🐮 ${T(lang, "Vet Dispatch")}`
                      : latestMessage.type === "advisory"
                        ? `📢 ${T(lang, "Advisory")}`
                        : `🔔 ${T(lang, "Update")}`}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5 truncate">{latestMessage[lang] || latestMessage.en}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{T(lang, "View all alerts in My Alerts →")}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500 mt-1">{T(lang, "No alerts yet.")}</p>
              )}
            </button>
          </div>
        </section>

        {/* Sensing — summary line only; full readings live inside farm detail */}
        {farms.length > 0 && (
          <section>
            <SectionTitle icon="📡">{T(lang, "Live sensing")}</SectionTitle>
            <button
              onClick={() => navigate("/my-farm")}
              className="w-full text-left flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              <span className="text-2xl shrink-0">
                {liveCount === farms.length ? "🟢" : liveCount > 0 ? "🟡" : "⚪"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900">
                  {liveCount} {T(lang, "of")} {farms.length} {farms.length === 1 ? T(lang, "farm") : T(lang, "farms")}{" "}
                  {T(lang, "streaming live sensing")}
                </span>
                <span className="block text-[11px] text-gray-400">{T(lang, "Open a farm in My Farm to view its readings")}</span>
              </span>
            </button>
          </section>
        )}
      </div>
    </AppShell>
  );
}