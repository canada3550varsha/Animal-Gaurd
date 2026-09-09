import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { CATEGORY_LABELS, ANIMAL_ICONS } from "../data/constants.js";
import { fdrsBand } from "../api/agro.js";
import ImpactMetrics from "../components/ImpactMetrics.jsx";

export default function HomeScreen() {
  const { user, logout, getUserFarms, getFDRS, sensing } = useApp();
  const navigate = useNavigate();
  const farms = getUserFarms();

  const getCategoryIcon = (farm) => {
    const icons = ANIMAL_ICONS[farm.animal_category];
    return icons?.[farm.animal_type] || "🐾";
  };

  return (
    <div className="min-h-screen">
      <header className="bg-primary text-white px-4 py-4 shadow-md">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              Animal Guard
            </h1>
            <p className="text-green-200 text-xs">Welcome, {user?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === "admin" && (
              <button
                onClick={() => navigate("/admin")}
                className="text-sm bg-green-700 hover:bg-green-800 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                🛡️ Audit
              </button>
            )}
            {(user?.role === "vet" || user?.role === "admin") && (
              <button
                onClick={() => navigate("/dashboard")}
                className="text-sm bg-green-700 hover:bg-green-800 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                🛰️ Dashboard
              </button>
            )}
            <button
              onClick={logout}
              className="text-sm bg-green-700 hover:bg-green-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Secondary nav + impact metrics */}
        <section className="mb-5">
          <button
            onClick={() => navigate("/voice-report")}
            className="w-full mb-2 py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors text-sm flex items-center justify-center gap-2 shadow-sm"
          >
            <span className="text-lg">🎤</span> No-Typing Voice Report
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">हिंदी · मराठी · English</span>
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate("/architecture")}
              className="py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              🏗️ Architecture
            </button>
            <button
              onClick={() => navigate("/walkthrough")}
              className="py-2.5 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors text-sm"
            >
              🎬 Judge Walkthrough
            </button>
          </div>

          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Programme Impact</h3>
          <ImpactMetrics />
        </section>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            {user?.role === "farmer" ? "My Farms" : user?.role === "vet" ? "District Farms" : "All Farms"}
          </h2>
          {user?.role === "farmer" && (
            <button
              onClick={() => navigate("/register-farm")}
              className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors flex items-center gap-1"
            >
              + Register Farm
            </button>
          )}
        </div>

        {farms.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-4">🏡</div>
            <p className="text-lg">No farms registered yet</p>
            {user?.role === "farmer" && <p className="text-sm mt-1">Tap "Register Farm" to get started</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {farms.map((farm) => {
              const fdrs = getFDRS(farm);
              const band = fdrs ? fdrsBand(fdrs.total) : fdrsBand(0);
              const envReady = fdrs && fdrs.env != null;
              return (
                <div
                  key={farm.farm_id}
                  onClick={() => {
                    console.log("farm:click", farm.farm_id);
                    navigate(`/farm/${farm.farm_id}`);
                  }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
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
                </div>
              );
            })}
          </div>
        )}

        {/* 📡 Live Sensing Data — raw poll rows, as-is (farmer sees own farms only) */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">📡 Live Sensing Data</h2>
          {sensing.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 text-sm text-gray-500">
              Awaiting the first Agro poll…
            </div>
          ) : (
            <div className="space-y-2">
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
      </main>
    </div>
  );
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
