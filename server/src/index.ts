import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Serve static files from the public directory (client build)
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Socket.IO server running' });
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { 
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

interface Room {
  id: string;
  users: Set<string>;
}

const rooms = new Map<string, Room>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId: string) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { id: roomId, users: new Set() });
    }
    
    const room = rooms.get(roomId)!;
    room.users.add(socket.id);
    socket.join(roomId);
    
    socket.emit('room-joined', { roomId, userId: socket.id });
    socket.to(roomId).emit('user-joined', { userId: socket.id });
    
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', { from: socket.id, signal });
  });

  socket.on('layer-update', ({ roomId, layers }) => {
    socket.to(roomId).emit('layer-update', { layers });
    console.log(`Layer update in room ${roomId}`);
  });

  socket.on('capture-trigger', (roomId: string) => {
    io.to(roomId).emit('capture-now', { timestamp: Date.now() });
    console.log(`Capture triggered in room ${roomId}`);
  });

  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id);
        socket.to(roomId).emit('user-left', { userId: socket.id });
        if (room.users.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
