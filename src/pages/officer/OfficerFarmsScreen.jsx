import { useNavigate } from "react-router-dom";
import AppShell from "../../components/ui/AppShell.jsx";
import { CATEGORY_LABELS, ANIMAL_ICONS } from "../../data/constants.js";
import { fdrsBand } from "../../api/agro.js";
import { useOfficerData, SYMPTOM_LABEL } from "./useOfficerData.js";
import { fmtTime } from "../../data/format.js";

export default function OfficerFarmsScreen() {
  const navigate = useNavigate();
  const o = useOfficerData();

  return (
    <AppShell title="District Farms" subtitle="Identified holdings · risk & emergency status">
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Risk & emergency status ({o.farms.length} farms)
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {o.farms.map((farm) => {
            const fdrs = o.getFDRS(farm);
            const band = fdrs ? fdrsBand(fdrs.total) : fdrsBand(0);
            const level = o.clusterLevelByFarm.get(farm.farm_id) || "normal";
            const latest = o.latestReportByFarm.get(farm.farm_id);
            const emoji = ANIMAL_ICONS[farm.animal_category]?.[farm.animal_type] || "🐾";
            return (
              <button
                key={farm.farm_id}
                onClick={() => {
                  console.log("farm:click", farm.farm_id);
                  navigate(`/farm/${farm.farm_id}`);
                }}
                className="w-full text-left bg-white rounded-xl border border-gray-100 p-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{farm.name}</p>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                          level === "critical"
                            ? "bg-red-600 text-white"
                            : level === "emerging"
                              ? "bg-amber-400 text-amber-900"
                              : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {level === "critical" ? "🚨 CRITICAL" : level === "emerging" ? "⚠️ EMERGING" : "normal"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {CATEGORY_LABELS[farm.animal_category]} · {farm.village} · herd {farm.herd_size}
                    </p>
                    {latest && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          {latest.affected_count || 0} affected
                        </span>
                        {(Number(latest.deaths) || 0) > 0 && (
                          <span className="text-[10px] font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                            ⚰️ {latest.deaths}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 truncate">
                          {(latest.symptoms || []).map((s) => SYMPTOM_LABEL[s] || s).slice(0, 2).join(", ")} · {fmtTime(latest.created_at)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${band.bg} ${band.text}`}>
                      FDRS {fdrs?.total ?? "--"}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{band.label} risk</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}