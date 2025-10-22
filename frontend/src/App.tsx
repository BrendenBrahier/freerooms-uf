import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import MapView from "./components/MapView";
import type { Room, RoomsResponse } from "./types";

const DEFAULT_STATE: RoomsResponse = { rooms: [], as_of: null };

const App = () => {
  const [data, setData] = useState<RoomsResponse>(DEFAULT_STATE);
  const [minCapacity, setMinCapacity] = useState<number>(1);
  const [query, setQuery] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    const loadOpenRooms = async () => {
      try {
        const response = await fetch("/api/rooms/open");
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as RoomsResponse;
        if (isMounted) {
          setData({
            as_of: payload.as_of ?? null,
            rooms: Array.isArray(payload.rooms) ? payload.rooms : [],
          });
        }
      } catch (error) {
        console.error("Failed to fetch open rooms", error);
      }
    };

    void loadOpenRooms();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredRooms: Room[] = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.rooms
      .filter((room) => room.capacity >= minCapacity)
      .filter((room) => {
        if (!normalizedQuery) return true;
        return (
          room.building_name.toLowerCase().includes(normalizedQuery) ||
          room.room_id.toLowerCase().includes(normalizedQuery)
        );
      });
  }, [data.rooms, minCapacity, query]);

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleMinCapacityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    setMinCapacity(Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1);
  };

  return (
    <div className="container">
      <aside className="panel">
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            placeholder="Search building or room…"
            value={query}
            onChange={handleQueryChange}
            style={{
              flex: 1,
              padding: 8,
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
            aria-label="Search"
          />
          <input
            type="number"
            min={1}
            value={minCapacity}
            onChange={handleMinCapacityChange}
            style={{
              width: 120,
              padding: 8,
              borderRadius: 8,
              border: "1px solid #ddd",
            }}
            aria-label="Minimum capacity"
            title="Minimum seats"
          />
        </div>

        {filteredRooms.map((room) => {
          const badgeClass =
            room.closes_in_minutes <= 30 ? "badge yellow" : "badge green";
          const until = new Date(room.open_until).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          });
          return (
            <div key={room.room_id} className="room-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <strong>
                  {room.building_name} • {room.room_number}
                </strong>
                <span className={badgeClass}>Open until {until}</span>
              </div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>
                {room.reason}
              </div>
              <div
                style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 13 }}
              >
                <span>Capacity: {room.capacity}</span>
                <span>•</span>
                <span>{room.amenities.join(", ")}</span>
              </div>
            </div>
          );
        })}
        {filteredRooms.length === 0 && <p>No rooms match your filters.</p>}
      </aside>

      <main>
        <MapView rooms={filteredRooms} />
      </main>
    </div>
  );
};

export default App;
