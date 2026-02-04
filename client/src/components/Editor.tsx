import { useEffect, useRef, useState } from 'react';
import { CapturedFrame } from './Room';
import './Editor.css';

interface EditorProps {
  frames: CapturedFrame[];
  onBack: () => void;
  socket?: any;
  roomId?: string;
}

interface Layer {
  id: string;
  name: string;
  imageData: ImageData;
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  locked: boolean;
}

function Editor({ frames, onBack, socket, roomId }: EditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [background, setBackground] = useState('transparent');
  const [blur, setBlur] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Initialize layers from captured frames
  useEffect(() => {
    const initialLayers: Layer[] = frames.map((frame, index) => ({
      id: `layer-${Date.now()}-${index}`,
      name: `Person ${index + 1}`,
      imageData: frame.foreground || frame.imageData,
      visible: true,
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      locked: false
    }));
    setLayers(initialLayers);
    if (initialLayers.length > 0) {
      setSelectedLayerId(initialLayers[0].id);
    }
  }, [frames]);

  // Render canvas whenever layers or settings change
  useEffect(() => {
    renderComposite();
  }, [layers, background, blur]);

  // Sync layer changes with other users
  useEffect(() => {
    if (!socket || !roomId) return;

    socket.on('layer-update', (data: { layers: Layer[] }) => {
      setLayers(data.layers);
    });

    return () => {
      socket.off('layer-update');
    };
  }, [socket, roomId]);

  const broadcastLayerUpdate = (updatedLayers: Layer[]) => {
    if (socket && roomId) {
      socket.emit('layer-update', { roomId, layers: updatedLayers });
    }
  };

  const renderComposite = () => {
    if (!canvasRef.current || layers.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    // Set canvas size based on first layer
    if (layers[0]) {
      canvas.width = layers[0].imageData.width;
      canvas.height = layers[0].imageData.height;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    if (background !== 'transparent') {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (blur > 0) {
        ctx.filter = `blur(${blur}px)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
      }
    }

    // Draw layers from bottom to top
    layers.forEach(layer => {
      if (!layer.visible) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity;

      // Apply transformations
      const centerX = canvas.width / 2 + layer.x;
      const centerY = canvas.height / 2 + layer.y;
      
      ctx.translate(centerX, centerY);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.scale(layer.scale, layer.scale);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      // Draw layer
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = layer.imageData.width;
      tempCanvas.height = layer.imageData.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(layer.imageData, 0, 0);
      
      ctx.drawImage(tempCanvas, 0, 0);

      // Draw selection border if selected
      if (layer.id === selectedLayerId) {
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
      }

      ctx.restore();
    });
  };

  const updateLayer = (layerId: string, updates: Partial<Layer>) => {
    const updatedLayers = layers.map(layer =>
      layer.id === layerId ? { ...layer, ...updates } : layer
    );
    setLayers(updatedLayers);
    broadcastLayerUpdate(updatedLayers);
  };

  const moveLayerUp = (layerId: string) => {
    const index = layers.findIndex(l => l.id === layerId);
    if (index < layers.length - 1) {
      const newLayers = [...layers];
      [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
      setLayers(newLayers);
      broadcastLayerUpdate(newLayers);
    }
  };

  const moveLayerDown = (layerId: string) => {
    const index = layers.findIndex(l => l.id === layerId);
    if (index > 0) {
      const newLayers = [...layers];
      [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
      setLayers(newLayers);
      broadcastLayerUpdate(newLayers);
    }
  };

  const deleteLayer = (layerId: string) => {
    const newLayers = layers.filter(l => l.id !== layerId);
    setLayers(newLayers);
    broadcastLayerUpdate(newLayers);
    if (selectedLayerId === layerId && newLayers.length > 0) {
      setSelectedLayerId(newLayers[0].id);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const selectedLayer = layers.find(l => l.id === selectedLayerId);
    if (!selectedLayer || selectedLayer.locked) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - rect.left - selectedLayer.x,
      y: e.clientY - rect.top - selectedLayer.y
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedLayerId) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragStart.x;
    const newY = e.clientY - rect.top - dragStart.y;

    updateLayer(selectedLayerId, { x: newX, y: newY });
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `photo-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  return (
    <div className="editor">
      <div className="editor-header">
        <button onClick={onBack} className="back-btn">← Back to Room</button>
        <h2>Edit Your Photo</h2>
        <button onClick={handleDownload} className="download-btn">💾 Download</button>
      </div>

      <div className="editor-layout">
        {/* Main Canvas */}
        <div className="editor-canvas-area">
          <div className="canvas-container" style={{ background: 'repeating-conic-gradient(#ddd 0% 25%, white 0% 50%) 50% / 20px 20px' }}>
            <canvas 
              ref={canvasRef} 
              className="editor-canvas"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            />
          </div>
        </div>

        {/* Right Sidebar - Layers & Controls */}
        <div className="editor-sidebar">
          {/* Background Controls */}
          <div className="control-section">
            <h3>Background</h3>
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
              className="color-picker"
            />
            <label>Blur: {blur}px</label>
            <input
              type="range"
              min="0"
              max="20"
              value={blur}
              onChange={(e) => setBlur(Number(e.target.value))}
              disabled={background === 'transparent'}
            />
          </div>

          {/* Layer Properties */}
          {selectedLayer && (
            <div className="control-section">
              <h3>Layer Properties</h3>
              
              <label>Opacity: {Math.round(selectedLayer.opacity * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={selectedLayer.opacity}
                onChange={(e) => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) })}
                disabled={selectedLayer.locked}
              />

              <label>Scale: {Math.round(selectedLayer.scale * 100)}%</label>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.01"
                value={selectedLayer.scale}
                onChange={(e) => updateLayer(selectedLayer.id, { scale: Number(e.target.value) })}
                disabled={selectedLayer.locked}
              />

              <label>Rotation: {selectedLayer.rotation}°</label>
              <input
                type="range"
                min="-180"
                max="180"
                value={selectedLayer.rotation}
                onChange={(e) => updateLayer(selectedLayer.id, { rotation: Number(e.target.value) })}
                disabled={selectedLayer.locked}
              />
            </div>
          )}

          {/* Layers Panel */}
          <div className="control-section layers-panel">
            <h3>Layers</h3>
            <div className="layers-list">
              {[...layers].reverse().map((layer, index) => (
                <div
                  key={layer.id}
                  className={`layer-item ${layer.id === selectedLayerId ? 'selected' : ''}`}
                  onClick={() => setSelectedLayerId(layer.id)}
                >
                  <div className="layer-info">
                    <button
                      className="layer-visibility"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayer(layer.id, { visible: !layer.visible });
                      }}
                    >
                      {layer.visible ? '👁️' : '🚫'}
                    </button>
                    <span className="layer-name">{layer.name}</span>
                    <button
                      className="layer-lock"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayer(layer.id, { locked: !layer.locked });
                      }}
                    >
                      {layer.locked ? '🔒' : '🔓'}
                    </button>
                  </div>
                  <div className="layer-actions">
                    <button onClick={(e) => { e.stopPropagation(); moveLayerUp(layer.id); }} disabled={index === 0}>↑</button>
                    <button onClick={(e) => { e.stopPropagation(); moveLayerDown(layer.id); }} disabled={index === layers.length - 1}>↓</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} disabled={layers.length === 1}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Editor;
