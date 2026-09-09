export function generatePolygon(lat, lng, radiusMeters = 150) {
  const R = 6371000;
  const dLat = (radiusMeters / R) * (180 / Math.PI);
  const dLng = (radiusMeters / (R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return [
    [lat + dLat, lng - dLng],
    [lat + dLat, lng + dLng],
    [lat - dLat, lng + dLng],
    [lat - dLat, lng - dLng],
  ];
}

let _counter = 1000;
export function genId() {
  return `farm_${++_counter}`;
}

export function getUserId() {
  return localStorage.getItem("animalguard_user_id");
}

export function setUserId(id) {
  localStorage.setItem("animalguard_user_id", id);
}
