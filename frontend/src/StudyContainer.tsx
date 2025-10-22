import { Room } from "./types";
import StudySpot from "./components/StudySpot";

interface StudyContainerProps {
  filteredRooms: Room[];
}

const StudyContainer: React.FC<StudyContainerProps> = ({ filteredRooms }) => {
  return (
    <div>
      {filteredRooms.length === 0 ? (
        <p className="text-sm text-slate-600">No rooms match your filters.</p>
      ) : (
        <ul className="space-y-3">
          {filteredRooms.map((room) => (
            <StudySpot key={room.room_id} room={room} />
          ))}
        </ul>
      )}
    </div>
  );
};

export default StudyContainer;
