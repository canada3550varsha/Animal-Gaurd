import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { CATEGORY_LABELS, ANIMAL_ICONS } from "../data/constants.js";
import { fdrsBand } from "../api/agro.js";
import ImpactMetrics from "../components/ImpactMetrics.jsx";
import AppShell from "../components/ui/AppShell.jsx";
import { Stat, SectionTitle } from "../components/ui/primitives.jsx";
import { api, getToken } from "../api/client.js";

export default function HomeScreen() {
  const { user, getUserFarms, getFDRS, sensing, reports, clusters } = useApp();
  const navigate = useNavigate();
  const farms = getUserFarms();
  const [health, setHealth] = useState([]);
  const [drives, setDrives] = useState([]);

  const livestockCount = farms.filter((f) => f.animal_category === "large_livestock").length;
  const poultryCount = farms.filter((f) => f.animal_category === "poultry").length;
  const reports7 = reports.filter((r) => Date.now() - new Date(r.created_at).getTime() < 7 * 86400000).length;
  const activeAlerts = clusters.filter((c) => c.level === "critical" || c.level === "emerging").length;

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

  // Latest vaccination + record count per farm (herd health chart summary).
  const healthByFarm = (farmId) => {
    const recs = health.filter((r) => r.farm_id === farmId);
    const lastVac = recs
      .filter((r) => r.record_type === "vaccination")
      .slice()
      .sort((a, b) => new Date(b.date || b.ts) - new Date(a.date || a.ts))[0];
    return { count: recs.length, lastVac };
  };

  // Most relevant drive for a farm (matched region + category) + its coverage status.
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

  const getCategoryIcon = (farm) => {
    const icons = ANIMAL_ICONS[farm.animal_category];
    return icons?.[farm.animal_type] || "🐾";
  };

  return (
    <AppShell title="Livestock Owner Dashboard" subtitle={`Welcome, ${user?.name}`}>
      {/* KPI summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon="🏡" iconBg="bg-green-100" label="My farms" value={farms.length} tone="ink" sub={`${livestockCount} livestock · ${poultryCount} poultry`} />
        <Stat icon="🩺" iconBg="bg-blue-100" label="Reports (7d)" value={reports7} tone="blue" sub="incl. auto-sensed alerts" />
        <Stat icon="💉" iconBg="bg-indigo-100" label="Health records" value={health.length} tone="ink" sub="vaccinations · treatments · deworming" />
        <Stat icon="🚨" iconBg="bg-red-100" label="Active alerts" value={activeAlerts} tone={activeAlerts > 0 ? "red" : "ink"} sub="critical + emerging clusters" />
      </div>

      {/* Quick actions */}
      <section>
        <SectionTitle icon="⚡">Quick actions</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <button
            onClick={() => navigate("/voice-report")}
            className="btn-primary py-3.5"
          >
            <span className="text-lg">🎤</span> No-Typing Voice Report
          </button>
          {user?.role === "farmer" && (
            <button onClick={() => navigate("/register-farm")} className="btn-primary py-3.5">
              <span className="text-lg">➕</span> Register Farm
            </button>
          )}
          <button onClick={() => navigate("/walkthrough")} className="btn py-3.5 bg-amber-500 text-white hover:bg-amber-600">
            <span className="text-lg">🎬</span> Judge Walkthrough
          </button>
          <button onClick={() => navigate("/architecture")} className="btn-secondary py-3.5">
            <span className="text-lg">🏗️</span> Architecture
          </button>
        </div>
      </section>

      {/* Programme impact */}
      <section>
        <SectionTitle icon="📈">Programme impact</SectionTitle>
        <ImpactMetrics />
      </section>

      {/* Farms */}
      <section>
        <SectionTitle icon="🏡">
          {user?.role === "farmer" ? "My Farms" : user?.role === "vet" ? "District Farms" : "All Farms"}
        </SectionTitle>

        {farms.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">🏡</div>
            <p className="text-lg">No farms registered yet</p>
            {user?.role === "farmer" && <p className="text-sm mt-1">Tap "Register Farm" to get started</p>}
          </div>
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
                  onClick={() => {
                    console.log("farm:click", farm.farm_id);
                    navigate(`/farm/${farm.farm_id}`);
                  }}
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
                          📍 {farm.village}, {farm.taluka}, {farm.district}
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

                  {/* FDRS bar */}
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

                  {/* 💉 Herd health chart summary */}
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

      {/* 📡 Live Sensing Data — raw poll rows, as-is (farmer sees own farms only) */}
      <section>
        <SectionTitle icon="📡">Live sensing data</SectionTitle>
        {sensing.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-sm text-gray-500">
            Awaiting the first Agro poll…
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
                    <p className="text-[10px] text-gray-400 mt-2">{reading.id} · {new Date(reading.fetched_at).toLocaleString()}</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 mt-2">No reading yet — waiting for the first satellite pass.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

// ---- Live-sensing formatters (plain numbers; Kelvin surfaces only) ----
function fmtShortDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
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
