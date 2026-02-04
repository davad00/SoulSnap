# Virtual Photo Room

A real-time collaborative photo booth where multiple users can join a room, see each other's cameras, and capture synchronized photos with AI-powered background removal and depth effects.

## Features

- Multi-user rooms with WebSocket sync
- Real-time camera preview
- Synchronized photo capture across all participants
- Browser-based background removal (TensorFlow.js)
- Depth map generation for each subject
- Live editor with background controls and blur effects
- Download final composites

## Tech Stack

**Frontend:** React + TypeScript + Vite + TensorFlow.js
**Backend:** Node.js + Express + Socket.IO
**ML:** MediaPipe Selfie Segmentation for background removal

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Start both server and client:
```bash
npm run dev
```

- Server runs on http://localhost:3001
- Client runs on http://localhost:3000

3. Open multiple browser tabs to test multi-user functionality

## How It Works

1. Create or join a room
2. Grant camera permissions
3. Wait for others to join
4. Click "Capture Photo" - all users capture simultaneously
5. Edit the composite with background colors and blur
6. Download your final photo

## Next Steps

- Add WebRTC for peer-to-peer video streaming
- Implement better depth estimation models
- Add more editing controls (layer ordering, individual positioning)
- Support custom background images
- Add photo gallery per room
- Implement user authentication

## Browser Requirements

- Modern browser with WebRTC support
- Camera access permissions
- WebGL for TensorFlow.js acceleration
