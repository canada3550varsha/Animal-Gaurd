import AppShell from "../../components/ui/AppShell.jsx";
import { SectionTitle } from "../../components/ui/primitives.jsx";
import ImpactMetrics from "../../components/ImpactMetrics.jsx";
import { useOfficerData } from "./useOfficerData.js";

export default function OfficerImpactScreen() {
  const o = useOfficerData();

  return (
    <AppShell title="Impact & Mortality" subtitle="Programme impact · structured mortality & trend">
      <div className="space-y-6">
        <section>
          <SectionTitle icon="📈">Programme impact</SectionTitle>
          <ImpactMetrics />
        </section>

        {o.mortality.d > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Mortality &amp; Trend (last 7 days)
            </h2>
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center justify-around gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold text-red-600">{o.mortality.d}</p>
                  <p className="text-[10px] text-gray-500">deaths (7d)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{o.mortality.rate}%</p>
                  <p className="text-[10px] text-gray-500">crude mortality rate</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{Math.max(o.mortality.a, o.mortality.d)}</p>
                  <p className="text-[10px] text-gray-500">affected, deaths reported</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[11px] font-semibold text-gray-500 mb-2">Daily deaths — 7-day trend</p>
                <div className="flex items-end gap-1.5 h-20">
                  {o.mortality.trend.map((t, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-gray-700">
                        {t.count > 0 ? t.count : ""}
                      </span>
                      <div
                        className={`w-full rounded-t ${
                          t.count === 0 ? "h-1 bg-gray-100" : t.count >= o.mortality.maxTrend ? "bg-red-500" : "bg-orange-400"
                        }`}
                        style={{ height: `${t.count === 0 ? 4 : Math.max(8, (t.count / o.mortality.maxTrend) * 64)}px` }}
                      />
                      <span className="text-[9px] text-gray-400">{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[11px] font-semibold text-gray-500 mb-2">Deaths by village (14d)</p>
                <div className="space-y-2">
                  {o.mortality.villages.map((v) => (
                    <div key={v.village}>
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <span className="text-gray-700 font-medium truncate">
                          {v.village} · {v.farms} farm{v.farms !== 1 ? "s" : ""}
                        </span>
                        <span className="text-gray-500">{v.deaths} dead</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${v.deaths >= o.mortality.maxVillage ? "bg-red-500" : "bg-orange-400"}`}
                          style={{ width: `${(v.deaths / o.mortality.maxVillage) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}