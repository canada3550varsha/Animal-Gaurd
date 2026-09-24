import { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { SYMPTOMS, ANIMAL_ICONS } from "../data/constants.js";
import AppShell from "../components/ui/AppShell.jsx";
import VoiceReportFlow from "../components/VoiceReportFlow.jsx";
import { reqError } from "../api/client.js";
import { T } from "../data/i18n.js";

// ONE reporting workflow: pick a farm (player's own), then report by manual form
// or no-typing voice. Voice is a mode inside this page — not a separate page.
export default function ReportScreen() {
  const { farms, addReport, lang } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const fromFarm = searchParams.get("farm");
  const preferredFarm =
    fromFarm && farms.some((f) => f.farm_id === fromFarm) ? fromFarm : farms.length === 1 ? farms[0].farm_id : "";

  const [farmId, setFarmId] = useState(preferredFarm || "");
  const [mode, setMode] = useState(searchParams.get("mode") === "voice" ? "voice" : "manual");

  const farm = farms.find((f) => f.farm_id === farmId);

  // ---- manual form state ----
  const [selected, setSelected] = useState([]);
  const [affectedCount, setAffectedCount] = useState("");
  const [deaths, setDeaths] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [vision, setVision] = useState(null);
  const fileRef = useRef(null);

  const symptoms = farm ? SYMPTOMS[farm.animal_category] || [] : [];
  const categoryIcon = farm ? ANIMAL_ICONS[farm.animal_category]?.[farm.animal_type] || "🐾" : "🐾";

  const toggleSymptom = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPhoto({ file, previewUrl });
    setVision(null);
  };

  const removePhoto = () => {
    if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    setPhoto(null);
    setVision(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!farm || selected.length === 0 || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const report = await addReport({
        farm_id: farm.farm_id,
        symptoms: selected,
        affected_count: parseInt(affectedCount, 10) || 0,
        deaths: deaths === "" ? undefined : parseInt(deaths, 10),
        notes,
        photo: photo?.file || null,
      });
      if (report?.description) setVision({ description: report.description, confidence: report.confidence });
      setSubmitted(true);
    } catch (err) {
      setError(reqError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const resetAfterDone = () => {
    setSubmitted(false);
    setSelected([]);
    setAffectedCount("");
    setDeaths("");
    setNotes("");
    setPhoto(null);
    setVision(null);
    navigate(farmId ? `/farm/${farmId}` : "/my-farm");
  };

  return (
    <AppShell title={T(lang, "Report Symptoms")} subtitle={T(lang, "One reporting workflow — manual, voice or photo")}>
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 bg-gray-100 rounded-2xl p-1.5">
          <button
            onClick={() => setMode("manual")}
            className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              mode === "manual" ? "bg-white shadow-sm text-ink" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            ✍️ {T(lang, "Manual Report")}
          </button>
          <button
            onClick={() => setMode("voice")}
            className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              mode === "voice" ? "bg-white shadow-sm text-ink" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            🎤 {T(lang, "No-Typing Voice")}
          </button>
        </div>

        {/* Farm picker (only the farmer's own farms) */}
        {!farm && (
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">{T(lang, "Select your farm")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {farms.map((f) => (
                <button
                  key={f.farm_id}
                  onClick={() => setFarmId(f.farm_id)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border bg-white transition-colors hover:border-primary"
                >
                  <span className="font-medium text-sm">{f.name}</span>
                  <span className="text-gray-400 text-xs">
                    {f.herd_size} {f.animal_type}(s) · {f.village}
                  </span>
                </button>
              ))}
            </div>
            {farms.length === 0 && (
              <p className="text-sm text-gray-400">
                No farms registered yet —{" "}
                <button onClick={() => navigate("/register-farm")} className="text-primary font-semibold hover:underline">
                  register your farm first
                </button>
              </p>
            )}
          </div>
        )}

        {submitted && (
          <div className="text-center bg-white rounded-2xl p-8 shadow-sm max-w-sm mx-auto">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold mb-2">Report Submitted</h2>
            <p className="text-sm text-gray-500 mb-1">
              {selected.length} symptom(s) reported for {farm?.name}
            </p>
            {(parseInt(affectedCount, 10) || 0) > 0 && (
              <p className="text-xs text-gray-400 mb-1">
                {affectedCount} affected · {deaths === "" ? 0 : deaths} dead
              </p>
            )}
            {vision && (
              <div className="text-left bg-gray-50 rounded-xl p-3 my-3 text-sm">
                <p className="text-xs text-gray-400 mb-1">AI Vision Analysis ({vision.confidence}% confidence)</p>
                <p className="text-gray-700">{vision.description}</p>
              </div>
            )}
            <p className="text-xs text-gray-400 mb-6">
              This report now contributes to the farm's FDRS ReportedCases score and notifies your veterinary team.
            </p>
            <button
              onClick={resetAfterDone}
              className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {farm && !submitted && mode === "manual" && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-3xl">{categoryIcon}</span>
              <div>
                <h2 className="font-bold text-lg">{farm.name}</h2>
                <p className="text-sm text-gray-500">{farm.herd_size} {farm.animal_type}(s) · {farm.village}</p>
              </div>
              <button
                onClick={() => {
                  setFarmId("");
                  setSelected([]);
                  setAffectedCount("");
                  setDeaths("");
                  setNotes("");
                  setPhoto(null);
                }}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600"
              >
                Change farm
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h3 className="font-semibold text-sm text-gray-600 mb-3">Select observed symptoms</h3>
                <div className="space-y-2">
                  {symptoms.map((s) => (
                    <label
                      key={s.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                        selected.includes(s.id)
                          ? "border-accent bg-orange-50"
                          : "border-gray-100 bg-white hover:border-gray-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(s.id)}
                        onChange={() => toggleSymptom(s.id)}
                        className="w-5 h-5 rounded accent-accent"
                      />
                      <span className="text-sm font-medium">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of affected animals</label>
                <input
                  type="number"
                  value={affectedCount}
                  onChange={(e) => setAffectedCount(e.target.value)}
                  placeholder="e.g. 5"
                  min="0"
                  max={farm.herd_size}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of deaths (if any)
                </label>
                <input
                  type="number"
                  value={deaths}
                  onChange={(e) => setDeaths(e.target.value)}
                  placeholder="e.g. 2"
                  min="0"
                  max={affectedCount || farm.herd_size}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Death count feeds the mortality rate &amp; trend on the vet dashboard.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-gray-600 mb-2">Photo (optional)</h3>
                {!photo ? (
                  <label
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-accent transition-colors text-center"
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                    <span className="text-3xl mb-2">📷</span>
                    <p className="text-sm text-gray-600 font-medium">Tap to upload a photo</p>
                    <p className="text-xs text-gray-400 mt-1">AI vision will describe visible signs</p>
                  </label>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-3">
                    <img src={photo.previewUrl} alt="sick animal" className="w-full h-44 object-cover rounded-lg" />
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-gray-400">
                        Photo will be analysed server-side after submission.
                      </p>
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional observations..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-accent outline-none resize-none"
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm text-center bg-red-50 rounded-xl py-2 px-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={selected.length === 0 || submitting}
                className="w-full py-3 bg-accent text-white font-semibold rounded-xl hover:opacity-90 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitting ? "Submitting…" : `Submit Report (${selected.length} symptom${selected.length !== 1 ? "s" : ""})`}
              </button>
            </form>
          </div>
        )}

        {farm && !submitted && mode === "voice" && (
          <VoiceReportFlow key={farmId} urlFarmId={farmId} />
        )}
      </div>
    </AppShell>
  );
}