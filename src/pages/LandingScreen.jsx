import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { reqError } from "../api/client.js";

// Role-selection welcome page — replaces the old login. Tapping a role signs the
// app in as that role's demo user and opens its dashboard directly.
const ROLES = [
  {
    key: "farmer",
    icon: "🧑‍🌾",
    title: "Livestock Owner",
    desc: "Manage my farms, poultry & livestock, report symptoms by voice or typing.",
    accent: "bg-green-100",
  },
  {
    key: "vet",
    icon: "🩺",
    title: "Veterinary",
    desc: "District outbreak dashboard, lab diagnostics and case escalation.",
    accent: "bg-blue-100",
  },
  {
    key: "admin",
    icon: "🛡️",
    title: "Admin",
    desc: "Tamper-evident audit log and district officer escalation console.",
    accent: "bg-indigo-100",
  },
  {
    key: "lab",
    icon: "🧪",
    title: "Lab",
    desc: "Receive referred samples and return test results to farm records.",
    accent: "bg-amber-100",
  },
];

const DEST = { farmer: "/owner", vet: "/vet", admin: "/admin", lab: "/lab" };

export default function LandingScreen() {
  const navigate = useNavigate();
  const { selectRole } = useApp();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const enter = async (role) => {
    if (busy) return;
    setBusy(role);
    setError("");
    try {
      await selectRole(role);
      navigate(DEST[role]);
    } catch (e) {
      setError(reqError(e));
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        {/* Logo + app identity */}
        <div className="flex flex-col items-center">
          <span className="w-16 h-16 rounded-2xl bg-primary shadow-lg shadow-primary/30 flex items-center justify-center text-3xl">
            🐄
          </span>
          <h1 className="text-2xl font-bold text-ink mt-3 tracking-tight">AnimalGuard</h1>
          <p className="text-sm text-gray-400 mt-1 text-center max-w-xs">
            Livestock & poultry outbreak surveillance — early detection to response, end to end.
          </p>
        </div>

        {/* Welcome block */}
        <div className="text-center mt-8">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">Welcome back</h2>
          <p className="text-sm text-gray-500 mt-2">Choose your role to continue</p>
        </div>

        {/* Role cards */}
        <div className="w-full max-w-4xl mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => enter(r.key)}
              disabled={busy !== null}
              title={`Continue as ${r.title}`}
              className="relative text-left bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5 pr-9 min-h-[150px]
                         transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40
                         active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait touch-manipulation"
            >
              <span className={`w-12 h-12 rounded-xl ${r.accent} flex items-center justify-center text-2xl`}>
                {r.icon}
              </span>
              <p className="font-bold text-ink-soft mt-3">{r.title}</p>
              <p className="text-xs text-gray-500 leading-snug mt-1">{r.desc}</p>
              <span
                className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-lg text-gray-300 ${
                  busy === r.key ? "animate-pulse text-gray-400" : ""
                }`}
              >
                {busy === r.key ? "…" : "›"}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <p className="text-red-600 text-sm mt-6 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</p>
        )}

        <p className="text-[11px] text-gray-400 mt-10">
          Demo instance — signing in automatically with the role's sample account
        </p>
      </main>
    </div>
  );
}