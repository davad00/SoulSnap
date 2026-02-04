import { useEffect, useRef, useState } from 'react';
import { CapturedFrame } from './Room';
import './Editor.css';

interface EditorProps {
  frames: CapturedFrame[];
  onBack: () => void;
}

function Editor({ frames, onBack }: EditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [background, setBackground] = useState('transparent');
  const [blur, setBlur] = useState(0);

  useEffect(() => {
    renderComposite();
  }, [frames, background, blur]);

  const renderComposite = () => {
    if (!canvasRef.current || frames.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    const firstFrame = frames[0];
    canvas.width = firstFrame.imageData.width;
    canvas.height = firstFrame.imageData.height;

    // Clear canvas to transparent
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background if not transparent
    if (background !== 'transparent') {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (blur > 0) {
        ctx.filter = `blur(${blur}px)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
      }
    }

    // Draw all foregrounds
    frames.forEach(frame => {
      if (frame.foreground) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = frame.foreground.width;
        tempCanvas.height = frame.foreground.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.putImageData(frame.foreground, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0);
      } else {
        ctx.putImageData(frame.imageData, 0, 0);
      }
    });
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `photo-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="editor">
      <div className="editor-header">
        <button onClick={onBack} className="back-btn">← Back to Room</button>
        <h2>Edit Your Photo</h2>
        <button onClick={handleDownload} className="download-btn">💾 Download</button>
      </div>

      <div className="editor-content">
        <div className="canvas-container" style={{ background: 'repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 50% / 20px 20px' }}>
          <canvas ref={canvasRef} className="editor-canvas" />
        </div>

        <div className="editor-controls">
          <div className="control-group">
            <label>Background</label>
            <div className="color-presets">
              <button
                className={`color-preset ${background === 'transparent' ? 'active' : ''}`}
                style={{ 
                  background: 'repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 50% / 10px 10px',
                  border: '2px solid #666'
                }}
                onClick={() => setBackground('transparent')}
                title="Transparent"
              />
              {['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b'].map(color => (
                <button
                  key={color}
                  className={`color-preset ${background === color ? 'active' : ''}`}
                  style={{ background: color }}
                  onClick={() => setBackground(color)}
                />
              ))}
            </div>
            <input
              type="color"
              value={background === 'transparent' ? '#667eea' : background}
              onChange={(e) => setBackground(e.target.value)}
            />
          </div>

          <div className="control-group">
            <label>Background Blur: {blur}px</label>
            <input
              type="range"
              min="0"
              max="20"
              value={blur}
              onChange={(e) => setBlur(Number(e.target.value))}
              disabled={background === 'transparent'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Editor;
