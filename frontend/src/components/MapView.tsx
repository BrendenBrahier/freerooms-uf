import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Room } from "../types";

// Ensure Leaflet marker assets load correctly when bundled
const iconPrototype = L.Icon.Default.prototype as unknown as {
  _getIconUrl?: string;
};
if (iconPrototype._getIconUrl) {
  delete iconPrototype._getIconUrl;
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

interface MapViewProps {
  rooms: Room[];
}

const MapView = ({ rooms }: MapViewProps) => {
  const center: [number, number] = [29.6516, -82.342];

  return (
    <div id="map">
      <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {rooms.map((room) => (
          <Marker key={room.room_id} position={[room.lat, room.lng]}>
            <Popup>
              <div style={{ minWidth: 220 }}>
                <strong>
                  {room.building_name} • {room.room_number}
                </strong>
                <br />
                Capacity: {room.capacity}
                <br />
                Open until: {new Date(room.open_until).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit"
                })}
                <br />
                {room.reason}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;
