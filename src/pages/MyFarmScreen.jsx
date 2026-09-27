import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { CATEGORY_LABELS, ANIMAL_ICONS } from "../data/constants.js";
import { fdrsBand } from "../api/agro.js";
import AppShell from "../components/ui/AppShell.jsx";
import PrivacyNotice from "../components/ui/PrivacyNotice.jsx";
import { Stat, SectionTitle, EmptyState } from "../components/ui/primitives.jsx";
import { T } from "../data/i18n.js";

// My Farm — ONLY the farms belonging to the currently authenticated farmer.
// The server scopes GET /api/farms to the owner; this page renders whatever
// that role-filtered list returns (never other farmers' farms).
export default function MyFarmScreen() {
  const { user, getUserFarms, getFDRS, getLatestReading, lang } = useApp();
  const navigate = useNavigate();
  const farms = getUserFarms();

  const livestockCount = farms.filter((f) => f.animal_category === "large_livestock").length;
  const poultryCount = farms.filter((f) => f.animal_category === "poultry").length;

  return (
    <AppShell title={T(lang, "My Farm")} subtitle={`${T(lang, "Registered by")} ${user?.name}`}>
      <div className="space-y-6">
        <PrivacyNotice role="farmer" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon="🏡" iconBg="bg-green-100" label={T(lang, "My farms")} value={farms.length} tone="ink" sub={`${livestockCount} ${T(lang, "livestock")} · ${poultryCount} ${T(lang, "poultry")}`} />
          <Stat
            icon="📍"
            iconBg="bg-blue-100"
            label={T(lang, "District")}
            value={user?.district || "—"}
            tone="blue"
            sub={user?.taluka ? `${T(lang, "Taluka")} ${user.taluka}` : T(lang, "own farms only")}
          />
        </div>

        <section>
          <SectionTitle
            icon="🏡"
            right={
              <button onClick={() => navigate("/register-farm")} className="btn-primary px-4 py-2 text-sm">
                ➕ {T(lang, "Register Farm")}
              </button>
            }
          >
            {T(lang, "My farms")} ({farms.length})
          </SectionTitle>

          {farms.length === 0 ? (
            <EmptyState
              icon="🏡"
              title={T(lang, "No farms registered yet")}
              sub={T(lang, "Register your farm to start tracking its health and disease risk.")}
              action={
                <button onClick={() => navigate("/register-farm")} className="btn-primary px-5 py-2.5">
                  ➕ {T(lang, "Register Farm")}
                </button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {farms.map((farm) => {
                const fdrs = getFDRS(farm);
                const band = fdrs ? fdrsBand(fdrs.total) : fdrsBand(0);
                const reading = getLatestReading(farm.farm_id);
                const icon = ANIMAL_ICONS[farm.animal_category]?.[farm.animal_type] || "🐾";
                return (
                  <div
                    key={farm.farm_id}
                    onClick={() => navigate(`/farm/${farm.farm_id}`)}
                    className="card p-4 cursor-pointer card-hover"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-3xl">{icon}</span>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{farm.name}</h3>
                          <p className="text-sm text-gray-500">
                            {farm.herd_size} {T(lang, farm.animal_type)} · {T(lang, CATEGORY_LABELS[farm.animal_category])}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            📍 {farm.village}, {farm.taluka}, {farm.district}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${band.bg} ${band.text}`}>
                        FDRS {fdrs ? fdrs.total : "--"}/100
                      </span>
                    </div>

                    {fdrs && (
                      <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full ${band.bar} transition-all`} style={{ width: `${fdrs.total}%` }} />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          reading?.fetch_status === "success"
                            ? "bg-green-600 text-white"
                            : reading
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {reading?.fetch_status === "success" ? `● ${T(lang, "LIVE sensing")}` : reading ? `⏳ ${T(lang, "Sensing pending")}` : `○ ${T(lang, "No reading yet")}`}
                      </span>
                      <button className="ml-auto text-xs font-semibold text-primary hover:underline">
                        {T(lang, "Open farm →")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-[11px] text-gray-400 leading-snug">
          {T(lang, "🔒 This list is filtered server-side to your user ID — other farmers' farms are never sent to your session, and their names, locations, risk scores and health records cannot appear here.")}
        </p>
      </div>
    </AppShell>
  );
}
