import type { DisplayRoom } from "./types";
import StudySpot from "./components/StudySpot";

interface StudyContainerProps {
  filteredRooms: DisplayRoom[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
}

const StudyContainer: React.FC<StudyContainerProps> = ({
  filteredRooms,
  selectedRoomId,
  onSelectRoom,
}) => {
  if (filteredRooms.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-600">
        Try widening your filters or adjusting the capacity slider to see more
        rooms.
      </div>
    );
  }

  return (
    <ul className="space-y-4 p-1" aria-live="polite">
      {filteredRooms.map((room) => (
        <StudySpot
          key={room.id}
          room={room}
          isActive={room.id === selectedRoomId}
          onSelect={() => onSelectRoom(room.id)}
        />
      ))}
    </ul>
  );
};

export default StudyContainer;
