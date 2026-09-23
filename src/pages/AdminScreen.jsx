import { useEffect, useState } from "react";
import { api, getToken, reqError } from "../api/client.js";
import AppShell from "../components/ui/AppShell.jsx";
import { Stat, SectionTitle } from "../components/ui/primitives.jsx";
import EscalationPanel from "../components/EscalationPanel.jsx";

const ACTION_LABEL = {
  register_farm: { label: "Register Farm", icon: "🏡" },
  report_submitted: { label: "Report Submitted", icon: "🩺" },
  auto_detect: { label: "AI Auto-Detect (Sensed)", icon: "🛰️" },
  dispatch_vet: { label: "Dispatch Vet", icon: "🚓" },
  send_advisory: { label: "Send Advisory", icon: "📢" },
  health_record: { label: "Health Record (Vaccine/Treatment)", icon: "💉" },
  vaccination_drive: { label: "Vaccination Drive", icon: "🚀" },
  sample_collected: { label: "Lab Sample Collected", icon: "🧪" },
  lab_result: { label: "Lab Result", icon: "🔬" },
  escalation: { label: "Case Escalated", icon: "🔺" },
  escalation_followup: { label: "Escalation Follow-up", icon: "🔁" },
};

const ACTOR_LABEL = {
  u_farmer1: "Farmer 3210",
  u_vet1: "Dr. Anil Veterinary",
  u_admin1: "Admin Officer",
  u_lab1: "Lab Analyst",
  "system:autonomous": "Automated sensor scan",
};

function timeAgo(ts) {
  const d = new Date(ts).getTime();
  if (!Number.isFinite(d)) return "";
  const mins = Math.max(0, Math.round((Date.now() - d) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

export default function AdminScreen() {
  const [audit, setAudit] = useState(null); // { integrity, log }
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [clusters, setClusters] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.audit(getToken());
        if (active) setAudit(data);
      } catch (e) {
        if (e?.status === 403) setError("Forbidden: admin access required");
        else setError(reqError(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    api
      .clusters(getToken())
      .then((d) => active && setClusters(d.clusters || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const renderAction = (a) => {
    const data = a.data || {};
    const meta = ACTION_LABEL[a.action] || { label: a.action, icon: "📄" };
    const lines = [];
    if (a.action === "register_farm") {
      lines.push(`Farm: ${data.farm_name || data.farm_id} (${data.farm_id})`);
      lines.push(`${data.animal_type || "—"} · herd ${data.herd_size ?? "—"}`);
      lines.push(`📍 ${data.village}, ${data.taluka}, ${data.district}`);
    } else if (a.action === "report_submitted") {
      lines.push(`Farm: ${data.farm_name || data.farm_id} (${data.farm_id})`);
      lines.push(`🐾 ${(data.symptoms || []).join(", ")} · ${data.affected_count} animal(s) affected`);
      if (data.deaths) lines.push(`⚰️ Mortality: ${data.deaths} death${data.deaths !== 1 ? "s" : ""}`);
      lines.push(`📍 ${data.village}, ${data.taluka}, ${data.district}`);
      if (data.notes || data.has_photo) {
        lines.push([data.has_photo ? "📷 photo" : null, data.notes || null].filter(Boolean).join(" · "));
      }
    } else if (a.action === "auto_detect") {
      lines.push(`Farm: ${data.farm_name || data.farm_id} (${data.farm_id})`);
      lines.push(`🦠 ${data.disease} · risk score ${data.score}/100 · env risk ${data.env_risk}/25`);
      lines.push(`📍 ${data.village}, ${data.taluka}, ${data.district}`);
      if (data.sensing_reading_id) lines.push(`Sensing reading: ${data.sensing_reading_id}`);
    } else if (a.action === "health_record") {
      const typeMeta = {
        vaccination: "💉 Vaccination",
        treatment: "💊 Treatment",
        deworming: "🌰 Deworming",
        mortality: "⚰️ Mortality",
      };
      lines.push(`${typeMeta[data.record_type] || data.record_type} — ${data.name || "—"}`);
      lines.push(`Farm: ${data.farm_name || data.farm_id} (${data.farm_id})`);
      if (data.disease || data.dose || data.batch) {
        lines.push([data.disease && `🎯 ${data.disease}`, data.dose || null, data.batch && `Batch ${data.batch}`].filter(Boolean).join(" · "));
      }
      lines.push(`📍 ${data.village}, ${data.taluka}, ${data.district}`);
      if (data.notes) lines.push(`📝 ${data.notes}`);
    } else if (a.action === "vaccination_drive") {
      lines.push(`Drive: ${data.name || data.drive_id}`);
      if (data.disease || data.vaccine) lines.push(`🎯 ${data.disease || "—"} · 💉 ${data.vaccine || "—"}`);
      lines.push(`📍 ${data.taluka || "All talukas"}, ${data.district} · ${data.animal_category || "—"}`);
      if (data.status) lines.push(`Status: ${data.status.toUpperCase()}`);
    } else if (a.action === "sample_collected") {
      lines.push(`Sample ${data.sample_type} from ${data.farm_name}`);
      if (data.suspected_disease) lines.push(`🦠 Suspected ${data.suspected_disease}`);
      lines.push(`🔬 → ${data.lab_name}`);
      lines.push(`📍 ${data.village}, ${data.taluka}, ${data.district}`);
    } else if (a.action === "lab_result") {
      lines.push(`Sample ${data.sample_type} · ${data.farm_name} · ${data.result.toUpperCase()}`);
      if (data.pathogen) lines.push(`🦠 Pathogen: ${data.pathogen}`);
      lines.push(`📍 ${data.village}, ${data.taluka}, ${data.district}`);
      if (data.remarks) lines.push(`📝 ${data.remarks}`);
    } else if (a.action === "escalation") {
      const LEVEL_TAG = { officer: "🏛️ District Officer", referral: "🏥 Dispensary Referral", hospital: "🚑 Vet Hospital" };
      lines.push(`${LEVEL_TAG[data.level] || data.level} — ${data.cluster_id}`);
      lines.push(`📍 ${data.village}, ${data.district} · ${data.report_count} case(s) · ${data.farm_count} farm(s)`);
      lines.push(`→ ${data.target}`);
      if (data.notes) lines.push(`📝 ${data.notes}`);
    } else if (a.action === "escalation_followup") {
      lines.push(`Escalation ${data.escalation_id} · cluster ${data.cluster_id}`);
      lines.push(`📍 ${data.village}, ${data.district}`);
      lines.push(`Status → ${data.status.toUpperCase()}`);
      if (data.note) lines.push(`📝 ${data.note}`);
    } else {
      lines.push(`${data.report_count} case(s) · ${data.farm_count} farm(s) · ${data.animal_category || "—"}`);
      lines.push(`📍 ${data.village}`);
      lines.push(`Cluster ${data.cluster_id} · ${(data.report_ids || []).length} report(s) covered`);
    }
    return { label: meta.label, icon: meta.icon, lines };
  };

  const activeClusters = clusters.filter((c) => c.level === "critical" || c.level === "emerging").length;

  return (
    <AppShell title="Admin — District Officer Console" subtitle="Case escalations · tamper-evident SHA-256 audit chain">
      {/* KPI summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat icon="📜" iconBg="bg-indigo-100" label="Audit entries" value={audit ? audit.log.length : "—"} tone="ink" sub="chain includes escalations & lab results" />
        <Stat
          icon={audit?.integrity?.valid ? "🟢" : "🔴"}
          iconBg={audit?.integrity?.valid ? "bg-green-100" : "bg-red-100"}
          label="Chain integrity"
          value={audit ? (audit.integrity?.valid ? "Intact" : "Tampered") : "—"}
          tone={audit?.integrity?.valid ? "green" : "red"}
          sub="SHA-256 hash chain verified"
        />
        <Stat icon="🚨" iconBg="bg-red-100" label="Active clusters" value={activeClusters} tone={activeClusters > 0 ? "red" : "ink"} sub={`${clusters.filter((c) => c.level === "critical").length} critical in district`} />
      </div>

      {loading && <p className="text-gray-400 text-center py-10">Loading admin console…</p>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* District officer watchboard: escalations + audit integrity side-by-side */}
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <section>
          <SectionTitle icon="🔺">Case escalation &amp; referral ladder</SectionTitle>
          <EscalationPanel clusters={clusters} />
        </section>

        {audit && (
          <section>
            <SectionTitle icon="🔐">Audit integrity</SectionTitle>
            <div
              className={`rounded-2xl p-4 border ${
                audit.integrity?.valid
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-300 text-red-800"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <span>{audit.integrity?.valid ? "🟢" : "🔴"}</span>
                {audit.integrity?.valid
                  ? "Audit chain intact — no tampering detected"
                  : `TAMPER DETECTED at entry #${audit.integrity.brokenIndex + 1}`}
              </div>
              <p className="text-xs mt-1 opacity-80">
                SHA-256 hash chain: editing any past entry breaks all subsequent hashes.
              </p>
            </div>
          </section>
        )}
      </div>

        {audit && (
          <>
            <div>
              <SectionTitle icon="🧾">
                Entries <span className="text-sm font-normal text-gray-400 normal-case">({audit.log.length})</span>
              </SectionTitle>
              {audit.log.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  No audit entries yet. Actions like vet dispatch and farm registration will appear here.
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {audit.log
                    .slice()
                    .reverse()
                    .map((e) => {
                      const { label, icon, lines } = renderAction(e);
                      const shortHash = e.hash.slice(0, 10);
                      const when = new Date(e.ts).toLocaleString();
                      return (
                        <div key={e.seq} className="bg-white rounded-xl border border-gray-100 p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900 text-sm">
                              #{e.seq} · {icon} {label}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">{shortHash}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            📅 {when} <span className="text-gray-400">({timeAgo(e.ts)})</span>
                          </p>
                          <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                            {lines.map((l, i) => (
                              <p key={i}>{l}</p>
                            ))}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1.5 font-mono">
                            by {ACTOR_LABEL[e.actor] || e.actor}
                          </p>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </>
        )}
    </AppShell>
  );
}
