import React, { useEffect, useState, useMemo } from 'react'
import MapView from './components/MapView.jsx'

export default function App() {
  const [data, setData] = useState({ rooms: [], as_of: null })
  const [minCapacity, setMinCapacity] = useState(1)
  const [query, setQuery] = useState("")

  useEffect(() => {
    fetch('/api/rooms/open').then(r => r.json()).then(setData).catch(console.error)
  }, [])

  const filtered = useMemo(() => {
    return (data.rooms || [])
      .filter(r => r.capacity >= minCapacity)
      .filter(r => {
        if (!query.trim()) return true
        const q = query.toLowerCase()
        return r.building_name.toLowerCase().includes(q) || r.room_id.toLowerCase().includes(q)
      })
  }, [data, minCapacity, query])

  return (
    <div className="container">
      <aside className="panel">
        <div style={{display:'flex', gap:8, marginBottom:12}}>
          <input
            placeholder="Search building or room…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{flex:1, padding:8, borderRadius:8, border:'1px solid #ddd'}}
            aria-label="Search"
          />
          <input
            type="number"
            min="1"
            value={minCapacity}
            onChange={e => setMinCapacity(Number(e.target.value || 1))}
            style={{width:120, padding:8, borderRadius:8, border:'1px solid #ddd'}}
            aria-label="Minimum capacity"
            title="Minimum seats"
          />
        </div>

        {filtered.map(r => {
          const badgeClass = r.closes_in_minutes <= 30 ? 'badge yellow' : 'badge green'
          const until = new Date(r.open_until).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})
          return (
            <div key={r.room_id} className="room-card">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <strong>{r.building_name} • {r.room_number}</strong>
                <span className={badgeClass}>Open until {until}</span>
              </div>
              <div style={{fontSize:13, color:'#555', marginTop:6}}>
                {r.reason}
              </div>
              <div style={{display:'flex', gap:8, marginTop:8, fontSize:13}}>
                <span>Capacity: {r.capacity}</span>
                <span>•</span>
                <span>{(r.amenities||[]).join(', ')}</span>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <p>No rooms match your filters.</p>}
      </aside>

      <main>
        <MapView rooms={filtered} />
      </main>
    </div>
  )
}
