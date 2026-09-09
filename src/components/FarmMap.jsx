import { useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const defaultPos = [18.5204, 73.8567];

function ClickHandler({ onPinDrop }) {
  useMapEvents({
    click(e) {
      onPinDrop(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function FarmMap({ onPinDrop, initialLat, initialLng }) {
  const position = initialLat && initialLng ? [initialLat, initialLng] : defaultPos;
  const [key, setKey] = useState(0);

  const handlePinDrop = useCallback(
    (lat, lng) => {
      onPinDrop(lat, lng);
      setKey((k) => k + 1);
    },
    [onPinDrop]
  );

  return (
    <div className="rounded-xl overflow-hidden">
      <MapContainer
        center={position}
        zoom={12}
        style={{ height: 250, width: "100%" }}
        className="rounded-xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPinDrop={handlePinDrop} />
        {initialLat && initialLng && (
          <Marker
            key={key}
            position={[initialLat, initialLng]}
            icon={L.divIcon({
              className: "",
              html: '<div style="font-size:24px;text-align:center">📍</div>',
              iconSize: [30, 30],
              iconAnchor: [15, 30],
            })}
          />
        )}
      </MapContainer>
    </div>
  );
}
