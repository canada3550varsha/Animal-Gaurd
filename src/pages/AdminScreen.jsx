import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getToken, reqError } from "../api/client.js";

const ACTION_LABEL = {
  register_farm: "Register Farm",
  dispatch_vet: "Dispatch Vet",
  send_advisory: "Send Advisory",
};

export default function AdminScreen() {
  const navigate = useNavigate();
  const [audit, setAudit] = useState(null); // { integrity, log }
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
    return () => {
      active = false;
    };
  }, []);

  const renderAction = (a) => {
    const data = a.data || {};
    const label = ACTION_LABEL[a.action] || a.action;
    const detail =
      a.action === "register_farm"
        ? `Farm ${data.farm_id || "—"}`
        : `${data.report_count} cases / ${data.farm_count} farms in ${data.village || "—"} (${data.animal_category || ""})`;
    return { label, detail };
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-gray-900 text-white px-4 py-4 shadow-md">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-xl">←</button>
          <div>
            <h1 className="text-lg font-bold">Admin — Audit Trail</h1>
            <p className="text-xs text-gray-400">Tamper-evident SHA-256 hash chain</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {loading && <p className="text-gray-400 text-center py-10">Loading audit log…</p>}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">
            {error}
          </div>
        )}

        {audit && (
          <>
            {/* Integrity indicator */}
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

            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-3">
                Entries <span className="text-sm font-normal text-gray-400">({audit.log.length})</span>
              </h2>
              {audit.log.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  No audit entries yet. Actions like vet dispatch and farm registration will appear here.
                </div>
              ) : (
                <div className="space-y-2">
                  {audit.log
                    .slice()
                    .reverse()
                    .map((e) => {
                      const { label, detail } = renderAction(e);
                      const shortHash = e.hash.slice(0, 10);
                      return (
                        <div key={e.seq} className="bg-white rounded-xl border border-gray-100 p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900 text-sm">
                              #{e.seq} · {label}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(e.ts).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">{detail}</p>
                          <p className="text-[10px] text-gray-400 mt-1 font-mono">
                            actor: {e.actor} · hash: {shortHash}…
                          </p>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
