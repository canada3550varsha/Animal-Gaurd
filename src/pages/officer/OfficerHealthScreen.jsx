import AppShell from "../../components/ui/AppShell.jsx";
import { SectionTitle } from "../../components/ui/primitives.jsx";
import HealthPanel from "../../components/HealthPanel.jsx";
import { useOfficerData } from "./useOfficerData.js";
import { CATEGORY_LABELS } from "../../data/constants.js";
import { fmtNum, fmtCel, fmtMoisture, fmtTime } from "../../data/format.js";

export default function OfficerHealthScreen() {
  const o = useOfficerData();

  return (
    <AppShell title="Herd Health" subtitle="Vaccination & treatment ledger · vaccination drives · live sensing">
      <div className="space-y-6">
        <section>
          <HealthPanel />
        </section>

        {/* 📡 Live Sensing Data — raw, plain, always-on. Pure readings, no risk coloring. */}
        <section>
          <SectionTitle icon="📡">Live sensing data</SectionTitle>
          <p className="text-[11px] text-gray-500 bg-white border border-gray-100 rounded-xl px-3 py-2 mb-3 leading-snug">
            One raw row per farm per Agro poll (satellite NDVI + soil temperature + soil moisture), captured regardless of whether any alert fires. Shown as-is — no risk interpretation.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {o.sensing.length === 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-4 text-sm text-gray-500 sm:col-span-2 xl:col-span-3">
                Awaiting the first Agro poll for in-scope farms…
              </div>
            )}
            {o.sensing.map(({ farm, reading }) => (
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
                    <p className="text-[10px] text-gray-400 mt-2">Reading {reading.id} · {fmtTime(reading.fetched_at)}</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 mt-2">No reading yet — waiting for the first satellite pass.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}