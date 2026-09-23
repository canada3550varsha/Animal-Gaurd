import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { DISTRICTS } from "../data/constants.js";
import FarmMap from "../components/FarmMap.jsx";
import Page from "../components/ui/Page.jsx";
import { reqError } from "../api/client.js";

const STEPS = {
  CATEGORY: 0,
  ANIMAL: 1,
  DETAILS: 2,
  LOCATION: 3,
  REVIEW: 4,
};

export default function RegisterFarmScreen() {
  const { addFarm } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState(STEPS.CATEGORY);
  const [farmName, setFarmName] = useState("");
  const [animalCategory, setAnimalCategory] = useState("");
  const [animalType, setAnimalType] = useState("");
  const [herdSize, setHerdSize] = useState("");
  const [district, setDistrict] = useState("");
  const [taluka, setTaluka] = useState("");
  const [village, setVillage] = useState("");
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [locationMethod, setLocationMethod] = useState(null);
  const [registerError, setRegisterError] = useState("");

  const talukas = district ? Object.keys(DISTRICTS[district]?.talukas || {}) : [];
  const villages = taluka ? Object.keys(DISTRICTS[district]?.talukas[taluka]?.villages || {}) : [];

  const handleCategorySelect = (cat) => {
    setAnimalCategory(cat);
    setAnimalType("");
    setStep(STEPS.ANIMAL);
  };

  const handleAnimalSelect = (type) => {
    setAnimalType(type);
    setStep(STEPS.DETAILS);
  };

  const handleDetailsSubmit = (e) => {
    e.preventDefault();
    if (!farmName || !herdSize) return;
    setStep(STEPS.LOCATION);
  };

  const handleDistrictChange = (val) => {
    setDistrict(val);
    setTaluka("");
    setVillage("");
    setLat(null);
    setLng(null);
  };

  const handleTalukaChange = (val) => {
    setTaluka(val);
    setVillage("");
    setLat(null);
    setLng(null);
  };

  const handleVillageChange = (val) => {
    setVillage(val);
    const v = DISTRICTS[district]?.talukas[taluka]?.villages[val];
    if (v) {
      setLat(v.lat);
      setLng(v.lng);
    }
  };

  const handleUseLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported by your browser");
      return;
    }
    setLocationMethod("gps");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      },
      () => {
        setLocationMethod(null);
        alert("Location access denied. Please use the map or dropdown.");
      }
    );
  }, []);

  const handleMapPin = useCallback((mapLat, mapLng) => {
    setLat(mapLat);
    setLng(mapLng);
    setLocationMethod("map");
  }, []);

  const canProceed = lat !== null && lng !== null;

  const handleRegister = async () => {
    setRegisterError("");
    try {
      await addFarm({
        name: farmName,
        animal_category: animalCategory,
        animal_type: animalType,
        herd_size: parseInt(herdSize, 10),
        village: village || "Unknown",
        taluka: taluka || "Unknown",
        district: district || "Unknown",
        lat,
        lng,
      });
      navigate("/");
    } catch (err) {
      setRegisterError(reqError(err));
    }
  };

  return (
    <Page title="Register New Farm" onBack={() => (step > 0 ? setStep(step - 1) : navigate("/"))} maxW="max-w-lg">
        {/* Step Indicator */}
        <div className="flex gap-1 mb-6">
          {Object.keys(STEPS).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-gray-200"}`} />
          ))}
        </div>

        {/* Step 0: Category */}
        {step === STEPS.CATEGORY && (
          <div>
            <h2 className="text-xl font-bold mb-4">What animals do you raise?</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleCategorySelect("large_livestock")}
                className="w-full p-5 bg-white rounded-2xl border-2 border-gray-100 hover:border-primary flex items-center gap-4 transition-colors text-left"
              >
                <span className="text-4xl">🐄</span>
                <div>
                  <p className="font-semibold text-lg">Large Livestock</p>
                  <p className="text-sm text-gray-500">Cattle, Buffalo, Goat, Sheep</p>
                </div>
              </button>
              <button
                onClick={() => handleCategorySelect("poultry")}
                className="w-full p-5 bg-white rounded-2xl border-2 border-gray-100 hover:border-primary flex items-center gap-4 transition-colors text-left"
              >
                <span className="text-4xl">🐔</span>
                <div>
                  <p className="font-semibold text-lg">Poultry</p>
                  <p className="text-sm text-gray-500">Chicken, Duck, Turkey</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Animal Type */}
        {step === STEPS.ANIMAL && (
          <div>
            <h2 className="text-xl font-bold mb-4">Select animal type</h2>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(
                animalCategory === "large_livestock"
                  ? { cattle: "🐄 Cattle", buffalo: "🦬 Buffalo", goat: "🐐 Goat", sheep: "🐑 Sheep" }
                  : { chicken: "🐔 Chicken", duck: "🦆 Duck", turkey: "🦃 Turkey" }
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleAnimalSelect(key)}
                  className={`p-4 bg-white rounded-2xl border-2 transition-colors text-center ${
                    animalType === key ? "border-primary bg-green-50" : "border-gray-100 hover:border-primary"
                  }`}
                >
                  <span className="text-2xl">{label.split(" ")[0]}</span>
                  <p className="text-sm font-medium mt-1">{label.split(" ").slice(1).join(" ")}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Farm Details */}
        {step === STEPS.DETAILS && (
          <form onSubmit={handleDetailsSubmit}>
            <h2 className="text-xl font-bold mb-4">Farm details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Farm Name</label>
                <input
                  type="text"
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  placeholder="e.g. Sharma Dairy Farm"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Herd Size</label>
                <input
                  type="number"
                  value={herdSize}
                  onChange={(e) => setHerdSize(e.target.value)}
                  placeholder="Number of animals"
                  min="1"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Location */}
        {step === STEPS.LOCATION && (
          <div>
            <h2 className="text-xl font-bold mb-4">Farm location</h2>

            <div className="space-y-4">
              {/* GPS Option */}
              <button
                onClick={handleUseLocation}
                className="w-full p-4 bg-white rounded-2xl border-2 border-gray-100 hover:border-primary flex items-center gap-3 transition-colors text-left"
              >
                <span className="text-2xl">📍</span>
                <div>
                  <p className="font-semibold">Use Current Location</p>
                  <p className="text-sm text-gray-500">GPS-based coordinates</p>
                </div>
                {locationMethod === "gps" && lat && (
                  <span className="ml-auto text-green-600 text-sm">✓ Active</span>
                )}
              </button>

              {/* Map Option */}
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
                <p className="font-semibold mb-2 flex items-center gap-2">
                  <span className="text-2xl">🗺️</span> Or drop a pin on the map
                </p>
                <FarmMap onPinDrop={handleMapPin} initialLat={lat} initialLng={lng} />
                {locationMethod === "map" && lat && (
                  <p className="text-sm text-green-600 mt-2">✓ Pin placed at {lat.toFixed(4)}, {lng.toFixed(4)}</p>
                )}
              </div>

              {/* Dropdown Option */}
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
                <p className="font-semibold mb-3 flex items-center gap-2">
                  <span className="text-2xl">📋</span> Or select from dropdowns
                </p>
                <div className="space-y-3">
                  <select
                    value={district}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
                  >
                    <option value="">Select District</option>
                    {Object.keys(DISTRICTS).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select
                    value={taluka}
                    onChange={(e) => handleTalukaChange(e.target.value)}
                    disabled={!district}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm disabled:bg-gray-50"
                  >
                    <option value="">Select Taluka</option>
                    {talukas.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <select
                    value={village}
                    onChange={(e) => handleVillageChange(e.target.value)}
                    disabled={!taluka}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm disabled:bg-gray-50"
                  >
                    <option value="">Select Village</option>
                    {villages.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {lat && lng && (
                <div className="bg-green-50 p-3 rounded-xl text-sm text-green-800">
                  ✓ Coordinates: {lat.toFixed(4)}, {lng.toFixed(4)}
                </div>
              )}

              <button
                onClick={() => canProceed && setStep(STEPS.REVIEW)}
                disabled={!canProceed}
                className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === STEPS.REVIEW && (
          <div>
            <h2 className="text-xl font-bold mb-4">Review & Confirm</h2>
            <div className="bg-white rounded-2xl p-5 space-y-3 border border-gray-100">
              <Row label="Farm Name" value={farmName} />
              <Row label="Category" value={animalCategory === "large_livestock" ? "Large Livestock" : "Poultry"} />
              <Row label="Animal Type" value={animalType.charAt(0).toUpperCase() + animalType.slice(1)} />
              <Row label="Herd Size" value={`${herdSize} animals`} />
              <Row label="Village" value={village} />
              <Row label="Taluka" value={taluka} />
              <Row label="District" value={district} />
              <Row label="Lat/Lng" value={`${lat.toFixed(4)}, ${lng.toFixed(4)}`} />
            </div>

            <div className="bg-blue-50 p-3 rounded-xl text-sm text-blue-800 mt-4">
              📐 A ~150m remote sensing polygon will be auto-generated server-side for live environmental risk data.
            </div>

            {registerError && (
              <p className="text-red-600 text-sm text-center bg-red-50 rounded-xl py-2 px-3 mt-4">{registerError}</p>
            )}

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setStep(STEPS.LOCATION)}
                className="flex-1 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleRegister}
                className="flex-1 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors"
              >
                Register Farm
              </button>
            </div>
          </div>
        )}
    </Page>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
