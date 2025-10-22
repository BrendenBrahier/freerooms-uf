export interface Room {
  room_id: string;
  building_id: string;
  building_name: string;
  room_number: string;
  lat: number;
  lng: number;
  capacity: number;
  amenities: string[];
  as_of: string;
  is_open: boolean;
  open_until: string;
  reason: string;
  closes_in_minutes: number;
  source_system: string;
  last_refresh: string;
}

export interface RoomsResponse {
  rooms: Room[];
  as_of: string | null;
}
