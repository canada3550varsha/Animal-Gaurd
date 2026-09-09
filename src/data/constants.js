export const DISTRICTS = {
  "Pune": {
    talukas: {
      "Haveli": {
        villages: {
          "Wadgaon Sheri": { lat: 18.4520, lng: 73.8780 },
          "Undri": { lat: 18.4621, lng: 73.8874 },
          "Wanwadi": { lat: 18.4710, lng: 73.8980 },
        },
      },
      "Mulshi": {
        villages: {
          "Lavale": { lat: 18.5310, lng: 73.5680 },
          "Paud": { lat: 18.5020, lng: 73.5260 },
        },
      },
      "Maval": {
        villages: {
          "Kamshet": { lat: 18.7640, lng: 73.5460 },
          "Wanavadi": { lat: 18.7200, lng: 73.5100 },
        },
      },
    },
  },
  "Nagpur": {
    talukas: {
      "Nagpur Rural": {
        villages: {
          "Kalmeshwar": { lat: 21.2330, lng: 79.0170 },
          "Umred": { lat: 20.8530, lng: 79.3260 },
        },
      },
      "Katol": {
        villages: {
          "Katol": { lat: 21.2720, lng: 78.7520 },
          "Toka": { lat: 21.3100, lng: 78.6900 },
        },
      },
    },
  },
  "Ahmednagar": {
    talukas: {
      "Ahmednagar": {
        villages: {
          "Gangapur": { lat: 19.7000, lng: 75.2130 },
          "Pathardi": { lat: 19.1880, lng: 75.1850 },
        },
      },
      "Parner": {
        villages: {
          "Parner": { lat: 19.0100, lng: 74.4430 },
          "Shrigonde": { lat: 18.9500, lng: 74.6300 },
        },
      },
    },
  },
};

export const SYMPTOMS = {
  large_livestock: [
    { id: "fever", label: "Fever (high body temperature)", severity: 5 },
    { id: "mouth_foot_lesions", label: "Mouth / Foot lesions", severity: 8 },
    { id: "lameness", label: "Lameness or difficulty walking", severity: 4 },
    { id: "reduced_milk", label: "Reduced milk yield", severity: 3 },
    { id: "nasal_discharge", label: "Nasal discharge", severity: 3 },
    { id: "sudden_death", label: "Sudden death", severity: 10 },
  ],
  poultry: [
    { id: "egg_drop", label: "Drop in egg production", severity: 3 },
    { id: "respiratory_distress", label: "Respiratory distress / gasping", severity: 6 },
    { id: "diarrhea", label: "Diarrhea", severity: 4 },
    { id: "ruffled_feathers", label: "Ruffled feathers", severity: 2 },
    { id: "swollen_head", label: "Swollen head / comb", severity: 7 },
    { id: "mass_mortality", label: "Sudden mass mortality", severity: 10 },
  ],
};

// Map symptom id -> severity for fast lookup.
export const SEVERITY_BY_ID = Object.fromEntries(
  Object.values(SYMPTOMS)
    .flat()
    .map((s) => [s.id, s.severity])
);

export const ANIMAL_ICONS = {
  large_livestock: {
    cattle: "🐄",
    buffalo: "🦬",
    goat: "🐐",
    sheep: "🐑",
  },
  poultry: {
    chicken: "🐔",
    duck: "🦆",
    turkey: "🦃",
  },
};

export const CATEGORY_LABELS = {
  large_livestock: "Large Livestock",
  poultry: "Poultry",
};

export const RISK_COLORS = {
  low: { bg: "bg-green-100", text: "text-green-800", label: "Low Risk" },
  moderate: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Moderate" },
  high: { bg: "bg-red-100", text: "text-red-800", label: "High Risk" },
};
