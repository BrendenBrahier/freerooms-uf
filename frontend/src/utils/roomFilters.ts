import type { DisplayRoom } from "../types";

export function filterRooms(
  rooms: DisplayRoom[],
  query: string,
  minCapacity: number,
  requiredAmenities: string[]
): DisplayRoom[] {
  const normalizedQuery = query.trim().toLowerCase();
  return rooms
    .filter((room: DisplayRoom) => {
      const capacity = room.capacity ?? 0;
      return capacity >= minCapacity;
    })
    .filter((room: DisplayRoom) => {
      if (requiredAmenities.length === 0) return true;
      return requiredAmenities.every((amenity) =>
        room.amenities.includes(amenity)
      );
    })
    .filter((room: DisplayRoom) => {
      if (!normalizedQuery) return true;
      return (
        room.buildingName.toLowerCase().includes(normalizedQuery) ||
        `${room.buildingCode ?? ""}-${room.roomNumber}`
          .toLowerCase()
          .includes(normalizedQuery)
      );
    });
}
