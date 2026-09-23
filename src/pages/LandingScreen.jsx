import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { reqError } from "../api/client.js";

// Role-selection home: replaces the old login page. Tapping a role signs the app
// in as that role's demo user and drops straight into the role's dashboard.
const ROLES = [
  {
    key: "farmer",
    icon: "🧑‍🌾",
    title: "Livestock Owner",
    desc: "Farms · poultry & livestock",
    accent: "bg-green-100",
    border: "hover:border-green-300",
  },
  {
    key: "vet",
    icon: "🩺",
    title: "Veterinary Officer",
    desc: "Outbreak dashboard",
    accent: "bg-blue-100",
    border: "hover:border-blue-300",
  },
  {
    key: "admin",
    icon: "🛡️",
    title: "Admin",
    desc: "Audit & escalation",
    accent: "bg-indigo-100",
    border: "hover:border-indigo-300",
  },
  {
    key: "lab",
    icon: "🧪",
    title: "Lab",
    desc: "Test reports",
    accent: "bg-amber-100",
    border: "hover:border-amber-300",
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
      <header className="bg-gray-900 text-white px-4 py-6 shadow-md text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          🐄🐔 AnimalGuard
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Livestock & poultry outbreak surveillance · SIH26128
        </p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 w-full">
        <p className="text-sm text-gray-600 mb-5 font-medium">Choose your role</p>

        <div className="grid grid-cols-2 gap-3 w-full max-w-3xl sm:gap-4 lg:grid-cols-4">
          {ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => enter(r.key)}
              disabled={busy !== null}
              title={`Enter as ${r.title}`}
              className={`bg-white rounded-2xl border-2 border-transparent shadow-sm p-5 flex flex-col items-center gap-2
                          min-h-[150px] touch-manipulation select-none
                          transition-transform duration-150 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]
                          disabled:opacity-60 disabled:cursor-wait ${r.border}`}
            >
              <span className={`w-16 h-16 rounded-2xl ${r.accent} flex items-center justify-center text-4xl`}>
                {r.icon}
              </span>
              <span className="text-sm font-bold text-gray-900 leading-tight text-center">{r.title}</span>
              <span className="text-xs text-gray-500 text-center">{r.desc}</span>
              {busy === r.key && <span className="text-xs text-gray-400 animate-pulse">Entering…</span>}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-red-600 text-sm mt-5 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</p>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => navigate("/architecture")}
            className="text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 px-4 py-2 rounded-xl transition-colors"
          >
            🔧 Architecture
          </button>
          <button
            onClick={() => navigate("/walkthrough")}
            className="text-sm text-white bg-amber-500 hover:bg-amber-600 px-4 py-2 rounded-xl font-medium transition-colors"
          >
            🎬 Walkthrough
          </button>
        </div>
      </main>
    </div>
  );
}