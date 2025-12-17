import React, { useRef, useState, useEffect } from 'react';
import { ImageState, ToolType, WatermarkType } from '../types';
import { Maximize, ZoomIn, ZoomOut, Eraser } from 'lucide-react';

interface CanvasAreaProps {
  imageState: ImageState | null;
  activeTool: ToolType;
  onUpdateImage: (updates: Partial<ImageState>) => void;
}

export const CanvasArea: React.FC<CanvasAreaProps> = ({ 
  imageState, 
  activeTool,
  onUpdateImage
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Watermark dragging state
  const [isDraggingWatermark, setIsDraggingWatermark] = useState(false);
  const [dragWatermarkStart, setDragWatermarkStart] = useState({ x: 0, y: 0 });
  const [initialWatermarkPos, setInitialWatermarkPos] = useState({ x: 0, y: 0 });

  // Mask Drawing State
  const [isDrawingMask, setIsDrawingMask] = useState(false);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const currentPathRef = useRef<{x:number, y:number}[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Reset zoom/pan when image changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [imageState?.id]);

  // Handle Mask Rendering
  useEffect(() => {
    if (imageState && maskCanvasRef.current && imageContainerRef.current) {
        const canvas = maskCanvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Let's set canvas resolution to a fixed high quality value
        canvas.width = 1000;
        canvas.height = 1000 * (imageContainerRef.current.clientHeight / imageContainerRef.current.clientWidth || 1);
        
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Draw all paths
            (imageState.maskPaths || []).forEach(path => {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; // Red semi-transparent
                ctx.lineWidth = path.size * (canvas.width / 100); // Scale brush relative to canvas width
                
                if (path.points.length > 0) {
                    ctx.moveTo(path.points[0].x / 100 * canvas.width, path.points[0].y / 100 * canvas.height);
                    for (let i = 1; i < path.points.length; i++) {
                        ctx.lineTo(path.points[i].x / 100 * canvas.width, path.points[i].y / 100 * canvas.height);
                    }
                }
                ctx.stroke();
            });
        }
    }
  }, [imageState?.maskPaths, imageState?.id, zoom]); // Re-render when zoom changes to ensure alignment (though canvas is absolute)


  // Handle Watermark Dragging globally
  useEffect(() => {
    const handleWindowMove = (e: MouseEvent) => {
        if (isDraggingWatermark && imageState && imageContainerRef.current) {
             const rect = imageContainerRef.current.getBoundingClientRect();
             if (rect.width === 0 || rect.height === 0) return;
             
             const deltaX = e.clientX - dragWatermarkStart.x;
             const deltaY = e.clientY - dragWatermarkStart.y;
             
             const deltaPercentX = (deltaX / rect.width) * 100;
             const deltaPercentY = (deltaY / rect.height) * 100;
             
             const newX = initialWatermarkPos.x + deltaPercentX;
             const newY = initialWatermarkPos.y + deltaPercentY;
             
             onUpdateImage({
                 watermark: {
                     ...imageState.watermark,
                     x: newX,
                     y: newY
                 }
             });
        }
    };
    
    const handleWindowUp = () => {
        if (isDraggingWatermark) {
            setIsDraggingWatermark(false);
        }
    };

    if (isDraggingWatermark) {
        window.addEventListener('mousemove', handleWindowMove);
        window.addEventListener('mouseup', handleWindowUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleWindowMove);
        window.removeEventListener('mouseup', handleWindowUp);
    };
  }, [isDraggingWatermark, dragWatermarkStart, initialWatermarkPos, imageState, onUpdateImage]);

  if (!imageState) {
    return (
      <div className="flex-1 flex items-center justify-center bg-dark text-gray-500 flex-col gap-4">
        <div className="w-24 h-24 border-2 border-dashed border-gray-700 rounded-2xl flex items-center justify-center">
          <Maximize className="w-8 h-8 opacity-20" />
        </div>
        <p>No image selected. Please import an image.</p>
      </div>
    );
  }

  const { originalUrl, processedUrl, adjustments, watermark } = imageState;
  
  // ALWAYS show the processed image if it exists. 
  // This supports the "incremental repair" workflow where 'original' conceptually updates to the clean version.
  const displayUrl = processedUrl || originalUrl;

  const getFilterString = () => {
    return `
      brightness(${adjustments.brightness}%) 
      contrast(${adjustments.contrast}%) 
      saturate(${adjustments.saturation}%) 
      blur(${adjustments.blur}px) 
      sepia(${adjustments.sepia}%)
    `;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === ToolType.REMOVE) {
        // Start Drawing Mask
        if (!imageContainerRef.current) return;
        setIsDrawingMask(true);
        const rect = imageContainerRef.current.getBoundingClientRect();
        const xPct = ((e.clientX - rect.left) / rect.width) * 100;
        const yPct = ((e.clientY - rect.top) / rect.height) * 100;
        currentPathRef.current = [{x: xPct, y: yPct}];
    } else {
        // Pan Canvas
        setIsDraggingCanvas(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDrawingMask && activeTool === ToolType.REMOVE) {
        if (!imageContainerRef.current) return;
        const rect = imageContainerRef.current.getBoundingClientRect();
        const xPct = ((e.clientX - rect.left) / rect.width) * 100;
        const yPct = ((e.clientY - rect.top) / rect.height) * 100;
        currentPathRef.current.push({x: xPct, y: yPct});
        
        // Force re-render of canvas (visual only)
        const canvas = maskCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            const x = xPct / 100 * canvas.width;
            const y = yPct / 100 * canvas.height;
            // Draw latest segment
            const prev = currentPathRef.current[currentPathRef.current.length - 2];
            if (prev) {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
                ctx.lineWidth = 5 * (canvas.width / 100); // Default size 5
                ctx.lineCap = 'round';
                ctx.moveTo(prev.x / 100 * canvas.width, prev.y / 100 * canvas.height);
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        }

    } else if (isDraggingCanvas) {
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    if (isDrawingMask) {
        setIsDrawingMask(false);
        // Save the path to state
        if (currentPathRef.current.length > 0) {
            const newPath = {
                points: [...currentPathRef.current],
                size: 5 // Default size, could be dynamic
            };
            onUpdateImage({
                maskPaths: [...(imageState.maskPaths || []), newPath]
            });
        }
        currentPathRef.current = [];
    }
    setIsDraggingCanvas(false);
  };

  const handleWatermarkMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDraggingWatermark(true);
      setDragWatermarkStart({ x: e.clientX, y: e.clientY });
      setInitialWatermarkPos({ x: watermark.x, y: watermark.y });
  };

  const renderWatermark = () => {
    // Hide watermark when using magic wand to focus on cleanup
    if (activeTool === ToolType.REMOVE) return null;
    
    // Position/Transform Styles (Common)
    const transformStyle: React.CSSProperties = {
        transform: `rotate(${watermark.rotation}deg) translate(-50%, -50%)`,
        position: 'absolute',
        left: `${watermark.x}%`,
        top: `${watermark.y}%`,
        cursor: 'move',
        pointerEvents: 'auto',
        transformOrigin: 'center center',
        userSelect: 'none',
        opacity: watermark.opacity / 100,
    };

    let FinalElement: React.ReactElement;

    // --- RENDER IMAGE ---
    if (watermark.type === WatermarkType.IMAGE && watermark.imageUrl) {
        // We use fontSize/em in Text styling, for Image we'll use pixel widths 
        // scaled by the 'Size' slider (which is 10-150px in panel).
        // To make it visible on large images, we might use a rem scaling approach or just direct sizing.
        // For consistency with text, let's treat the slider value as a relative width.
        const width = `${watermark.size * 4}px`; // Multiplier to make it reasonably sized compared to text
        
        const imageStyle: React.CSSProperties = {
            ...transformStyle,
            width: width,
            height: 'auto',
            display: 'block'
        };

        FinalElement = (
            <img 
                src={watermark.imageUrl}
                style={imageStyle}
                onMouseDown={handleWatermarkMouseDown}
                draggable={false}
                className="hover:outline hover:outline-1 hover:outline-blue-400 hover:ring-2 hover:ring-blue-500/20"
                alt="watermark"
            />
        );
    } 
    // --- RENDER TEXT ---
    else {
        const baseTextStyle: React.CSSProperties = {
            ...transformStyle,
            color: watermark.color,
            fontSize: `${watermark.size}px`,
            fontFamily: watermark.fontFamily,
            fontWeight: watermark.fontWeight,
            letterSpacing: `${watermark.letterSpacing}px`,
            textShadow: `0px 0px ${watermark.shadowBlur}px ${watermark.shadowColor}`,
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center'
        };

        let shapeStyle: React.CSSProperties = {};
        const borderWidth = `${Math.max(1, watermark.borderWidth)}px`;
        const borderColor = watermark.borderColor;
        const padding = `${watermark.padding}px`;

        if (watermark.shape === 'SQUARE') {
            shapeStyle = { border: `${borderWidth} solid ${borderColor}`, padding };
        } else if (watermark.shape === 'ROUNDED') {
            shapeStyle = { border: `${borderWidth} solid ${borderColor}`, padding, borderRadius: '999px' };
        } else if (watermark.shape === 'CIRCLE') {
            shapeStyle = { 
                border: `${borderWidth} solid ${borderColor}`, 
                padding, 
                borderRadius: '50%', 
                aspectRatio: '1/1',
                minWidth: '1em',
                minHeight: '1em'
            };
        } else if (watermark.shape === 'DOUBLE_CIRCLE') {
            shapeStyle = { 
                border: `${borderWidth} solid ${borderColor}`, 
                padding, 
                borderRadius: '50%', 
                aspectRatio: '1/1',
                boxShadow: `inset 0 0 0 4px transparent, inset 0 0 0 ${parseInt(borderWidth) + 4}px ${borderColor}` 
            };
        } else if (watermark.shape === 'BRACKETS') {
            shapeStyle = { 
                borderLeft: `${borderWidth} solid ${borderColor}`, 
                borderRight: `${borderWidth} solid ${borderColor}`, 
                padding 
            };
        }

        FinalElement = (
            <div 
                style={{...baseTextStyle, ...shapeStyle}}
                onMouseDown={handleWatermarkMouseDown}
                className="hover:outline hover:outline-1 hover:outline-blue-400 hover:bg-blue-500/10 transition-colors"
            >
                {watermark.text}
            </div>
        );
    }

    if (watermark.isTiled) {
      // For tiling, we render the FinalElement multiple times in a grid
      // Note: This is a simplified visual representation. Canvas export logic handles it more precisely.
      // We need to clone the element without absolute positioning for the grid items
      
      const tiledContent = watermark.type === WatermarkType.IMAGE && watermark.imageUrl ? (
          <img 
            src={watermark.imageUrl} 
            alt="wm"
            draggable={false}
            style={{ 
                width: `${watermark.size * 4}px`, 
                height: 'auto',
                opacity: watermark.opacity / 100, 
                transform: `rotate(${watermark.rotation}deg)` 
            }} 
          />
      ) : (
          <div style={{
              color: watermark.color,
              fontSize: `${watermark.size}px`,
              fontFamily: watermark.fontFamily,
              fontWeight: watermark.fontWeight,
              opacity: watermark.opacity / 100, 
              transform: `rotate(${watermark.rotation}deg)`
          }}>
              {watermark.text}
          </div>
      );

      return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-10" style={{ mixBlendMode: 'normal' }}>
            <div className="w-full h-full flex flex-wrap content-start justify-evenly overflow-hidden" 
                 style={{ gap: `${100 / watermark.tileDensity}%` }}>
                 {Array.from({ length: watermark.tileDensity * watermark.tileDensity * 2 }).map((_, i) => (
                     <div key={i} className="p-8 flex items-center justify-center">
                         {tiledContent}
                     </div>
                 ))}
            </div>
        </div>
      );
    }

    return FinalElement;
  };

  return (
    <div className="flex-1 relative bg-[#0B0F19] overflow-hidden flex flex-col">
      {/* Top Bar controls */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-800/80 backdrop-blur-md p-2 rounded-full flex gap-2 z-30 border border-gray-700 shadow-xl">
         <button onClick={() => setZoom(Math.max(0.1, zoom - 0.1))} className="p-2 hover:bg-gray-700 rounded-full text-gray-300">
            <ZoomOut size={18} />
         </button>
         <span className="px-2 py-1 text-xs font-mono text-gray-400 flex items-center">{Math.round(zoom * 100)}%</span>
         <button onClick={() => setZoom(Math.min(3, zoom + 0.1))} className="p-2 hover:bg-gray-700 rounded-full text-gray-300">
            <ZoomIn size={18} />
         </button>
      </div>
      
      {/* Tool Hint Overlay */}
      {activeTool === ToolType.REMOVE && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-black/60 text-white text-xs px-3 py-1 rounded-full pointer-events-none backdrop-blur-sm">
             🖌️ Paint over logo to remove
          </div>
      )}

      {/* Main Canvas Container */}
      <div 
        ref={containerRef}
        className={`flex-1 flex items-center justify-center relative overflow-hidden ${activeTool === ToolType.REMOVE ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div 
            style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transition: isDraggingCanvas ? 'none' : 'transform 0.2s ease-out'
            }}
            className="relative shadow-2xl"
        >
            {/* Wrapper for Image + Watermark to establish relative positioning context */}
            <div className="relative" ref={imageContainerRef}>
                <img 
                    src={displayUrl} 
                    alt="Work" 
                    className="max-w-none pointer-events-none select-none"
                    style={{ 
                        filter: activeTool === ToolType.ADJUST ? getFilterString() : 'none',
                        maxHeight: '80vh',
                        maxWidth: '80vw',
                        display: 'block' // Remove inline gap
                    }} 
                />
                
                {renderWatermark()}
                
                {/* Mask Overlay Canvas */}
                {activeTool === ToolType.REMOVE && (
                    <canvas
                        ref={maskCanvasRef}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                    />
                )}
            </div>
        </div>
      </div>
    </div>
  );
};