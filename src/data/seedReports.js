import { FARM_IDS } from "./seedFarms.js";

// Seed report history so that a few live reports during the demo push the
// large-livestock cluster over the CRITICAL OUTBREAK (8+) threshold.
// Sharma + Patil are now ~1.5km apart (same category) so they form ONE cluster.
// Wanwadi poultry sits nearby but is a DIFFERENT category -> tracked separately.
// 6 livestock reports => "Emerging Cluster"; 2-3 more live => "CRITICAL OUTBREAK".

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

export const SEED_REPORTS = [
  // ---- Large livestock cluster (Sharma + Patil, same 4km/48h cluster) ----
  {
    id: "seed_ls_1",
    farm_id: FARM_IDS.sharma,
    farm_name: "Sharma Dairy Farm",
    animal_category: "large_livestock",
    animal_type: "cattle",
    symptoms: ["fever", "mouth_foot_lesions"],
    affected_count: 6,
    lat: 18.452,
    lng: 73.878,
    village: "Wadgaon Sheri",
    taluka: "Haveli",
    district: "Pune",
    created_at: hoursAgo(30),
  },
  {
    id: "seed_ls_2",
    farm_id: FARM_IDS.sharma,
    farm_name: "Sharma Dairy Farm",
    animal_category: "large_livestock",
    animal_type: "cattle",
    symptoms: ["mouth_foot_lesions", "reduced_milk", "lameness"],
    affected_count: 9,
    lat: 18.452,
    lng: 73.878,
    village: "Wadgaon Sheri",
    taluka: "Haveli",
    district: "Pune",
    created_at: hoursAgo(24),
  },
  {
    id: "seed_ls_3",
    farm_id: FARM_IDS.sharma,
    farm_name: "Sharma Dairy Farm",
    animal_category: "large_livestock",
    animal_type: "cattle",
    symptoms: ["mouth_foot_lesions", "nasal_discharge"],
    affected_count: 4,
    lat: 18.452,
    lng: 73.878,
    village: "Wadgaon Sheri",
    taluka: "Haveli",
    district: "Pune",
    created_at: hoursAgo(16),
  },
  {
    id: "seed_ls_4",
    farm_id: FARM_IDS.patil,
    farm_name: "Patil Buffalo Herd",
    animal_category: "large_livestock",
    animal_type: "buffalo",
    symptoms: ["fever", "lameness", "sudden_death"],
    affected_count: 3,
    lat: 18.4621,
    lng: 73.8874,
    village: "Undri",
    taluka: "Haveli",
    district: "Pune",
    created_at: hoursAgo(20),
  },
  {
    id: "seed_ls_5",
    farm_id: FARM_IDS.patil,
    farm_name: "Patil Buffalo Herd",
    animal_category: "large_livestock",
    animal_type: "buffalo",
    symptoms: ["mouth_foot_lesions", "fever"],
    affected_count: 5,
    lat: 18.4621,
    lng: 73.8874,
    village: "Undri",
    taluka: "Haveli",
    district: "Pune",
    created_at: hoursAgo(12),
  },
  {
    id: "seed_ls_6",
    farm_id: FARM_IDS.patil,
    farm_name: "Patil Buffalo Herd",
    animal_category: "large_livestock",
    animal_type: "buffalo",
    symptoms: ["lameness", "reduced_milk"],
    affected_count: 2,
    lat: 18.4621,
    lng: 73.8874,
    village: "Undri",
    taluka: "Haveli",
    district: "Pune",
    created_at: hoursAgo(6),
  },

  // ---- Routine poultry report near the livestock cluster (separate category) ----
  {
    id: "seed_po_1",
    farm_id: FARM_IDS.wanwadi,
    farm_name: "Wanwadi Layer Farm",
    animal_category: "poultry",
    animal_type: "chicken",
    symptoms: ["egg_drop"],
    affected_count: 40,
    lat: 18.471,
    lng: 73.898,
    village: "Wanwadi",
    taluka: "Haveli",
    district: "Pune",
    created_at: hoursAgo(10),
  },

  // ---- Isolated routine poultry report (no cluster) ----
  {
    id: "seed_po_2",
    farm_id: FARM_IDS.kalmeshwar,
    farm_name: "Kalmeshwar Duck Farm",
    animal_category: "poultry",
    animal_type: "duck",
    symptoms: ["ruffled_feathers"],
    affected_count: 3,
    lat: 21.233,
    lng: 79.017,
    village: "Kalmeshwar",
    taluka: "Nagpur Rural",
    district: "Nagpur",
    created_at: hoursAgo(3),
  },
];
