import { useState } from "react";
import AppShell from "../components/ui/AppShell.jsx";
import PrivacyNotice from "../components/ui/PrivacyNotice.jsx";
import { Stat, SectionTitle, EmptyState } from "../components/ui/primitives.jsx";
import ZoonoticBadge from "../components/ZoonoticBadge.jsx";
import { useApp } from "../context/AppContext.jsx";
import { fmtTime } from "../data/format.js";

export default function MyAlertsScreen() {
  const { clusters, criticalClusters, inbox, farms } = useApp();
  const [lang, setLang] = useState("en");

  const active = clusters
    .filter((c) => c.level === "critical" || c.level === "emerging")
    .slice()
    .sort((a, b) => b.report_count - a.report_count);

  const messages = inbox.slice().sort((a, b) => b.ts - a.ts);
  const unread = messages.filter((m) => !m.read).length;

  return (
    <AppShell title="My Alerts" subtitle="Outbreak & response messages for your farms">
      <div className="space-y-6">
        <PrivacyNotice role="farmer" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat icon="🔔" iconBg="bg-amber-100" label="Messages" value={messages.length} tone="ink" sub={`${unread} unread`} />
          <Stat icon="🚨" iconBg="bg-red-100" label="Active alerts" value={active.length} tone={active.length > 0 ? "red" : "ink"} sub="critical + emerging nearby" />
          <Stat icon="🆘" iconBg="bg-rose-100" label="Critical" value={criticalClusters.length} tone={criticalClusters.length > 0 ? "red" : "ink"} sub="requires urgent action" />
        </div>

        {/* Alerts affecting the farmer's own farms */}
        <section>
          <SectionTitle icon="🚨">Outbreak alerts for your area</SectionTitle>
          {active.length === 0 ? (
            <EmptyState icon="✅" title="No active alerts" sub="All reports in your area are within normal parameters." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {active.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-2xl p-4 border ${
                    c.level === "critical" ? "border-2 border-red-600 bg-red-50" : "border border-amber-400 bg-amber-50"
                  }`}
                >
                  <p className={`font-bold ${c.level === "critical" ? "text-red-800" : "text-amber-800"}`}>
                    {c.level === "critical" ? "🚨 CRITICAL" : "⚠️ EMERGING"} — {c.village}
                  </p>
                  <p className={`text-sm mt-0.5 ${c.level === "critical" ? "text-red-700" : "text-amber-700"}`}>
                    {c.report_count} report(s) · {c.farm_count} farm(s) · {c.affected_animals ?? 0} affected
                  </p>
                  {c.last_report_at && (
                    <p className="text-[10px] text-gray-500 mt-1">Last report {fmtTime(c.last_report_at)}</p>
                  )}
                  <div className="mt-1.5">
                    <ZoonoticBadge item={c} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Messages addressed to the farmer */}
        <section>
          <SectionTitle icon="📥">Messages &amp; advisories</SectionTitle>
          {messages.length === 0 ? (
            <EmptyState icon="📭" title="No messages" sub="Vet dispatches and advisories for your farms will appear here." />
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-400">Language:</span>
                {[
                  { code: "en", label: "English" },
                  { code: "mr", label: "मराठी" },
                  { code: "hi", label: "हिंदी" },
                ].map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                      lang === l.code ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {messages.map((m) => {
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
                      <p className="text-sm text-gray-800 leading-relaxed mt-1">{m[lang] || m.en}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}