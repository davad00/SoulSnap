import { useState } from 'react';
import Room from './components/Room';
import './App.css';

function App() {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);

  const handleJoin = () => {
    if (roomId.trim()) {
      setJoined(true);
    }
  };

  const handleCreate = () => {
    const newRoomId = Math.random().toString(36).substring(7);
    setRoomId(newRoomId);
    setJoined(true);
  };

  if (joined) {
    return <Room roomId={roomId} />;
  }

  return (
    <div className="landing">
      <h1>Virtual Photo Room</h1>
      <p>Create or join a room to take synchronized photos with friends</p>
      
      <div className="join-controls">
        <input
          type="text"
          placeholder="Enter room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
        />
        <button onClick={handleJoin}>Join Room</button>
        <button onClick={handleCreate} className="secondary">Create New Room</button>
      </div>
    </div>
  );
}

export default App;
