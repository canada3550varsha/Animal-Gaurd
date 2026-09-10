import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { SYMPTOMS, ANIMAL_ICONS } from "../data/constants.js";
import {
  VOICE_LANGS,
  TEXT,
  extractCount,
  mapSymptoms,
  sttLocale,
  sttNote,
  speechSupported,
  ttsSupported,
} from "../data/voice.js";
import { reqError } from "../api/client.js";

// Steps of the conversation. Answers are collected one at a time.
// Language comes FIRST so every question can be asked in the farmer's language.
const STEPS = ["lang", "farm", "count", "symptoms", "notes", "review"];

function pickVoice(langTts) {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const prefix = langTts.replace(/-.*/, "");
  return voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) || null;
}

// Infer the animal type the farmer mentioned in a spoken farm name.
function inferFarmType(text) {
  const t = (text || "").toLowerCase();
  const dict = {
    cattle: ["cattle", "cow", "gaay", "गाय", "गोवंश", "धेनु"],
    buffalo: ["buffalo", "bhai", "भैंस"],
    goat: ["goat", "bakra", "बकरी", "शेळी"],
    sheep: ["sheep", "bhed", "मेंढा", "मेंढी"],
    chicken: ["chicken", "hen", "layer", "broiler", "मुर्गी", "मुर्गा", "कोंबडी"],
    duck: ["duck", "बदक", "बत्तख"],
    turkey: ["turkey", "टर्की"],
  };
  for (const [type, words] of Object.entries(dict)) {
    if (words.some((w) => t.includes(w))) return type;
  }
  return "cattle"; // demo default
}

function categoryOf(type) {
  return type in ANIMAL_ICONS.poultry ? "poultry" : "large_livestock";
}

function normalizeName(s) {
  return (s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// Match the spoken farm name against the farmer's registered farms.
function matchFarm(farms, spoken) {
  const q = normalizeName(spoken);
  if (!q) return null;
  const whole = farms.find((f) => {
    const n = normalizeName(f.name);
    return n.includes(q) || q.includes(n);
  });
  if (whole) return whole;
  const words = q.split(/\s+/).filter((w) => w.length >= 3);
  for (const w of words) {
    const hit = farms.find((f) => normalizeName(f.name).includes(w));
    if (hit) return hit;
  }
  return null;
}

// Browser GPS when available, otherwise the demo's seeded Pune cluster.
function locateFarm() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 6000 }
    );
  });
}

export default function VoiceReportScreen() {
  const { farmId: urlFarmId } = useParams();
  const navigate = useNavigate();
  const { farms, addReport, addFarm } = useApp();

  const [farmId, setFarmId] = useState(urlFarmId || "");
  const [lang, setLang] = useState("en");
  const [stepIdx, setStepIdx] = useState(0);
  const [busyFarm, setBusyFarm] = useState(false);

  // farmer's answers so far
  const [countAns, setCountAns] = useState("");
  const [symptomAns, setSymptomAns] = useState("");
  const [notesAns, setNotesAns] = useState("");
  const [typedOverride, setTypedOverride] = useState("");

  const [detectedSymptoms, setDetectedSymptoms] = useState([]);
  const [speechOk] = useState(() => speechSupported());

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [lastAnswer, setLastAnswer] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const recRef = useRef(null);
  const langRef = useRef(lang);
  langRef.current = lang;
  // Guards two "answer" paths (recognition end + button tap) from advancing twice.
  const advancingRef = useRef(false);

  const t = TEXT(lang);
  const farm = farms.find((f) => f.farm_id === farmId);
  const category = farm?.animal_category || "large_livestock";
  const symptoms = SYMPTOMS[category] || [];
  const step = STEPS[stepIdx];

  // ------- Text-to-speech (the app asks the question out loud) -------
  const speak = (text) => {
    if (!ttsSupported()) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const lc = VOICE_LANGS.find((l) => l.code === langRef.current);
      u.lang = lc?.tts || "en-IN";
      const v = pickVoice(u.lang);
      if (v) u.voice = v;
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch {
      // speech synthesis is best-effort; never block the flow
    }
  };

  // Speak the current question when the step changes.
  useEffect(() => {
    if (step === "farm") speak(TEXT(lang).pickFarm);
    else if (step === "lang") speak(TEXT(lang).pickLang);
    else if (step === "count") speak(TEXT(lang).qCount);
    else if (step === "symptoms") speak(TEXT(lang).qSymptoms);
    else if (step === "notes") speak(TEXT(lang).qNotes);
    else if (step === "review") speak("Please review your report and press the submit button.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  // ------- Speech-to-text (the farmer replies by voice) -------
  const startListening = () => {
    if (listening) {
      stopListening();
      return;
    }
    if (!speechOk) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    // Chromium has no Marathi engine — listen via Hindi and correct with chips.
    rec.lang = sttLocale(langRef.current);
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let heardText = "";
    rec.onresult = (e) => {
      let finals = "";
      let inter = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finals += e.results[i][0].transcript + " ";
        else inter += e.results[i][0].transcript;
      }
      setInterim(inter);
      if (finals.trim()) {
        heardText = finals.trim();
        setLastAnswer(heardText);
      }
    };
    rec.onend = () => {
      setListening(false);
      // Recognition finished with real speech -> jump straight to the next step.
      const spoken = heardText;
      heardText = "";
      if (spoken) applyAnswer(spoken);
    };
    rec.onerror = (e) => {
      setListening(false);
      heardText = "";
      const code = e?.error || "";
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Microphone blocked. Allow mic access in the browser (🔒 icon) or type your answer below.");
      } else if (code === "no-speech") {
        setError("I heard nothing. Tap the mic and speak again, or type below.");
      } else if (code === "language-not-supported" || code === "bad-grammar") {
        setError("Voice recognition for this language is unavailable here — please type your answer below.");
      } else if (code !== "aborted") {
        setError("Voice capture failed — please type your answer below.");
      }
    };
    recRef.current = rec;
    setInterim("");
    setError("");
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      setError("Microphone is not available. Please allow mic access or type your answer below.");
    }
  };

  const stopListening = () => {
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
    setListening(false);
  };

  useEffect(() => {
    return () => {
      stopListening();
      if (ttsSupported()) window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-detect symptoms as the farmer speaks about them (interim + final transcript).
  useEffect(() => {
    const text = `${symptomAns} ${interim} ${lastAnswer}`;
    if (step === "symptoms" && text.trim()) {
      const mapped = mapSymptoms(text, category);
      if (mapped.length > 0) setDetectedSymptoms(mapped);
    }
  }, [symptomAns, interim, lastAnswer, step, category]);

  const activeAnswer = step === "count" ? countAns : step === "symptoms" ? symptomAns : notesAns;

  // The farmer spoke a farm name. Match a registered farm, or register a NEW one.
  const handleFarmName = async (name) => {
    if (advancingRef.current) return;
    const clean = name.trim();
    if (!clean) return;
    const existing = matchFarm(farms, clean);
    if (existing) {
      advancingRef.current = true;
      setFarmId(existing.farm_id);
      setLastAnswer(existing.name);
      setError("");
      next([]);
      resetAdvance();
      return;
    }
    if (busyFarm) return;
    setBusyFarm(true);
    try {
      const type = inferFarmType(clean);
      const pos = await locateFarm();
      const created = await addFarm({
        name: clean,
        animal_category: categoryOf(type),
        animal_type: type,
        herd_size: 1,
        village: "Wadgaon Sheri",
        taluka: "Haveli",
        district: "Pune",
        lat: pos?.lat ?? 18.452,
        lng: pos?.lng ?? 73.878,
      });
      advancingRef.current = true;
      setFarmId(created.farm_id);
      setLastAnswer(created.name);
      setError("");
      next([]);
      resetAdvance();
    } catch (err) {
      setError(reqError(err));
    } finally {
      setBusyFarm(false);
    }
  };

  const applyAnswer = (raw) => {
    if (advancingRef.current) return;
    const answer = raw.trim();
    if (step === "farm") {
      handleFarmName(answer);
      return;
    }
    if (!answer && step === "notes") {
      // skipped — still move on
      next([]);
      return;
    }
    if (step === "count") {
      const n = extractCount(answer);
      if (n) {
        advancingRef.current = true;
        setCountAns(answer);
        setLastAnswer(answer);
        next([]);
        resetAdvance();
      } else {
        // not a number — gently ask again
        const hint = TEXT(lang).qCountRetry;
        setError(hint);
        speak(hint);
      }
    } else if (step === "symptoms") {
      const mapped = answer ? mapSymptoms(answer, category) : detectedSymptoms;
      if (mapped.length === 0 && detectedSymptoms.length === 0) {
        setError("Could not recognise a symptom. Tap the mic and try again, or pick from the list below.");
        return;
      }
      advancingRef.current = true;
      setSymptomAns(answer);
      setLastAnswer(answer);
      const known = Array.from(new Set([...detectedSymptoms, ...mapped]));
      if (known.length > 0) setDetectedSymptoms(known);
      next(known);
      resetAdvance();
    } else if (step === "notes") {
      advancingRef.current = true;
      setNotesAns(answer);
      setLastAnswer(answer);
      next([]);
      resetAdvance();
    }
  };

  const resetAdvance = () => {
    setTimeout(() => {
      advancingRef.current = false;
    }, 350);
  };

  const next = (knownSymptoms) => {
    setInterim("");
    stopListening();
    setError("");
    if (step === "symptoms") {
      const known =
        (knownSymptoms && knownSymptoms.length > 0
          ? knownSymptoms
          : detectedSymptoms.length > 0
            ? detectedSymptoms
            : mapSymptoms(symptomAns || lastAnswer, category));
      if (known.length > 0) {
        setDetectedSymptoms((prev) => Array.from(new Set([...prev, ...known])));
        setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
        return;
      }
      setError("Could not recognise a symptom. Tap the mic and try again, or pick from the list below.");
      return;
    }
    const from = STEPS.indexOf(step);
    let nxt = from + 1;
    // Entered from a specific farm page -> language straight into the questions.
    if (urlFarmId && STEPS[nxt] === "farm") nxt += 1;
    setStepIdx(Math.min(nxt, STEPS.length - 1));
  };

  const computePayload = () => {
    const syms = detectedSymptoms.length > 0 ? detectedSymptoms : mapSymptoms(symptomAns, category);
    const count = extractCount(countAns) || 1;
    const notes = notesAns.trim() || (step === "notes" ? lastAnswer : "");
    return { farmId: farm?.farm_id, category, symptoms: syms, affected_count: count, notes };
  };

  const toggleDetected = (id) => {
    setDetectedSymptoms((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    if (submitting || !farm) return;
    setSubmitting(true);
    setError("");
    try {
      const payload = computePayload();
      if (payload.symptoms.length === 0) {
        setError("Select at least one symptom (tap the detected chips or say them again).");
        setSubmitting(false);
        return;
      }
      await addReport({
        farm_id: payload.farmId,
        symptoms: payload.symptoms,
        affected_count: payload.affected_count,
        notes: payload.notes,
      });
      speak(TEXT(lang).done);
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
          <div className="text-5xl mb-4">🎤✅</div>
          <h2 className="text-xl font-bold mb-2">
            {lang === "hi"
              ? "रिपोर्ट भेज दी गई!"
              : lang === "mr"
                ? "अहवाल पाठवला गेला!"
                : "Report Sent!"}
          </h2>
          <p className="text-sm text-gray-500 mb-1">{t.done}</p>
          <p className="text-xs text-gray-400 mb-6">
            Your veterinary team has been notified and is watching the area.
          </p>
          <button
            onClick={() => navigate(farm?.farm_id ? `/farm/${farm.farm_id}` : "/")}
            className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors"
          >
            View Farm
          </button>
        </div>
      </div>
    );
  }

  const canContinue =
    step === "farm" ? Boolean(farmId) :
    step === "lang" ? true :
    step === "count" ? Boolean(countAns.trim()) :
    step === "symptoms" ? detectedSymptoms.length > 0 :
    step === "notes" ? true : false;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary text-white px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">🎤 Voice Report (No Typing)</h1>
            <p className="text-white/80 text-xs">
              You speak · I listen · {VOICE_LANGS.find((l) => l.code === lang)?.label}
            </p>
          </div>
          <button onClick={() => navigate(-1)} className="text-sm bg-white/20 px-3 py-1.5 rounded-lg">
            ← Back
          </button>
        </div>
        {/* progress */}
        <div className="max-w-lg mx-auto mt-3 flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i < stepIdx ? "bg-amber-400" : i === stepIdx ? "bg-white" : "bg-white/30"}`}
            />
          ))}
        </div>
        <p className="max-w-lg mx-auto mt-1 text-[11px] text-white/70">
          {stepIdx + 1} of {STEPS.length} ·
          {t[
            step === "farm"
              ? "pickFarm"
              : step === "lang"
                ? "pickLang"
                : step === "count"
                  ? "qCount"
                  : step === "symptoms"
                    ? "qSymptoms"
                    : "qNotes"
          ] || ""}
        </p>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* conversation bubbles */}
        <div className="space-y-3">
          {(step === "farm" || step === "lang" || step === "count" || step === "symptoms" || step === "notes") && (
            <Bubble
              who="app"
              text={step === "farm" ? t.pickFarm : step === "lang" ? t.pickLang : step === "count" ? t.qCount : step === "symptoms" ? t.qSymptoms : t.qNotes}
              onSpeak={() =>
                speak(step === "farm" ? t.pickFarm : step === "lang" ? t.pickLang : step === "count" ? t.qCount : step === "symptoms" ? t.qSymptoms : t.qNotes)
              }
            />
          )}
          {activeAnswer && <Bubble who="user" text={activeAnswer} />}
          {interim && <Bubble who="user" text={`${interim}…`} dim />}
          {lastAnswer && !activeAnswer && step !== "count" && <Bubble who="user" text={lastAnswer} dim />}
        </div>

        {error && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">
            {error}
          </p>
        )}

        {/* step controls */}
        <div className="mt-6 space-y-4">
          {step === "farm" && (
            <div className="space-y-4">
              <MicControl
                listening={listening}
                onToggle={startListening}
                prompt={listening ? "Listening… say the farm name" : "Tap the mic and say the farm name"}
                note={sttNote(lang)}
              >
                {(lastAnswer || interim) && (
                  <p className="text-center text-[11px] text-gray-500">
                    I heard: <span className="font-medium text-gray-700">“{interim || lastAnswer}”</span>
                  </p>
                )}
                <TypePad
                  speechOk={speechOk}
                  value={typedOverride}
                  onChange={setTypedOverride}
                  placeholder="Farm name — registered or new"
                />
                {busyFarm && (
                  <p className="text-center text-xs text-primary font-medium">Registering your farm…</p>
                )}
              </MicControl>

              <div>
                <p className="text-xs text-gray-500 mb-2">{t.farmList}</p>
                <div className="grid grid-cols-1 gap-2">
                  {farms.map((f) => (
                    <button
                      key={f.farm_id}
                      onClick={() => {
                        setFarmId(f.farm_id);
                        next();
                      }}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border bg-white transition-colors ${
                        farmId === f.farm_id ? "border-primary ring-2 ring-primary/30" : "border-gray-200"
                      }`}
                    >
                      <span className="font-medium text-sm">{f.name}</span>
                      <span className="text-gray-400 text-xs">{ANIMAL_ICONS[f.animal_category]?.[f.animal_type] || "🐾"}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-gray-400 text-center">{t.farmNewHint}</p>
            </div>
          )}

          {step === "lang" && (
            <div>
              <div className="grid grid-cols-3 gap-2">
                {VOICE_LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLang(l.code);
                      const from = STEPS.indexOf("lang");
                      let nxt = from + 1;
                      if (urlFarmId && STEPS[nxt] === "farm") nxt += 1;
                      setStepIdx(nxt);
                    }}
                    className={`py-3 rounded-xl border bg-white text-sm font-semibold transition-colors ${
                      lang === l.code ? "border-primary ring-2 ring-primary/30 text-primary" : "border-gray-200 text-gray-700"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              {sttNote(lang) && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-3">
                  🎧 {sttNote(lang)}
                </p>
              )}
            </div>
          )}

          {(step === "count" || step === "symptoms" || step === "notes") && (
            <>
              <MicControl
                listening={listening}
                onToggle={startListening}
                prompt={listening ? "Listening… speak now" : "Tap the mic and speak your answer"}
                note={sttNote(lang)}
              >
                {(lastAnswer || interim) && (
                  <p className="text-center text-[11px] text-gray-500">
                    I heard: <span className="font-medium text-gray-700">“{interim || lastAnswer}”</span>
                  </p>
                )}
                <TypePad
                  speechOk={speechOk}
                  value={typedOverride}
                  onChange={setTypedOverride}
                  placeholder={step === "count" ? "e.g. 5" : step === "symptoms" ? "e.g. fever" : "optional"}
                />
              </MicControl>

              {/* detected symptom chips */}
              {step === "symptoms" && detectedSymptoms.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className="text-xs text-gray-500 mb-2">I heard these symptoms — tap to remove:</p>
                  <div className="flex flex-wrap gap-2">
                    {detectedSymptoms.map((id) => {
                      const s = symptoms.find((x) => x.id === id);
                      return (
                        <button
                          key={id}
                          onClick={() => toggleDetected(id)}
                          className={`text-sm px-3 py-1.5 rounded-full border font-medium transition-colors ${
                            detectedSymptoms.includes(id)
                              ? "bg-red-100 border-red-300 text-red-700"
                              : "bg-gray-100 border-gray-300 text-gray-500"
                          }`}
                        >
                          {s?.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === "symptoms" && symptoms.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className="text-xs text-gray-500 mb-2">Or add a symptom yourself (tap):</p>
                  <div className="flex flex-wrap gap-2">
                    {symptoms.map((s) => {
                      const on = detectedSymptoms.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleDetected(s.id)}
                          className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                            on
                              ? "bg-red-100 border-red-300 text-red-700"
                              : "bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {on ? "✓ " : ""}{s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {step === "review" && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-700">Review your voice report</p>
              <Row k="Farm" v={farm?.name} />
              <Row k="Affected" v={`${computePayload().affected_count} animal(s)`} />
              <Row k="Symptoms" v={(computePayload().symptoms.map((id) => symptoms.find((s) => s.id === id)?.label).filter(Boolean).join(", ")) || "—"} />
              <Row k="Notes" v={notesAns || "—"} />
              <button
                onClick={() => setStepIdx(STEPS.indexOf("symptoms"))}
                className="text-xs text-primary underline mt-1"
              >
                ← Change symptoms
              </button>
            </div>
          )}

          {/* action buttons */}
          <div className="flex gap-2">
            {stepIdx > 0 && step !== "review" && (
              <button
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 font-semibold rounded-xl"
              >
                ← Back
              </button>
            )}
            {step === "farm" && (
              <button
                onClick={() => applyAnswer(typedOverride || lastAnswer)}
                disabled={!canContinue && !typedOverride.trim() && !lastAnswer}
                className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
                  canContinue || typedOverride.trim() || lastAnswer
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {typedOverride.trim() || lastAnswer ? "Use this farm →" : "Continue"}
              </button>
            )}
            {step === "lang" && <div className="flex-1" />}
            {(step === "count" || step === "symptoms" || step === "notes") && (
              <button
                onClick={() => applyAnswer(activeAnswer || typedOverride || lastAnswer)}
                disabled={!canContinue && !typedOverride.trim()}
                className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
                  activeAnswer || typedOverride.trim()
                    ? "bg-amber-500 text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {step === "count" ? "That's the number →" : "Next question →"}
              </button>
            )}
            {step === "review" && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors"
              >
                {submitting ? "Sending…" : "✅ Submit report"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Bubble({ who, text, dim, onSpeak }) {
  const align = who === "app" ? "items-start" : "items-end";
  const bubble =
    who === "app"
      ? "bg-primary text-white"
      : dim
        ? "bg-gray-100 text-gray-400"
        : "bg-white border border-gray-200 text-gray-800";
  return (
    <div className={`flex ${align}`}>
      <div className="max-w-[85%]">
        <div className={`px-4 py-2.5 rounded-2xl text-sm ${bubble} ${who === "app" ? "rounded-tl-sm" : "rounded-br-sm"}`}>
          <span className="flex items-center gap-2">
            {who === "app" && <span>🤖</span>}
            <span>{text}</span>
            {who === "app" && onSpeak && (
              <button
                onClick={onSpeak}
                className="ml-1 text-[11px] bg-white/20 px-2 py-0.5 rounded-full hover:bg-white/30 transition-colors"
              >
                🔊
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-gray-400">{k}</span>
      <span className="text-gray-800 font-medium text-right">{v}</span>
    </div>
  );
}

function MicControl({ listening, onToggle, prompt, note, children }) {
  return (
    <>
      <div className="flex justify-center">
        <button
          onClick={onToggle}
          className={`relative w-20 h-20 rounded-full shadow-lg transition-all ${
            listening ? "bg-red-500 animate-pulse" : "bg-primary hover:bg-primary-dark"
          } text-white text-3xl flex items-center justify-center`}
        >
          🎤
        </button>
      </div>
      <p className="text-center text-xs text-gray-400">{prompt}</p>
      {note && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          🎧 {note}
        </p>
      )}
      {children}
    </>
  );
}

function TypePad({ speechOk, value, onChange, placeholder }) {
  if (speechOk) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
      <p className="text-xs text-amber-700 mb-2">
        Voice not available in this browser — please type your answer.
      </p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
      />
    </div>
  );
}