import React from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function MapView({ rooms }) {
  const center = [29.6516, -82.3420] // UF campus-ish
  return (
    <div id="map">
      <MapContainer center={center} zoom={15} style={{height: '100%', width: '100%'}}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {rooms.map(r => (
          <Marker key={r.room_id} position={[r.lat, r.lng]}>
            <Popup>
              <div style={{minWidth: 220}}>
                <strong>{r.building_name} • {r.room_number}</strong><br/>
                Capacity: {r.capacity}<br/>
                Open until: {new Date(r.open_until).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}<br/>
                {r.reason}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
