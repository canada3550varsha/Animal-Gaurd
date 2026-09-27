// Shared dashboard primitives — pure presentational, no logic. Every screen uses
// these so the whole app inherits one consistent card/stat/status language.

export function Card({ className = "", children, ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

// KPI summary stat card. `value` renders as the big number/label, `sub` as the
// supporting line. `tone` accents the value: "buy"/"red"/"amber"/"alert".
export function Stat({ icon, iconBg = "bg-gray-100", label, value, sub, tone = "" }) {
  const toneCls = {
    green: "text-green-600",
    red: "text-red-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    ink: "text-ink",
  }[tone] || "text-ink";
  return (
    <Card className="p-4 flex items-start gap-3">
      {icon && (
        <span className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center text-xl shrink-0`}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className={`text-2xl font-bold leading-tight truncate ${toneCls}`}>{value}</p>
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{sub}</p>}
      </div>
    </Card>
  );
}

export function SectionTitle({ icon, children, right, className = "" }) {
  return (
    <div className={`flex items-center justify-between gap-3 mb-3 ${className}`}>
      <h2 className="section-title flex items-center gap-1.5">
        {icon && <span className="text-base">{icon}</span>}
        <span>{children}</span>
      </h2>
      {right}
    </div>
  );
}

export function EmptyState({ icon = "🗂️", title, sub, action }) {
  return (
    <Card className="p-8 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="font-semibold text-ink-soft">{title}</p>
      {sub && <p className="text-sm text-gray-400 mt-1">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

// Small labelled status pill. `cls` may override the default soft style.
export function Badge({ children, cls = "bg-gray-100 text-gray-600", className = "" }) {
  return (
    <span className={`chip ${cls} ${className}`}>{children}</span>
  );
}