import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppShell from "../components/ui/AppShell.jsx";
import PrivacyNotice from "../components/ui/PrivacyNotice.jsx";
import { Stat, SectionTitle, EmptyState } from "../components/ui/primitives.jsx";
import { api, getToken } from "../api/client.js";
import { useApp } from "../context/AppContext.jsx";
import { ANIMAL_ICONS } from "../data/constants.js";
import { healthIcon, healthLabel } from "../data/health.js";
import { fmtShortDate } from "../data/format.js";

export default function HealthRecordsScreen() {
  const { farms } = useApp();
  const [records, setRecords] = useState([]);
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "all";

  useEffect(() => {
    let active = true;
    api
      .health(getToken())
      .then(({ records }) => active && setRecords(records || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const byFarm = farms
    .map((f) => {
      const recs = (records || []).filter((r) => r.farm_id === f.farm_id);
      const counts = { vaccination: 0, treatment: 0, deworming: 0, mortality: 0 };
      for (const r of recs) counts[r.record_type] = (counts[r.record_type] || 0) + 1;
      return { farm: f, recs, counts };
    })
    .filter((x) => x.recs.length > 0);

  const visibleRecords = (tab === "vaccination" ? records || [] : records || []).filter(
    (r) => tab === "all" || (tab === "vaccination" && r.record_type === "vaccination")
  );

  const totalVax = (records || []).filter((r) => r.record_type === "vaccination").length;
  const totalTx = (records || []).filter((r) => r.record_type === "treatment" || r.record_type === "deworming").length;

  return (
    <AppShell title="Health Records" subtitle="Vaccinations · treatments · deworming · mortality on your herds">
      <div className="space-y-6">
        <PrivacyNotice role="farmer" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat icon="💉" iconBg="bg-green-100" label="Vaccinations" value={totalVax} tone="green" sub="recorded by your vet team" />
          <Stat icon="💊" iconBg="bg-blue-100" label="Treatments & deworming" value={totalTx} tone="blue" sub="herd-level care events" />
          <Stat icon="🏡" iconBg="bg-indigo-100" label="Farms with records" value={byFarm.length} tone="ink" sub="herd health charts active" />
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          {[
            { code: "all", label: "All" },
            { code: "vaccination", label: "💉 Vaccinations only" },
          ].map((t) => (
            <button
              key={t.code}
              onClick={() => {
                const url = new URL(window.location.href);
                if (t.code === "all") url.searchParams.delete("tab");
                else url.searchParams.set("tab", t.code);
                window.location.href = url;
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                tab === t.code ? "bg-green-700 text-white" : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {visibleRecords.length === 0 ? (
          <EmptyState icon="💉" title="No health records yet" sub="Vaccinations, treatments and deworming your veterinary team records appear here." />
        ) : (
          <div className="space-y-5">
            {byFarm.map(({ farm, recs, counts }) => (
              <section key={farm.farm_id}>
                <SectionTitle icon={ANIMAL_ICONS[farm.animal_category]?.[farm.animal_type] || "🏡"}>
                  {farm.name}
                  <span className="ml-2 text-xs font-normal text-gray-400 normal-case">
                    {counts.vaccination} 💉 · {counts.treatment} 💊 · {counts.deworming} 🌰 · {counts.mortality} ⚰️
                  </span>
                </SectionTitle>
                <div className="grid gap-2 md:grid-cols-2">
                  {recs
                    .filter((r) => tab === "all" || r.record_type === "vaccination")
                    .slice()
                    .sort((a, b) => new Date(b.date || b.ts) - new Date(a.date || a.ts))
                    .map((x) => (
                      <div key={x.id} className="bg-white rounded-xl border border-gray-100 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg">{healthIcon(x.record_type)}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{x.name}</p>
                              <p className="text-[11px] text-gray-500 uppercase">{healthLabel(x.record_type)}</p>
                            </div>
                          </div>
                          <span className="text-[11px] text-gray-400 shrink-0">{fmtShortDate(x.date || x.ts)}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1.5">
                          {[x.dose, x.batch && `Batch ${x.batch}`, x.disease && `🎯 ${x.disease}`].filter(Boolean).join(" · ") || "—"}
                        </p>
                        {x.notes && <p className="text-[11px] text-gray-500 mt-1 leading-snug">{x.notes}</p>}
                        {x.drive_name && (
                          <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 font-medium">
                            📋 {x.drive_name}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}