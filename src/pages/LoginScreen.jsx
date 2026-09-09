import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { reqError } from "../api/client.js";

export default function LoginScreen() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (mobile.length !== 10 || !/^\d{10}$/.test(mobile)) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
      setError("Enter a valid 4-digit code");
      return;
    }
    setSubmitting(true);
    try {
      await login(mobile, code);
      navigate("/");
    } catch (err) {
      setError(reqError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-primary">Animal Guard</h1>
          <p className="text-sm text-gray-500 mt-1">Livestock Disease Early Warning</p>
          <p className="text-xs text-gray-400 mt-1">SIH26128 — Govt of Maharashtra</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile number"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-lg"
              maxLength={10}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">4-Digit Code</label>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Any 4-digit code"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-lg tracking-widest text-center"
              maxLength={4}
            />
          </div>

          {error && <p className="text-red-600 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors text-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          Demo: 9876543210 (Farmer) · 9123456780 (Vet) · 9988776655 (Admin) — any 4-digit code
        </p>

        <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
          <button
            onClick={() => navigate("/architecture")}
            className="w-full py-2.5 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm"
          >
            🏗️ System Architecture (SIH26128)
          </button>
          <button
            onClick={() => navigate("/walkthrough")}
            className="w-full py-2.5 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors text-sm"
          >
            🎬 Judge Walkthrough
          </button>
        </div>
      </div>
    </div>
  );
}
