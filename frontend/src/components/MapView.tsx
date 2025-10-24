import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DisplayRoom } from "../types";

interface MapViewProps {
  rooms: DisplayRoom[];
  selectedRoomId: string | null;
  onRoomFocus?: (roomId: string) => void;
}

interface BuildingGroup {
  buildingId: string;
  buildingName: string;
  lat: number;
  lng: number;
  rooms: DisplayRoom[];
}

type RoomStatus = "available" | "later" | "unavailable";

const JS_DAY_TO_STARS_CODE: string[] = ["SU", "M", "T", "W", "TH", "F", "S"];

function createMarkerIcon(fill: string, stroke: string): L.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="48" viewBox="0 0 32 48"><path d="M16 1C8.268 1 2 7.154 2 14.778c0 11.871 14 32.222 14 32.222s14-20.351 14-32.222C30 7.154 23.732 1 16 1Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/><circle cx="16" cy="16" r="6" fill="#ffffff"/></svg>`;
  const svgUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  return L.icon({
    iconUrl: svgUrl,
    iconSize: [32, 48],
    iconAnchor: [16, 48],
    popupAnchor: [0, -44],
  });
}

function getRoomStatus(room: DisplayRoom, todayCode: string | null): RoomStatus {
  if (room.isAvailableNow) {
    return "available";
  }

  if (todayCode && room.nextAvailable?.day === todayCode) {
    return "later";
  }

  return "unavailable";
}

const MapView = ({ rooms, selectedRoomId, onRoomFocus }: MapViewProps) => {
  // Ensure Leaflet marker assets load correctly when bundled
  const iconPrototype = L.Icon.Default.prototype as unknown as {
    _getIconUrl?: string;
  };
  if (iconPrototype._getIconUrl) {
    delete iconPrototype._getIconUrl;
  }

  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });

  const center: [number, number] = [29.6516, -82.342];

  const statusIcons = useMemo(() => {
    return {
      available: createMarkerIcon("#10B981", "#047857"),
      later: createMarkerIcon("#F97316", "#C2410C"),
      unavailable: createMarkerIcon("#9CA3AF", "#4B5563"),
    } as Record<RoomStatus, L.Icon>;
  }, []);

  const todayCode = JS_DAY_TO_STARS_CODE[new Date().getDay()] ?? null;

  const buildingGroups: BuildingGroup[] = useMemo(() => {
    const groups = new Map<string, BuildingGroup>();

    rooms.forEach((room) => {
      if (room.lat === null || room.lng === null) {
        return;
      }

      const existing = groups.get(room.buildingId);
      if (existing) {
        existing.rooms.push(room);
      } else {
        groups.set(room.buildingId, {
          buildingId: room.buildingId,
          buildingName: room.buildingName,
          lat: room.lat,
          lng: room.lng,
          rooms: [room],
        });
      }
    });

    return Array.from(groups.values()).map((group) => ({
      ...group,
      rooms: group.rooms.slice().sort((a, b) =>
        a.roomNumber.localeCompare(b.roomNumber, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      ),
    }));
  }, [rooms]);

  const [activeRoomIndex, setActiveRoomIndex] = useState<
    Record<string, number>
  >({});
  const markerRefs = useRef<Record<string, LeafletMarker | null>>({});
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);

  useEffect(() => {
    setActiveRoomIndex((prev) => {
      const next: Record<string, number> = {};
      let changed = false;

      buildingGroups.forEach((group) => {
        const prevIndex = prev[group.buildingId] ?? 0;
        const boundedIndex = Math.min(prevIndex, group.rooms.length - 1);
        next[group.buildingId] = boundedIndex;
        if (boundedIndex !== prevIndex || !(group.buildingId in prev)) {
          changed = true;
        }
      });

      if (!changed) {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(next);
        if (prevKeys.length !== nextKeys.length) {
          changed = true;
        } else {
          for (const key of prevKeys) {
            if (!(key in next)) {
              changed = true;
              break;
            }
          }
        }
      }

      return changed ? next : prev;
    });
  }, [buildingGroups]);

  useEffect(() => {
    const validIds = new Set(buildingGroups.map((group) => group.buildingId));
    Object.keys(markerRefs.current).forEach((key) => {
      if (!validIds.has(key)) {
        delete markerRefs.current[key];
      }
    });
  }, [buildingGroups]);

  const handleNavigate = (buildingId: string, delta: 1 | -1) => {
    setActiveRoomIndex((prev) => {
      const group = buildingGroups.find(
        (candidate) => candidate.buildingId === buildingId
      );
      if (!group || group.rooms.length <= 1) {
        return prev;
      }

      const current = prev[buildingId] ?? 0;
      const count = group.rooms.length;
      const nextIndex = (current + delta + count) % count;
      const nextRoom = group.rooms[nextIndex];

      if (nextIndex === current) {
        return prev;
      }

      if (nextRoom) {
        onRoomFocus?.(nextRoom.id);
      }

      return {
        ...prev,
        [buildingId]: nextIndex,
      };
    });
  };

  useEffect(() => {
    if (!selectedRoomId) return;
    const targetGroup = buildingGroups.find((group) =>
      group.rooms.some((room) => room.id === selectedRoomId)
    );
    if (!targetGroup) return;

    const nextIndex = targetGroup.rooms.findIndex(
      (room) => room.id === selectedRoomId
    );
    if (nextIndex < 0) return;

    setActiveRoomIndex((prev) => {
      const current = prev[targetGroup.buildingId] ?? 0;
      if (current === nextIndex) {
        return prev;
      }
      return {
        ...prev,
        [targetGroup.buildingId]: nextIndex,
      };
    });

    const marker = markerRefs.current[targetGroup.buildingId];
    if (marker) {
      marker.openPopup();
    }
    if (mapInstance) {
      mapInstance.flyTo(
        [targetGroup.lat, targetGroup.lng],
        Math.max(mapInstance.getZoom(), 16),
        { duration: 0.4 }
      );
    }
  }, [selectedRoomId, buildingGroups, mapInstance]);

  return (
    <div className="h-full w-full">
      <MapContainer
        center={center}
        zoom={15}
        className="h-full w-full"
        whenCreated={(instance) => setMapInstance(instance)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {buildingGroups.map((group) => {
          const activeIndex = activeRoomIndex[group.buildingId] ?? 0;
          const room = group.rooms[activeIndex];
          const status = getRoomStatus(room, todayCode);
          const statusLabel =
            status === "available"
              ? "Available now"
              : status === "later"
              ? "Available later today"
              : "Unavailable today";
          const statusTone =
            status === "available"
              ? "text-emerald-600"
              : status === "later"
              ? "text-amber-600"
              : "text-slate-500";

          return (
            <Marker
              key={group.buildingId}
              position={[group.lat, group.lng]}
              icon={statusIcons[status]}
              ref={(instance) => {
                markerRefs.current[group.buildingId] = instance;
              }}
              eventHandlers={{
                popupopen: () => {
                  const focusedRoom =
                    group.rooms[
                      activeRoomIndex[group.buildingId] ?? 0
                    ] ?? null;
                  if (focusedRoom) {
                    onRoomFocus?.(focusedRoom.id);
                  }
                },
              }}
            >
              <Popup>
                <div style={{ minWidth: 240 }}>
                  {room.photo ? (
                    <img
                      src={room.photo}
                      alt={`${group.buildingName} ${room.roomNumber}`}
                      className="w-full h-42 object-cover rounded-md mb-3"
                    />
                  ) : null}
                  <strong className="flex w-full">
                    {group.buildingName} • {room.roomNumber}
                  </strong>
                  <div className="mt-1 text-sm">
                    Status:{" "}
                    <span className={statusTone}>
                      {statusLabel}
                    </span>
                    {room.nextAvailable ? (
                      <>
                        <br />
                        Next availability: {room.nextAvailable.dayLabel} •{" "}
                        {room.nextAvailable.startTime}
                      </>
                    ) : null}
                    <br />
                    Capacity: {room.capacity ?? "Unknown"}
                  </div>
                  {room.detailUrl ? (
                    <div className="mt-2 text-sm">
                      <a
                        href={room.detailUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        View details
                      </a>
                    </div>
                  ) : null}
                  {group.rooms.length > 1 ? (
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleNavigate(group.buildingId, -1);
                        }}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-slate-500">
                        Room {activeIndex + 1} of {group.rooms.length}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleNavigate(group.buildingId, 1);
                        }}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapView;
