import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { CATEGORY_LABELS, ANIMAL_ICONS, SYMPTOMS } from "../data/constants.js";
import { fdrsBand } from "../api/agro.js";
import AppShell from "../components/ui/AppShell.jsx";
import PrivacyNotice from "../components/ui/PrivacyNotice.jsx";
import { Stat, SectionTitle, EmptyState } from "../components/ui/primitives.jsx";
import { api, getToken } from "../api/client.js";

// Summary-only dashboard for the farmer. Content is limited to the logged-in
// user's own farms, reports, sensing and alerts — no district-wide data, no
// navigation shortcuts (reporting lives in the sidebar under Health & Monitoring).
export default function HomeScreen() {
  const { user, getUserFarms, getFDRS, reports, getFarmInbox, sensing } = useApp();
  const navigate = useNavigate();
  const farms = getUserFarms();
  const [health, setHealth] = useState([]);
  const [drives, setDrives] = useState([]);

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

  const livestockCount = farms.filter((f) => f.animal_category === "large_livestock").length;
  const poultryCount = farms.filter((f) => f.animal_category === "poultry").length;
  const reports7 = reports.filter((r) => Date.now() - new Date(r.created_at).getTime() < 7 * 86400000).length;

  // Own-farm messages, newest first.
  const ownInbox = farms
    .flatMap((f) => getFarmInbox(f.farm_id))
    .sort((a, b) => b.ts - a.ts);
  const unread = ownInbox.filter((m) => !m.read).length;
  const recentMessages = ownInbox.slice(0, 3);

  const recentReports = reports.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4);

  const healthByFarm = (farmId) => {
    const recs = health.filter((r) => r.farm_id === farmId);
    const lastVac = recs
      .filter((r) => r.record_type === "vaccination")
      .slice()
      .sort((a, b) => new Date(b.date || b.ts) - new Date(a.date || a.ts))[0];
    return { count: recs.length, lastVac };
  };

  const driveChipFor = (farm) => {
    const match = drives.find(
      (d) =>
        d.coverage &&
        d.district === farm.district &&
        (!d.taluka || d.taluka === farm.taluka) &&
        d.animal_category === farm.animal_category
    );
    if (!match) return null;
    const covered = (match.coverage.covered_farm_ids || []).includes(farm.farm_id);
    return { drive: match, covered };
  };

  const getCategoryIcon = (farm) => ANIMAL_ICONS[farm.animal_category]?.[farm.animal_type] || "🐾";

  const symptomLabel = (farm, id) =>
    (SYMPTOMS[farm.animal_category] || []).find((s) => s.id === id)?.label || id;

  return (
    <AppShell title="My Dashboard" subtitle={`Welcome, ${user?.name}`}>
      <div className="space-y-6">
        <PrivacyNotice role="farmer" />

        {/* Summary stats — own data only */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon="🏡" iconBg="bg-green-100" label="My farms" value={farms.length} tone="ink" sub={`${livestockCount} livestock · ${poultryCount} poultry`} />
          <Stat icon="🩺" iconBg="bg-blue-100" label="Reports (7d)" value={reports7} tone="blue" sub="submitted by you" />
          <Stat icon="💉" iconBg="bg-indigo-100" label="Health records" value={health.length} tone="ink" sub="vaccinations · treatments · deworming" />
          <Stat icon="🔔" iconBg="bg-amber-100" label="Unread alerts" value={unread} tone={unread > 0 ? "red" : "ink"} sub="messages for your farms" />
        </div>

        {/* My Farms */}
        <section>
          <SectionTitle icon="🏡">My Farms</SectionTitle>
          {farms.length === 0 ? (
            <EmptyState
              icon="🏡"
              title="No farms registered yet"
              sub="Register your first farm to start monitoring disease risk and reporting symptoms."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {farms.map((farm) => {
                const fdrs = getFDRS(farm);
                const band = fdrs ? fdrsBand(fdrs.total) : fdrsBand(0);
                const envReady = fdrs && fdrs.env != null;
                const { count: healthCount, lastVac } = healthByFarm(farm.farm_id);
                const driveChip = driveChipFor(farm);
                return (
                  <div
                    key={farm.farm_id}
                    onClick={() => navigate(`/farm/${farm.farm_id}`)}
                    className="card p-4 cursor-pointer card-hover"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-3xl">{getCategoryIcon(farm)}</span>
                        <div>
                          <h3 className="font-semibold text-gray-900">{farm.name}</h3>
                          <p className="text-sm text-gray-500">
                            {farm.herd_size} {farm.animal_type}(s) · {CATEGORY_LABELS[farm.animal_category]}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            📍 {farm.village}, {farm.taluka}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${band.bg} ${band.text}`}>
                          FDRS {fdrs ? fdrs.total : "--"}/100
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {envReady ? "Live env data" : "Seeded/env pending"}
                        </p>
                      </div>
                    </div>

                    {fdrs && (
                      <div className="mt-3">
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full ${band.bar} transition-all`}
                            style={{ width: `${fdrs.total}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {(healthCount > 0 || lastVac) && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {lastVac && (
                          <span className="bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full text-[10px] font-medium max-w-full">
                            💉 Vaccinated · {lastVac.name} · {fmtShortDate(lastVac.date)}
                          </span>
                        )}
                        {healthCount > 0 && (
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-medium">
                            {healthCount} health record{healthCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    )}

                    {driveChip && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            driveChip.covered
                              ? "bg-green-50 text-green-700 border-green-100"
                              : "bg-amber-50 text-amber-700 border-amber-100"
                          }`}
                        >
                          {driveChip.covered
                            ? `✅ ${driveChip.drive.name} — covered`
                            : `⚠ ${driveChip.drive.name} — your farm is still to vaccinate`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent reports (own farms) */}
        <section>
          <SectionTitle icon="📄">Recent reports</SectionTitle>
          {recentReports.length === 0 ? (
            <EmptyState
              icon="📄"
              title="No reports yet"
              sub="Report symptoms for a farm and it will show up here with AI screening status."
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {recentReports.map((r) => {
                const farm = farms.find((f) => f.farm_id === r.farm_id);
                return (
                  <button
                    key={r.id}
                    onClick={() => navigate(farm ? `/farm/${farm.farm_id}?tab=reports` : "/my-farm")}
                    className="bg-white rounded-xl border border-gray-100 p-3 text-left hover:border-primary transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{farm?.name || r.farm_id}</p>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                          r.ai_screened === true
                            ? r.ai_status === "high" || r.ai_status === "suspicious"
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {r.ai_screened === true ? (r.ai_status === "high" || r.ai_status === "suspicious" ? "⚠ SCREENED" : "✓ SCREENED") : "PENDING"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {(r.symptoms || []).map((id) => symptomLabel(farm || {}, id)).join(", ")}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">{fmtShortDate(r.created_at)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Live sensing (own farms) */}
        <section>
          <SectionTitle icon="📡">Live sensing</SectionTitle>
          {sensing.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-sm text-gray-500">
              Awaiting the first satellite poll for your farms…
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {sensing.map(({ farm, reading }) => (
                <div key={farm.farm_id} className="bg-white rounded-xl border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-900 truncate">{farm.name}</p>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                        !reading
                          ? "bg-gray-100 text-gray-500"
                          : reading.fetch_status === "success"
                            ? "bg-green-600 text-white"
                            : reading.fetch_status === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                      }`}
                    >
                      {!reading
                        ? "NO READING YET"
                        : reading.fetch_status === "success"
                          ? "● LIVE"
                          : reading.fetch_status === "pending"
                            ? "PENDING"
                            : "FETCH FAILED"}
                    </span>
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
                      <p className="text-[10px] text-gray-400 mt-2">{new Date(reading.fetched_at).toLocaleString()}</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 mt-2">No reading yet — waiting for the first satellite pass.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent messages for own farms */}
        <section>
          <SectionTitle icon="🔔">Recent alerts</SectionTitle>
          {recentMessages.length === 0 ? (
            <EmptyState icon="🔔" title="No alerts yet" sub="Vet dispatches and advisories for your farms will appear here." />
          ) : (
            <div className="space-y-2">
              {recentMessages.map((m) => {
                const farm = farms.find((f) => f.farm_id === m.farm_id);
                return (
                  <div key={m.id} className={`bg-white rounded-2xl p-4 border border-gray-100 ${!m.read ? "ring-2 ring-amber-300" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${m.type === "vet" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {m.type === "vet" ? "🐮 Vet Dispatch" : m.type === "advisory" ? "📢 Advisory" : "🔔 Update"}
                        </span>
                        {!m.read && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold">NEW</span>}
                      </div>
                      <span className="text-[10px] text-gray-400">{new Date(m.ts).toLocaleString()}</span>
                    </div>
                    {farm && <p className="text-[11px] text-gray-500 mt-1">📍 {farm.name} · {farm.village}</p>}
                    <p className="text-sm text-gray-800 leading-relaxed mt-1 line-clamp-2">{m.en}</p>
                  </div>
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
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtNum(v) {
  return typeof v === "number" ? Number(v).toFixed(3) : "—";
}
function fmtCel(v) {
  if (typeof v !== "number") return "—";
  const c = v > 150 ? v - 273.15 : v;
  return `${c.toFixed(1)}°C`;
}
function fmtMoisture(v) {
  if (typeof v !== "number") return "—";
  const pct = v <= 1 ? v * 100 : v;
  return `${Math.round(pct)}%`;
}