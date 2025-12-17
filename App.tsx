import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { CanvasArea } from './components/CanvasArea';
import { DownloadModal } from './components/DownloadModal';
import { ImageState, ToolType, WatermarkType, DEFAULT_ADJUSTMENTS, DEFAULT_WATERMARK } from './types';
import { Sparkles, CheckCircle, X } from 'lucide-react';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.IMPORT);
  const [images, setImages] = useState<ImageState[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  
  // Download Modal State
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadMode, setDownloadMode] = useState<'SINGLE' | 'BATCH'>('SINGLE');
  const [finalPreviewUrl, setFinalPreviewUrl] = useState<string | null>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedImage = images.find(img => img.id === selectedImageId) || null;

  const showToast = (msg: string) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3000);
  };

  /**
   * Generates the final composite image (Image + Filters + Optional Watermark)
   */
  const generateFinalImage = async (image: ImageState, includeWatermark: boolean = true): Promise<string> => {
      return new Promise((resolve) => {
          const canvas = document.createElement('canvas');
          const img = new Image();
          
          // Use the latest state of the image (Cleaned/Processed or Original)
          img.src = image.processedUrl || image.originalUrl;
          
          // Must ensure crossOrigin is handled if images are external (though here they are base64)
          img.crossOrigin = "anonymous";
          
          img.onload = async () => {
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              
              if (!ctx) {
                  resolve(img.src);
                  return;
              }

              // 1. Draw Background Image with Filters
              const { adjustments } = image;
              ctx.filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%) blur(${adjustments.blur}px) sepia(${adjustments.sepia}%)`;
              ctx.drawImage(img, 0, 0);
              
              // 2. Reset Filter for Watermark
              ctx.filter = 'none';

              // 3. Draw Watermark (if requested)
              const { watermark } = image;
              
              // Handle IMAGE Watermark
              if (includeWatermark && watermark.type === WatermarkType.IMAGE && watermark.imageUrl && watermark.opacity > 0) {
                  const logoImg = new Image();
                  logoImg.src = watermark.imageUrl;
                  logoImg.crossOrigin = "anonymous";
                  
                  await new Promise<void>((r) => { logoImg.onload = () => r(); });
                  
                  const scaleFactor = img.width / 1000;
                  // Base size on width, maintain aspect ratio
                  const wWidth = watermark.size * 4 * scaleFactor; // Multiplier to match visual size of text sliders roughly
                  const aspectRatio = logoImg.height / logoImg.width;
                  const wHeight = wWidth * aspectRatio;
                  
                  ctx.globalAlpha = watermark.opacity / 100;
                  
                  const drawLogo = (x: number, y: number, rotation: number) => {
                      ctx.save();
                      ctx.translate(x, y);
                      ctx.rotate((rotation * Math.PI) / 180);
                      ctx.drawImage(logoImg, -wWidth/2, -wHeight/2, wWidth, wHeight);
                      ctx.restore();
                  };
                  
                  if (watermark.isTiled) {
                      const density = Math.max(1, watermark.tileDensity);
                      const stepX = canvas.width / density;
                      const stepY = canvas.height / density;
                      for (let i = 0; i < density; i++) {
                          for (let j = 0; j < density; j++) {
                              const offsetX = (j % 2 === 0) ? 0 : stepX / 2;
                              drawLogo((i * stepX) + (stepX/2) + offsetX, (j * stepY) + (stepY/2), watermark.rotation);
                          }
                      }
                  } else {
                      drawLogo((watermark.x / 100) * canvas.width, (watermark.y / 100) * canvas.height, watermark.rotation);
                  }
              }
              // Handle TEXT Watermark
              else if (includeWatermark && watermark.type === WatermarkType.TEXT && watermark.text && watermark.opacity > 0) {
                  // Scale based on image width relative to a reference (e.g., 1000px wide screen)
                  const scaleFactor = img.width / 1000; 
                  const fontSize = Math.max(12, watermark.size * scaleFactor);
                  
                  // Setup Font to measure text
                  ctx.font = `${watermark.fontWeight} ${fontSize}px ${watermark.fontFamily}`;
                  const textMetrics = ctx.measureText(watermark.text);
                  const textWidth = textMetrics.width;
                  const textHeight = fontSize; // Approximate height

                  // Calculate Padding
                  const padding = (watermark.padding || 20) * scaleFactor;
                  
                  // Setup Context
                  ctx.globalAlpha = watermark.opacity / 100;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';

                  // Helper to draw the actual content
                  const drawContent = (x: number, y: number, rotation: number) => {
                      ctx.save();
                      ctx.translate(x, y);
                      ctx.rotate((rotation * Math.PI) / 180);

                      // --- Draw Shape/Border ---
                      if (watermark.shape !== 'NONE' && watermark.borderWidth > 0) {
                           ctx.strokeStyle = watermark.borderColor;
                           ctx.lineWidth = watermark.borderWidth * scaleFactor;
                           ctx.lineJoin = 'round';
                           
                           // Shapes centered at 0,0 (local coordinates)
                           if (watermark.shape === 'CIRCLE' || watermark.shape === 'DOUBLE_CIRCLE') {
                               // Radius covers the largest dimension + padding
                               const radius = (Math.max(textWidth, textHeight * 1.5) / 2) + padding;
                               ctx.beginPath();
                               ctx.arc(0, 0, radius, 0, 2 * Math.PI);
                               ctx.stroke();
                               
                               if (watermark.shape === 'DOUBLE_CIRCLE') {
                                   ctx.beginPath();
                                   ctx.arc(0, 0, radius - (6 * scaleFactor), 0, 2 * Math.PI);
                                   ctx.stroke();
                               }
                           } else if (watermark.shape === 'SQUARE') {
                               const w = textWidth + (padding * 3);
                               const h = textHeight + (padding * 2);
                               ctx.strokeRect(-w/2, -h/2, w, h);
                           } else if (watermark.shape === 'ROUNDED') {
                               const w = textWidth + (padding * 3);
                               const h = textHeight + (padding * 2);
                               const r = h / 2;
                               ctx.beginPath();
                               ctx.roundRect(-w/2, -h/2, w, h, r);
                               ctx.stroke();
                           } else if (watermark.shape === 'BRACKETS') {
                                const w = textWidth + (padding * 2);
                                const h = textHeight + (padding);
                                const bracketSize = 20 * scaleFactor;
                                ctx.beginPath();
                                // Left Bracket
                                ctx.moveTo(-w/2 + bracketSize, -h/2);
                                ctx.lineTo(-w/2, -h/2);
                                ctx.lineTo(-w/2, h/2);
                                ctx.lineTo(-w/2 + bracketSize, h/2);
                                // Right Bracket
                                ctx.moveTo(w/2 - bracketSize, -h/2);
                                ctx.lineTo(w/2, -h/2);
                                ctx.lineTo(w/2, h/2);
                                ctx.lineTo(w/2 - bracketSize, h/2);
                                ctx.stroke();
                           }
                      }

                      // --- Draw Text ---
                      ctx.fillStyle = watermark.color;
                      ctx.shadowColor = watermark.shadowColor;
                      ctx.shadowBlur = watermark.shadowBlur * scaleFactor;
                      // @ts-ignore
                      if (typeof ctx.letterSpacing !== 'undefined') {
                           // @ts-ignore
                           ctx.letterSpacing = `${watermark.letterSpacing * scaleFactor}px`;
                      }
                      
                      ctx.fillText(watermark.text, 0, 0); // At center of shape
                      ctx.restore();
                  };

                  if (watermark.isTiled) {
                      const density = Math.max(1, watermark.tileDensity);
                      const stepX = canvas.width / density;
                      const stepY = canvas.height / density;
                      
                      for (let i = 0; i < density; i++) {
                          for (let j = 0; j < density; j++) {
                              const offsetX = (j % 2 === 0) ? 0 : stepX / 2;
                              drawContent(
                                  (i * stepX) + (stepX/2) + offsetX, 
                                  (j * stepY) + (stepY/2), 
                                  watermark.rotation
                              );
                          }
                      }
                  } else {
                      drawContent(
                          (watermark.x / 100) * canvas.width, 
                          (watermark.y / 100) * canvas.height, 
                          watermark.rotation
                      );
                  }
              }

              resolve(canvas.toDataURL('image/jpeg', 0.95));
          };
      });
  };

  const handleImport = (files: FileList) => {
    if (!files || files.length === 0) return;
    
    if (files.length > 1) {
        setIsBatchMode(true);
        showToast(`Batch mode enabled for ${files.length} images`);
    } else if (images.length > 0) {
        setIsBatchMode(true);
        showToast("Batch mode enabled");
    }
    
    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                const newId = crypto.randomUUID();
                const newImage: ImageState = {
                    id: newId,
                    name: file.name,
                    type: file.type,
                    originalUrl: e.target.result as string,
                    processedUrl: null,
                    thumbnailUrl: e.target.result as string,
                    watermark: selectedImage ? { ...selectedImage.watermark } : { ...DEFAULT_WATERMARK },
                    adjustments: selectedImage ? { ...selectedImage.adjustments } : { ...DEFAULT_ADJUSTMENTS },
                    maskPaths: [] 
                };
                
                setImages(prev => {
                    const newList = [...prev, newImage];
                    if (prev.length === 0 && index === 0) {
                        setSelectedImageId(newId);
                        setActiveTool(ToolType.REMOVE);
                    }
                    return newList;
                });
            }
        };
        reader.readAsDataURL(file);
    });
    
    if (!selectedImageId) setActiveTool(ToolType.REMOVE);
  };

  const handleDeleteImage = (id: string) => {
      setImages(prev => {
          const newImages = prev.filter(img => img.id !== id);
          // If we deleted the selected image, select another one or clear selection
          if (selectedImageId === id) {
              if (newImages.length > 0) {
                  setSelectedImageId(newImages[0].id);
              } else {
                  setSelectedImageId(null);
                  setActiveTool(ToolType.IMPORT);
              }
          }
          return newImages;
      });
  };

  const handleUpdateImage = (updates: Partial<ImageState>) => {
    if (!selectedImageId) return;

    setImages(prev => prev.map(img => {
      if (img.id === selectedImageId) {
        return { ...img, ...updates };
      }
      if (isBatchMode) {
        const newImg = { ...img };
        if (updates.watermark) newImg.watermark = { ...updates.watermark };
        if (updates.adjustments) newImg.adjustments = { ...updates.adjustments };
        return newImg;
      }
      return img;
    }));
  };

  const handleApplyToAll = (type: 'WATERMARK' | 'ADJUST') => {
      if (!selectedImage) return;
      setImages(prev => prev.map(img => {
          if (img.id === selectedImage.id) return img;
          return {
              ...img,
              ...(type === 'WATERMARK' ? { watermark: { ...selectedImage.watermark } } : {}),
              ...(type === 'ADJUST' ? { adjustments: { ...selectedImage.adjustments } } : {})
          };
      }));
      showToast(`${type === 'WATERMARK' ? 'Watermark' : 'Adjustment'} settings applied to all ${images.length} images.`);
  };

  // --- Modal Logic ---

  const handleOpenDownloadModal = async () => {
      if (!selectedImage) return;
      setDownloadMode('SINGLE');
      setIsDownloadModalOpen(true);
      
      // Generate the preview with watermark burned in
      const finalUrl = await generateFinalImage(selectedImage, true);
      setFinalPreviewUrl(finalUrl);
  };

  const handleOpenBatchDownloadModal = async () => {
      if (images.length === 0) return;
      setDownloadMode('BATCH');
      setIsDownloadModalOpen(true);
      
      // Generate preview of current selected image just for display
      if (selectedImage) {
          const finalUrl = await generateFinalImage(selectedImage, true);
          setFinalPreviewUrl(finalUrl);
      }
  };

  const handleDownloadWatermarked = async () => {
      if (downloadMode === 'SINGLE') {
          if (!finalPreviewUrl || !selectedImage) return;
          const link = document.createElement('a');
          link.download = `CleanLens_Designed_${selectedImage.name}`;
          link.href = finalPreviewUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast("Downloaded designed image!");
      } else {
          showToast(`Downloading all ${images.length} images with design...`);
          let count = 0;
          for (const img of images) {
              setTimeout(async () => {
                  const finalUrl = await generateFinalImage(img, true);
                  const link = document.createElement('a');
                  link.download = `CleanLens_Designed_${img.name}`;
                  link.href = finalUrl;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
              }, count * 800);
              count++;
          }
      }
      setIsDownloadModalOpen(false);
  };

  const handleDownloadClean = async () => {
      if (downloadMode === 'SINGLE') {
          if (!selectedImage) return;
          // Generate CLEAN version (Adjustments YES, Watermark NO)
          const cleanUrl = await generateFinalImage(selectedImage, false);
          const link = document.createElement('a');
          link.download = `CleanLens_Clean_${selectedImage.name}`;
          link.href = cleanUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast("Downloaded clean image!");
      } else {
          showToast(`Downloading all ${images.length} clean images...`);
          let count = 0;
          for (const img of images) {
              setTimeout(async () => {
                  const cleanUrl = await generateFinalImage(img, false);
                  const link = document.createElement('a');
                  link.download = `CleanLens_Clean_${img.name}`;
                  link.href = cleanUrl;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
              }, count * 800);
              count++;
          }
      }
      setIsDownloadModalOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-darker text-gray-200 relative">
      {/* Toast Notification */}
      {toastMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in-down">
              <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
                  <CheckCircle className="w-4 h-4" />
                  {toastMessage}
              </div>
          </div>
      )}

      {/* Download Modal */}
      <DownloadModal 
          isOpen={isDownloadModalOpen}
          onClose={() => setIsDownloadModalOpen(false)}
          previewUrl={finalPreviewUrl}
          onDownloadWatermarked={handleDownloadWatermarked}
          onDownloadClean={handleDownloadClean}
          fileName={selectedImage?.name || 'Image'}
          count={downloadMode === 'BATCH' ? images.length : 1}
      />

      {/* Header */}
      <header className="h-14 border-b border-border bg-dark/50 backdrop-blur flex items-center px-4 justify-between shrink-0 z-30">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-1.5 rounded-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-white">CleanLens <span className="text-blue-500">AI</span></h1>
        </div>
        <div className="flex items-center gap-4">
             {selectedImage && (
                 <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 font-mono px-3 py-1 bg-gray-800 rounded-full">
                        {selectedImage.name} {images.length > 1 ? `(+${images.length - 1} others)` : ''}
                    </span>
                 </div>
             )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        <Sidebar 
          activeTool={activeTool} 
          onSelectTool={setActiveTool} 
          hasImage={!!selectedImage}
        />
        
        <CanvasArea 
            imageState={selectedImage} 
            activeTool={activeTool}
            onUpdateImage={handleUpdateImage}
        />
        
        <PropertiesPanel 
          activeTool={activeTool}
          imageState={selectedImage}
          onUpdateImage={handleUpdateImage}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
          onImport={handleImport}
          onApplyToAll={handleApplyToAll}
          onBatchDownloadRequest={handleOpenBatchDownloadModal}
          onDownloadRequest={handleOpenDownloadModal}
          totalImages={images.length}
          isBatchMode={isBatchMode}
          setIsBatchMode={setIsBatchMode}
        />
      </main>
      
      {/* Bottom Thumbnail Strip */}
      {images.length > 0 && (
          <div className="h-20 bg-darker border-t border-border flex items-center px-4 gap-2 overflow-x-auto shrink-0 z-20">
              {images.map(img => (
                  <div key={img.id} className="relative group shrink-0">
                      <button 
                        onClick={() => setSelectedImageId(img.id)}
                        className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${selectedImageId === img.id ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent opacity-50 hover:opacity-100'}`}
                      >
                          <img src={img.thumbnailUrl} alt="thumb" className="w-full h-full object-cover" />
                      </button>
                      <button 
                          onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteImage(img.id);
                          }}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                          title="Remove image"
                      >
                          <X className="w-3 h-3" />
                      </button>
                  </div>
              ))}
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center hover:border-blue-500 cursor-pointer text-gray-500 hover:text-blue-500 relative shrink-0">
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={(e) => { if(e.target.files && e.target.files.length > 0) handleImport(e.target.files) }} 
                  />
                  <span className="text-2xl">+</span>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;