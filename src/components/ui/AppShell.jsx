import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";

const ROLE_LABEL = {
  farmer: "Livestock Owner",
  vet: "Veterinary Officer",
  admin: "District Admin",
  lab: "Lab Analyst",
};

// Role-scoped navigation, grouped into labelled sections. Every entry points at
// a real route. The DEMO/INFORMATION group is shared by all roles.
const DEMO_INFO = [
  { to: "/architecture", icon: "🏗️", label: "Architecture" },
  { to: "/walkthrough", icon: "🎬", label: "Walkthrough" },
];

const NAV = {
  farmer: [
    {
      label: "Main",
      items: [
        { to: "/owner", icon: "🏡", label: "Dashboard" },
        { to: "/my-alerts", icon: "🔔", label: "Alerts" },
      ],
    },
    {
      label: "Farm Management",
      items: [
        { to: "/register-farm", icon: "➕", label: "Register Farm" },
        { to: "/profile", icon: "👤", label: "Profile" },
      ],
    },
    {
      label: "Health & Reporting",
      items: [
        { to: "/voice-report", icon: "🎤", label: "Voice Report" },
        { to: "/my-reports", icon: "📄", label: "My Reports" },
        { to: "/health-records", icon: "💉", label: "Health Records" },
        { to: "/my-lab", icon: "🧪", label: "Lab Results" },
      ],
    },
  ],
  vet: [
    {
      label: "Main",
      items: [{ to: "/vet", icon: "📊", label: "Dashboard" }],
    },
    {
      label: "Operations",
      items: [
        { to: "/vet/cases", icon: "🚨", label: "Cases & Alerts" },
        { to: "/vet/map", icon: "🗺️", label: "Outbreak Map" },
        { to: "/vet/farms", icon: "🏡", label: "District Farms" },
      ],
    },
    {
      label: "Lab & Health",
      items: [
        { to: "/vet/samples", icon: "🧪", label: "Lab Referrals" },
        { to: "/vet/health", icon: "💉", label: "Herd Health" },
      ],
    },
    {
      label: "Response & Insights",
      items: [
        { to: "/vet/escalations", icon: "🔺", label: "Escalations" },
        { to: "/vet/impact", icon: "📈", label: "Impact & Mortality" },
      ],
    },
  ],
  admin: [
    {
      label: "Main",
      items: [{ to: "/admin", icon: "🛡️", label: "Surveillance" }],
    },
    {
      label: "Response",
      items: [{ to: "/admin/escalations", icon: "🔺", label: "Escalations" }],
    },
    {
      label: "Oversight",
      items: [
        { to: "/admin/audit", icon: "🧾", label: "Audit Log" },
        { to: "/admin/critical", icon: "🚨", label: "Critical Case Access" },
      ],
    },
  ],
  lab: [
    {
      label: "Main",
      items: [{ to: "/lab", icon: "📊", label: "Dashboard" }],
    },
    {
      label: "Samples",
      items: [
        { to: "/lab/inbox", icon: "📥", label: "Inbox" },
        { to: "/lab/results", icon: "🔬", label: "Completed" },
        { to: "/lab/history", icon: "🧾", label: "History" },
      ],
    },
  ],
};

function NavButton({ item, collapsed, onNavigate }) {
  const { pathname } = useLocation();
  const active = (item.match || [item.to]).some((p) =>
    p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")
  );
  return (
    <button
      onClick={() => onNavigate(item.to)}
      title={collapsed ? item.label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active
          ? "bg-primary/15 text-white"
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <span className="text-lg leading-none">{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {active && !collapsed && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-light" />}
    </button>
  );
}

export default function AppShell({ title, subtitle, actions, children }) {
  const { user, role, inbox, lastSyncedAt } = useApp();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  const unread = (inbox || []).filter((m) => !m.read).length;
  const initials = (user?.name || "U")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const goTo = (to) => {
    setDrawer(false);
    navigate(to);
  };

  const bellTarget = role === "vet" ? "/vet/cases" : role === "admin" ? "/admin" : role === "lab" ? "/lab/inbox" : "/my-alerts";

  const groups = NAV[role] || [];

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 h-16 shrink-0">
        <span className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-lg shrink-0">🐄</span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-white leading-tight truncate">AnimalGuard</p>
            <p className="text-[10px] text-slate-400 truncate">Livestock · Poultry surveillance</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {groups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? "mt-4" : ""}>
            {!collapsed && (
              <p className="px-3 pb-1 text-[10px] uppercase tracking-widest text-slate-500">{group.label}</p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavButton key={item.to + item.label} item={item} collapsed={collapsed} onNavigate={goTo} />
              ))}
            </div>
          </div>
        ))}

        <div className="mt-4 border-t border-white/10 pt-3">
          {!collapsed && (
            <p className="px-3 pb-1 text-[10px] uppercase tracking-widest text-slate-500">Demo / Information</p>
          )}
          <div className="space-y-1">
            {DEMO_INFO.map((item) => (
              <NavButton key={item.to} item={item} collapsed={collapsed} onNavigate={goTo} />
            ))}
          </div>
        </div>
      </nav>

      <div className="p-3 border-t border-white/10 space-y-1">
        <NavButton
          item={{ to: "/", icon: "🔄", label: "Switch Role" }}
          collapsed={collapsed}
          onNavigate={goTo}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-ink transition-[width] duration-200 ${
          collapsed ? "w-[76px]" : "w-64"
        }`}
      >
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-ink shadow-2xl flex flex-col">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200/70 h-16 shrink-0 sticky top-0 z-30">
          <div className="h-full flex items-center gap-3 px-4 lg:px-6">
            <button
              onClick={() => setDrawer(true)}
              className="lg:hidden btn-ghost p-2 -ml-1 text-xl leading-none"
              title="Open menu"
              aria-label="Open menu"
            >
              ☰
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-ink text-lg leading-tight truncate">{title}</h1>
              {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
            </div>

            {/* LIVE poll indicator */}
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600" />
              </span>
              LIVE{typeof lastSyncedAt === "number" ? ` · ${Math.round((Date.now() - lastSyncedAt) / 1000)}s` : ""}
            </span>

            {actions}

            {/* Notifications */}
            <button
              onClick={() => goTo(bellTarget)}
              className="relative btn-ghost p-2 text-xl leading-none"
              title="Notifications & alerts"
              aria-label="Notifications"
            >
              🔔
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>

            {/* Collapse toggle (desktop) */}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="hidden lg:inline-flex btn-ghost p-2 text-sm leading-none"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label="Toggle sidebar"
            >
              {collapsed ? "⇥" : "⇤"}
            </button>

            {/* User chip */}
            <button
              onClick={() => goTo("/")}
              className="hidden sm:flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              title="Switch role / sign out"
            >
              <span className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                {initials}
              </span>
              <span className="text-left leading-tight">
                <span className="block text-xs font-semibold text-ink-soft">{user?.name}</span>
                <span className="block text-[10px] text-gray-400">{ROLE_LABEL[role] || role}</span>
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 lg:px-6 py-5 lg:py-6 space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}