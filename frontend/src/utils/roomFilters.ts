import type { Room } from "../types";

export function filterRooms(rooms: Room[], query: string, minCapacity: number): Room[] {
  const normalizedQuery = query.trim().toLowerCase();
  return rooms
    .filter((room: Room) => room.capacity >= minCapacity)
    .filter((room: Room) => {
      if (!normalizedQuery) return true;
      return (
        room.building_name.toLowerCase().includes(normalizedQuery) ||
        room.room_id.toLowerCase().includes(normalizedQuery)
      );
    });
}