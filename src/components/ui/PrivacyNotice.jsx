const PRIVACY_BY_ROLE = {
  farmer: {
    icon: "🔒",
    cls: "bg-green-50 border-green-200 text-green-800",
    title: "Private to you",
    text: "You only ever see your own farms and livestock health data. What you submit is shared only with the authorised veterinary & district team for your area — never with other farmers.",
  },
  vet: {
    icon: "🛡️",
    cls: "bg-blue-50 border-blue-200 text-blue-800",
    title: "Authorized identified access",
    text: "You see full case data only for farms in your assigned jurisdiction. Every dispatch, advisory, health record and escalation is recorded in the tamper-evident audit log.",
  },
  admin: {
    icon: "🔍",
    cls: "bg-indigo-50 border-indigo-200 text-indigo-800",
    title: "Aggregated & de-identified",
    text: "The district surveillance view shows grouped metrics without farm or owner identity. Identified access to critical cases is gated and fully audited — see Critical Case Access.",
  },
  lab: {
    icon: "🧪",
    cls: "bg-amber-50 border-amber-200 text-amber-800",
    title: "Need-to-know only",
    text: "You receive referred samples with case & sample references plus the referring officer — not farm names or herd sizes. Results flow back to the farm record automatically.",
  },
};

export default function PrivacyNotice({ role, compact = false }) {
  const p = PRIVACY_BY_ROLE[role] || PRIVACY_BY_ROLE.farmer;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border ${p.cls} ${compact ? "p-3" : "p-4"}`}>
      <span className={`${compact ? "text-lg" : "text-2xl"} leading-none shrink-0`}>{p.icon}</span>
      <div className="min-w-0">
        <p className={`font-bold ${compact ? "text-xs" : "text-sm"} leading-tight`}>{p.title}</p>
        <p className={`${compact ? "text-[11px]" : "text-xs"} mt-0.5 opacity-90 leading-snug`}>{p.text}</p>
      </div>
    </div>
  );
}