export interface PeriodEntry {
  day: string;
  period: string;
  startTime: string;
  endTime: string;
}

export interface NextAvailability {
  day: string;
  dayLabel: string;
  period: string;
  startTime: string;
  endTime: string;
}

export interface SizeAvailability {
  periods?: PeriodEntry[];
  isAvailableNow?: boolean;
  nextAvailable?: NextAvailability | null;
}

export interface RoomMetadata {
  capacity: number | null;
  photo: string | null;
  gallery: string[];
  features: Array<{ slug: string; label: string }>;
  featureFlags: Record<string, boolean>;
  detailUrl: string;
}

export interface RoomAvailability {
  number: string;
  metadata?: RoomMetadata;
  availability: Record<string, SizeAvailability>;
}

export interface BuildingAvailability {
  id: string;
  code: string | null;
  name: string;
  campusId: string | null;
  lat: number | null;
  lng: number | null;
  rooms: RoomAvailability[];
}

export interface RoomsResponse {
  fetchedAt: string;
  term: string;
  classSizes: string[];
  buildings: BuildingAvailability[];
  periodStartTimes?: Record<string, string>;
}

export interface DisplayRoom {
  id: string;
  buildingId: string;
  buildingName: string;
  buildingCode: string | null;
  roomNumber: string;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  amenities: string[];
  sizeKeys: string[];
  availability: Record<string, SizeAvailability>;
  isAvailableNow: boolean;
  nextAvailable: NextAvailability | null;
  fetchedAt: string;
  detailUrl: string | null;
  photo: string | null;
}
