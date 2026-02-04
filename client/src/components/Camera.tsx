import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';
import { Camera as MediaPipeCamera } from '@mediapipe/camera_utils';
import './Camera.css';

interface CameraProps {
  userId: string;
  isLocal: boolean;
}

const Camera = forwardRef(({ userId, isLocal }: CameraProps, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [showDevices, setShowDevices] = useState(false);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [edgeBlur, setEdgeBlur] = useState(3);
  const selfieSegmentationRef = useRef<SelfieSegmentation | null>(null);
  const cameraRef = useRef<MediaPipeCamera | null>(null);
  const removeBackgroundRef = useRef(false);
  const edgeBlurRef = useRef(3);

  useEffect(() => {
    removeBackgroundRef.current = removeBackground;
  }, [removeBackground]);

  useEffect(() => {
    edgeBlurRef.current = edgeBlur;
  }, [edgeBlur]);

  useEffect(() => {
    // Initialize camera for ALL users (local and remote will show their own)
    loadDevices();
    setIsLoading(true);
    initMediaPipe();

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, []);

  const loadDevices = async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error enumerating devices:', err);
    }
  };

  const initMediaPipe = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const selfieSegmentation = new SelfieSegmentation({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
      }
    });

    selfieSegmentation.setOptions({
      modelSelection: 1, // 0 = general, 1 = landscape (faster)
      selfieMode: true,
    });

    selfieSegmentation.onResults(onResults);
    selfieSegmentationRef.current = selfieSegmentation;

    const camera = new MediaPipeCamera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current && selfieSegmentationRef.current) {
          await selfieSegmentationRef.current.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480
    });

    camera.start();
    cameraRef.current = camera;
    setIsLoading(false);
  };

  const onResults = (results: any) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;

    canvas.width = results.image.width;
    canvas.height = results.image.height;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (removeBackgroundRef.current) {
      // Draw the original image first
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      
      // Create a temporary canvas for the mask
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const maskCtx = maskCanvas.getContext('2d')!;
      
      // Draw the segmentation mask
      maskCtx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
      
      // Apply blur to soften edges
      if (edgeBlurRef.current > 0) {
        maskCtx.filter = `blur(${edgeBlurRef.current}px)`;
        maskCtx.drawImage(maskCanvas, 0, 0);
        maskCtx.filter = 'none';
      }
      
      // Use the mask to cut out only the person
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskCanvas, 0, 0);
      
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // Draw full image with background
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    }

    ctx.restore();
  };

  useImperativeHandle(ref, () => ({
    async captureFrame() {
      if (!canvasRef.current) return null;

      const canvas = canvasRef.current;
      const imageData = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);

      return {
        userId,
        imageData,
        foreground: imageData,
        depthMap: null
      };
    },
    getCanvas() {
      return canvasRef.current;
    },
    async getCanvasStream() {
      if (!canvasRef.current) return null;
      return canvasRef.current.captureStream(30); // 30 FPS
    }
  }));

  return (
    <div className="camera-container">
      {isLocal && (
        <button 
          className="camera-toggle"
          onClick={() => setRemoveBackground(!removeBackground)}
          disabled={isLoading}
        >
          {isLoading ? '⏳ Loading...' : removeBackground ? '🖼️ Show BG' : '👤 Remove BG'}
        </button>
      )}
      
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted
        style={{ display: 'none' }}
      />
      
      <canvas 
        ref={canvasRef}
        style={{ 
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
      />
      
      <div className="camera-label">
        {isLocal ? 'You' : `User ${userId.slice(0, 6)}`}
      </div>
      
      {isLocal && removeBackground && (
        <div className="edge-blur-control">
          <label>Edge Softness: {edgeBlur}px</label>
          <input
            type="range"
            min="0"
            max="10"
            value={edgeBlur}
            onChange={(e) => setEdgeBlur(Number(e.target.value))}
          />
        </div>
      )}
      
      {isLocal && devices.length > 1 && (
        <div className="camera-controls">
          <button 
            className="camera-switch-btn"
            onClick={() => setShowDevices(!showDevices)}
          >
            🔄
          </button>
          {showDevices && (
            <select 
              className="camera-select"
              value={selectedDevice}
              onChange={(e) => {
                setSelectedDevice(e.target.value);
                setShowDevices(false);
              }}
            >
              {devices.map((device, idx) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
});

export default Camera;
