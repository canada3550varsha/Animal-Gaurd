import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../../components/ui/AppShell.jsx";
import PrivacyNotice from "../../components/ui/PrivacyNotice.jsx";
import { Stat, SectionTitle } from "../../components/ui/primitives.jsx";
import { api, getToken, reqError } from "../../api/client.js";

const MODULES = [
  { to: "/lab/inbox", icon: "📥", label: "Sample Inbox", desc: "Awaiting result — record test outcomes", tint: "bg-amber-50 border-amber-100" },
  { to: "/lab/results", icon: "🔬", label: "Completed", desc: "Returned results, newest first", tint: "bg-green-50 border-green-100" },
  { to: "/lab/history", icon: "🧾", label: "History", desc: "Full referred-sample record", tint: "bg-gray-50 border-gray-100" },
];

export default function LabDashboardScreen() {
  const navigate = useNavigate();
  const [samples, setSamples] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .samples(getToken())
      .then((data) => active && setSamples(data.samples || []))
      .catch((e) => active && setError(reqError(e)));
    return () => {
      active = false;
    };
  }, []);

  const pending = samples.filter((s) => s.status === "awaiting_result");
  const resulted = samples.filter((s) => s.status === "resulted");

  return (
    <AppShell title="Laboratory Dashboard" subtitle="District vet lab · need-to-know sample processing">
      <div className="space-y-6">
        <PrivacyNotice role="lab" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat icon="🧪" iconBg="bg-amber-100" label="Pending results" value={pending.length} tone="amber" sub="awaiting laboratory result" />
          <Stat icon="🔬" iconBg="bg-green-100" label="Result returned" value={resulted.length} tone="green" sub="returned to farm records" />
          <Stat icon="🧫" iconBg="bg-gray-100" label="Total samples" value={samples.length} tone="ink" sub="referred to this lab" />
        </div>

        {error && <p className="text-red-600 text-sm text-center bg-red-50 rounded-xl py-2 px-3">{error}</p>}

        <section>
          <SectionTitle icon="🧭">Sample workflows</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            {MODULES.map((m) => (
              <button
                key={m.to}
                onClick={() => navigate(m.to)}
                className={`w-full text-left bg-white rounded-2xl border p-4 hover:shadow-md transition-shadow ${m.tint}`}
              >
                <span className="text-2xl">{m.icon}</span>
                <p className="font-semibold text-gray-900 mt-2">{m.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {pending.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-amber-800">
              📥 {pending.length} sample{pending.length === 1 ? "" : "s"} awaiting your result
            </p>
            <button
              onClick={() => navigate("/lab/inbox")}
              className="mt-2 text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-700"
            >
              Open inbox →
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}