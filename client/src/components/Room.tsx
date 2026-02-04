import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import Camera from './Camera';
import Editor from './Editor';
import './Room.css';

interface RoomProps {
  roomId: string;
}

export interface CapturedFrame {
  userId: string;
  imageData: ImageData;
  foreground?: ImageData;
  depthMap?: ImageData;
}

interface PeerConnection {
  peer: Peer.Instance;
  stream: MediaStream | null;
}

function Room({ roomId }: RoomProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const [capturing, setCapturing] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState<CapturedFrame[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState<string>('');
  const cameraRef = useRef<any>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    // Auto-detect server URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = window.location.hostname;
    
    // Use environment variable if set, otherwise auto-detect
    let serverUrl: string;
    if (import.meta.env.VITE_SERVER_URL) {
      serverUrl = import.meta.env.VITE_SERVER_URL;
    } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
      serverUrl = 'http://localhost:3001';
    } else {
      // For production/ngrok, assume same protocol and host
      serverUrl = `${protocol}//${hostname}`;
    }
    
    console.log('Connecting to server:', serverUrl);
    
    const newSocket = io(serverUrl, {
      path: '/socket.io/',
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
      newSocket.emit('join-room', roomId);
      setError('');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError(`Connection failed: ${err.message}. Make sure server is running.`);
    });

    newSocket.on('room-joined', ({ userId }) => {
      setUserId(userId);
      setError('');
    });

    newSocket.on('user-joined', ({ userId: newUserId }) => {
      console.log('User joined:', newUserId);
      // Create peer connection for new user
      createPeerConnection(newUserId, true, newSocket);
    });

    newSocket.on('user-left', ({ userId: leftUserId }) => {
      console.log('User left:', leftUserId);
      const peerConn = peersRef.current.get(leftUserId);
      if (peerConn) {
        peerConn.peer.destroy();
        peersRef.current.delete(leftUserId);
        setPeers(new Map(peersRef.current));
      }
    });

    newSocket.on('signal', ({ from, signal }) => {
      console.log('Received signal from:', from);
      let peerConn = peersRef.current.get(from);
      
      if (!peerConn) {
        // Create peer connection if it doesn't exist (we're receiving the offer)
        peerConn = createPeerConnection(from, false, newSocket);
      }
      
      if (peerConn) {
        peerConn.peer.signal(signal);
      }
    });

    newSocket.on('capture-now', async () => {
      try {
        const frames: CapturedFrame[] = [];
        
        // Capture local user's camera
        if (cameraRef.current?.captureFrame) {
          const localFrame = await cameraRef.current.captureFrame();
          if (localFrame) {
            frames.push(localFrame);
          }
        }
        
        // Capture remote users' video streams
        remoteVideosRef.current.forEach((video, peerId) => {
          if (video.readyState >= 2) {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            frames.push({
              userId: peerId,
              imageData,
              foreground: imageData,
              depthMap: undefined
            });
          }
        });
        
        if (frames.length > 0) {
          setCapturedFrames(frames);
          setEditMode(true);
        }
      } catch (err) {
        console.error('Capture error:', err);
        setError('Failed to capture photo. Please try again.');
      }
    });

    setSocket(newSocket);

    return () => {
      peersRef.current.forEach(peerConn => peerConn.peer.destroy());
      peersRef.current.clear();
      newSocket.close();
    };
  }, [roomId]);

  const createPeerConnection = (peerId: string, initiator: boolean, socket: Socket) => {
    console.log(`Creating peer connection with ${peerId}, initiator: ${initiator}`);
    
    const peer = new Peer({
      initiator,
      trickle: false,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('signal', (signal: any) => {
      console.log('Sending signal to:', peerId);
      socket.emit('signal', { to: peerId, signal });
    });

    peer.on('stream', (stream: MediaStream) => {
      console.log('Received stream from:', peerId);
      const peerConn = peersRef.current.get(peerId);
      if (peerConn) {
        peerConn.stream = stream;
        setPeers(new Map(peersRef.current));
      }
    });

    peer.on('error', (err: Error) => {
      console.error('Peer error:', err);
    });

    const peerConn: PeerConnection = { peer, stream: null };
    peersRef.current.set(peerId, peerConn);
    setPeers(new Map(peersRef.current));

    return peerConn;
  };

  // Get local stream from camera and share it
  useEffect(() => {
    if (!cameraRef.current || !socket) return;

    const shareStream = async () => {
      const stream = await cameraRef.current.getCanvasStream();
      if (stream) {
        peersRef.current.forEach(peerConn => {
          if (peerConn.peer && !peerConn.peer.destroyed) {
            peerConn.peer.addStream(stream);
          }
        });
      }
    };

    shareStream();
  }, [socket, peers]);

  // Composite all streams into one canvas
  useEffect(() => {
    if (!compositeCanvasRef.current) return;

    const canvas = compositeCanvasRef.current;
    const ctx = canvas.getContext('2d')!;
    let animationId: number;

    // Update video elements for remote streams
    peersRef.current.forEach((peerConn, peerId) => {
      if (peerConn.stream && !remoteVideosRef.current.has(peerId)) {
        const video = document.createElement('video');
        video.srcObject = peerConn.stream;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.play().catch(err => console.error('Error playing remote video:', err));
        remoteVideosRef.current.set(peerId, video);
      }
    });

    // Remove videos for disconnected peers
    remoteVideosRef.current.forEach((video, peerId) => {
      if (!peersRef.current.has(peerId)) {
        video.pause();
        video.srcObject = null;
        remoteVideosRef.current.delete(peerId);
      }
    });

    const drawComposite = () => {
      // Get local canvas dimensions
      const localCanvas = cameraRef.current?.getCanvas();
      if (localCanvas) {
        canvas.width = localCanvas.width;
        canvas.height = localCanvas.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw local camera first
      if (localCanvas) {
        ctx.drawImage(localCanvas, 0, 0);
      }

      // Draw remote streams on top (they will overlay)
      remoteVideosRef.current.forEach((video) => {
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA
          // Draw remote video semi-transparently, maintaining aspect ratio
          ctx.globalAlpha = 0.5;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1.0;
        }
      });

      animationId = requestAnimationFrame(drawComposite);
    };

    drawComposite();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [peers]);

  const handleCapture = () => {
    if (socket) {
      setCapturing(true);
      socket.emit('capture-trigger', roomId);
      setTimeout(() => setCapturing(false), 1000);
    }
  };

  const handleBackToRoom = () => {
    setEditMode(false);
    setCapturedFrames([]);
  };

  if (editMode && capturedFrames.length > 0) {
    return <Editor frames={capturedFrames} onBack={handleBackToRoom} socket={socket} roomId={roomId} />;
  }

  return (
    <div className="room">
      <div className="room-header">
        <h2>Room: {roomId}</h2>
        <span className="user-count">{peers.size + 1} user{peers.size !== 0 ? 's' : ''}</span>
      </div>

      {error && (
        <div style={{ 
          background: '#ff4444', 
          padding: '1rem', 
          borderRadius: '8px', 
          marginBottom: '1rem',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      <div className="camera-grid">
        <div className="composite-view">
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Camera ref={cameraRef} userId={userId} isLocal={true} />
            <canvas 
              ref={compositeCanvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 5,
                objectFit: 'contain'
              }}
            />
          </div>
        </div>
      </div>

      <div className="room-controls">
        <button 
          onClick={handleCapture} 
          disabled={capturing}
          className="capture-btn"
        >
          {capturing ? 'Capturing...' : '📸 Capture Photo'}
        </button>
      </div>
    </div>
  );
}

export default Room;
