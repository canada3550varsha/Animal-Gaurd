import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { SYMPTOMS, ANIMAL_ICONS } from "../data/constants.js";
import Page from "../components/ui/Page.jsx";
import { reqError } from "../api/client.js";

export default function ReportSymptomsScreen() {
  const { farmId } = useParams();
  const navigate = useNavigate();
  const { farms, addReport } = useApp();
  const farm = farms.find((f) => f.farm_id === farmId);

  const [selected, setSelected] = useState([]);
  const [affectedCount, setAffectedCount] = useState("");
  const [deaths, setDeaths] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null); // { file, previewUrl }
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [vision, setVision] = useState(null); // set from server response
  const fileRef = useRef(null);

  if (!farm) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Farm not found</p>
      </div>
    );
  }

  const symptoms = SYMPTOMS[farm.animal_category] || [];
  const categoryIcon = ANIMAL_ICONS[farm.animal_category]?.[farm.animal_type] || "🐾";

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
    if (selected.length === 0 || submitting) return;

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

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-2">Report Submitted</h2>
          <p className="text-sm text-gray-500 mb-1">
            {selected.length} symptom(s) reported for {farm.name}
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
            This report now contributes to the farm's FDRS ReportedCases score.
          </p>
          <button
            onClick={() => navigate(`/farm/${farmId}`)}
            className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors"
          >
            Back to Farm
          </button>
        </div>
      </div>
    );
  }

  return (
    <Page title="Report Sick Animal/Bird" back={`/farm/${farmId}`} maxW="max-w-lg">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-3xl">{categoryIcon}</span>
          <div>
            <h2 className="font-bold text-lg">{farm.name}</h2>
            <p className="text-sm text-gray-500">{farm.herd_size} {farm.animal_type}(s) · {farm.village}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Symptom multi-select */}
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

          {/* Affected count */}
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

          {/* Deaths */}
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

          {/* Photo upload + AI vision */}
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

          {/* Notes */}
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
    </Page>
  );
}
