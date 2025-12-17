import React, { useState, useEffect } from 'react';
import { ImageState, ToolType, WatermarkType, DEFAULT_WATERMARK } from '../types';
import { Button } from './Button';
import { Slider } from './Slider';
import { Wand2, Type, Grid, Check, Download, AlertCircle, RefreshCw, Sparkles, ImagePlus, Copy, Layers, Link2, Link2Off, Eraser, Undo2, Palette, BoxSelect, Circle, Square, MessageSquare, Stamp, Scissors } from 'lucide-react';
import { generateWatermarkTextAI, suggestWatermarkStyleAI, detectWatermarkAI, removeWatermarkAI, suggestLogoStyleAI, removeBackgroundAI } from '../services/geminiService';

interface PropertiesPanelProps {
  activeTool: ToolType;
  imageState: ImageState | null;
  onUpdateImage: (updates: Partial<ImageState>) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  onImport: (files: FileList) => void;
  onApplyToAll: (type: 'WATERMARK' | 'ADJUST') => void;
  onBatchDownloadRequest: () => void;
  onDownloadRequest: () => void; 
  totalImages: number;
  isBatchMode?: boolean;
  setIsBatchMode?: (val: boolean) => void;
}

const FONTS = [
    { name: 'Modern Sans', value: "'Montserrat', sans-serif" },
    { name: 'Standard', value: "'Inter', sans-serif" },
    { name: 'Luxury Serif', value: "'Playfair Display', serif" },
    { name: 'Cinematic', value: "'Cinzel', serif" },
    { name: 'Bold Display', value: "'Bebas Neue', sans-serif" },
    { name: 'Handwritten', value: "'Dancing Script', cursive" },
];

const STYLE_PRESETS = [
    { 
        name: 'Official Seal', 
        fontFamily: "'Playfair Display', serif", 
        color: '#DC2626', // Red
        opacity: 95, 
        shadowBlur: 2, 
        letterSpacing: 2, 
        fontWeight: '700',
        size: 32,
        shape: 'DOUBLE_CIRCLE' as const,
        borderColor: '#DC2626',
        borderWidth: 4,
        padding: 40
    },
    { 
        name: 'Modern Box', 
        fontFamily: "'Montserrat', sans-serif", 
        color: '#FFFFFF', 
        opacity: 100, 
        shadowBlur: 0, 
        letterSpacing: 4, 
        fontWeight: '700',
        size: 24,
        shape: 'SQUARE' as const,
        borderColor: '#FFFFFF',
        borderWidth: 2,
        padding: 20
    },
    { 
        name: 'Minimal', 
        fontFamily: "'Montserrat', sans-serif", 
        color: '#ffffff', 
        opacity: 90, 
        shadowBlur: 0, 
        letterSpacing: 2, 
        fontWeight: '400',
        size: 24,
        shape: 'NONE' as const
    },
    { 
        name: 'Luxury', 
        fontFamily: "'Playfair Display', serif", 
        color: '#FCD34D', // Gold-ish
        opacity: 100, 
        shadowBlur: 10, 
        shadowColor: 'rgba(0,0,0,0.5)',
        letterSpacing: 1, 
        fontWeight: '700',
        size: 32,
        shape: 'NONE' as const
    },
    { 
        name: 'Badge', 
        fontFamily: "'Bebas Neue', sans-serif", 
        color: '#ffffff', 
        opacity: 100, 
        shadowBlur: 5, 
        shadowColor: 'rgba(0,0,0,0.8)',
        letterSpacing: 2, 
        fontWeight: '400',
        size: 28,
        shape: 'ROUNDED' as const,
        borderColor: '#ffffff',
        borderWidth: 3,
        padding: 15
    },
];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  activeTool,
  imageState,
  onUpdateImage,
  isProcessing,
  setIsProcessing,
  onImport,
  onApplyToAll,
  onBatchDownloadRequest,
  onDownloadRequest,
  totalImages,
  isBatchMode = false,
  setIsBatchMode = () => {}
}) => {
  const [aiTextPrompt, setAiTextPrompt] = useState('');
  const [detectionResult, setDetectionResult] = useState<any>(null);
  const [targetDescription, setTargetDescription] = useState('watermark or logo');

  // Helper to burn mask onto image for AI
  const prepareMaskedImage = async (base64Img: string, maskPaths: any[]): Promise<string> => {
      return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  // Draw Original Image
                  ctx.drawImage(img, 0, 0);
                  
                  // Draw Red Mask
                  ctx.lineCap = 'round';
                  ctx.lineJoin = 'round';
                  
                  maskPaths.forEach(path => {
                      ctx.beginPath();
                      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; // Strong Red for AI to see
                      // Use a base relative size, assuming canvas width ~1000px equivalent visual feel
                      const scaleFactor = img.width / 100;
                      ctx.lineWidth = (path.size || 5) * scaleFactor;
                      
                      if (path.points.length > 0) {
                          ctx.moveTo(path.points[0].x / 100 * img.width, path.points[0].y / 100 * img.height);
                          for (let i = 1; i < path.points.length; i++) {
                              ctx.lineTo(path.points[i].x / 100 * img.width, path.points[i].y / 100 * img.height);
                          }
                      }
                      ctx.stroke();
                  });
                  
                  resolve(canvas.toDataURL('image/jpeg', 0.9));
              }
          };
          img.src = base64Img;
      });
  };

  const BatchToggle = () => {
    if (totalImages <= 1) return null;
    return (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
                {isBatchMode ? <Link2 className="w-4 h-4 text-blue-400" /> : <Link2Off className="w-4 h-4 text-gray-500" />}
                <div className="flex flex-col">
                    <span className={`text-sm font-medium ${isBatchMode ? 'text-blue-100' : 'text-gray-400'}`}>
                        Sync All Changes
                    </span>
                    <span className="text-[10px] text-gray-500">
                        {isBatchMode ? 'Edits affect all images' : 'Editing current image only'}
                    </span>
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={isBatchMode} 
                    onChange={(e) => setIsBatchMode(e.target.checked)} 
                    className="sr-only peer" 
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
        </div>
    );
  };

  if (activeTool === ToolType.IMPORT) {
    return (
      <div className="w-80 bg-panel border-l border-border p-6 flex flex-col h-full overflow-y-auto">
        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
          <ImagePlus className="w-5 h-5 text-blue-500" /> Import
        </h2>
        <div className="border-2 border-dashed border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-gray-800 transition-all cursor-pointer relative">
            <input 
                type="file" 
                accept="image/*" 
                multiple
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => {
                    if(e.target.files && e.target.files.length > 0) onImport(e.target.files);
                }}
            />
            <div className="p-4 bg-gray-700 rounded-full mb-4">
                <ImagePlus className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-200 mb-1">Click or Drag Images</h3>
            <p className="text-xs text-gray-500">Batch upload supported (JPG, PNG, WebP)</p>
        </div>
        {totalImages > 0 && (
             <div className="mt-6 p-4 bg-gray-800 rounded-lg flex items-center gap-3">
                 <Layers className="text-gray-400 w-5 h-5" />
                 <div>
                     <p className="text-sm text-gray-200 font-medium">{totalImages} images loaded</p>
                     <p className="text-xs text-gray-500">Go to "Magic Wand" next</p>
                 </div>
             </div>
        )}
      </div>
    );
  }

  if (!imageState) return <div className="w-80 bg-panel border-l border-border"></div>;

  // --- REMOVE / MAGIC WAND TOOL ---
  if (activeTool === ToolType.REMOVE) {
    const hasMask = imageState.maskPaths && imageState.maskPaths.length > 0;

    const handleDetect = async () => {
      setIsProcessing(true);
      try {
        const base64 = imageState.originalUrl.split(',')[1];
        const res = await detectWatermarkAI(base64);
        const data = JSON.parse(res);
        setDetectionResult(data);
        if (data.description) {
            setTargetDescription(data.description);
        }
        onUpdateImage({ aiAnalysis: res });
      } catch (e) {
        alert('Detection failed. Please check API Key.');
      }
      setIsProcessing(false);
    };

    const handleRemove = async () => {
      setIsProcessing(true);
      try {
        const currentImage = imageState.processedUrl || imageState.originalUrl;
        
        let imageToSend = currentImage.split(',')[1];
        let description = targetDescription || detectionResult?.description || "watermark";
        let masked = false;

        if (hasMask) {
            const maskedDataUrl = await prepareMaskedImage(currentImage, imageState.maskPaths);
            imageToSend = maskedDataUrl.split(',')[1];
            masked = true;
        }

        const newImage = await removeWatermarkAI(imageToSend, description, masked);
        onUpdateImage({ processedUrl: newImage, maskPaths: [] });
      } catch (e) {
        alert('Removal failed. Please check API Key.');
      }
      setIsProcessing(false);
    };

    return (
      <div className="w-80 bg-panel border-l border-border p-6 flex flex-col h-full overflow-y-auto">
        <h2 className="text-lg font-bold mb-6 text-white flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-blue-500" /> Repair & Clean
        </h2>
        
        <div className="bg-blue-900/20 border border-blue-800 p-3 rounded-lg mb-6">
            <h3 className="text-xs font-bold text-blue-400 uppercase mb-1">Step 1: Clean Image</h3>
            <p className="text-xs text-blue-100">Remove logos or defects first. Then add your own watermark.</p>
        </div>
        
        <div className="space-y-6">
            <div className="p-4 bg-gray-800 rounded-lg space-y-3 border border-gray-700">
                <h3 className="text-sm font-medium text-gray-300 flex justify-between">
                    <span>Manual Eraser</span>
                    <span className="text-[10px] bg-gray-700 px-2 py-0.5 rounded text-gray-400">Brush Mode On</span>
                </h3>
                <p className="text-xs text-gray-500">Paint red over the area to remove.</p>
                
                {hasMask && (
                    <div className="flex justify-between items-center bg-gray-900 p-2 rounded">
                        <span className="text-xs text-red-400">{imageState.maskPaths.length} strokes</span>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onUpdateImage({ maskPaths: [] })}
                            className="text-xs h-6"
                        >
                            <Undo2 className="w-3 h-3 mr-1" /> Clear
                        </Button>
                    </div>
                )}
            </div>

            <div className="p-4 bg-gray-800 rounded-lg space-y-3">
                <h3 className="text-sm font-medium text-gray-300">Auto Detect (Optional)</h3>
                <Button 
                    onClick={handleDetect} 
                    isLoading={isProcessing && !detectionResult} 
                    disabled={isProcessing} 
                    className="w-full"
                    variant="secondary"
                    size="sm"
                >
                    <Sparkles className="w-3 h-3 mr-2" />
                    Find Logos
                </Button>
                
                {detectionResult && (
                    <div className="bg-gray-900 p-3 rounded text-xs space-y-2 mt-2 border border-gray-700">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Found:</span>
                            <span className="text-blue-400 font-semibold">{detectionResult.description || 'Unknown'}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="pt-4 border-t border-gray-700">
                 {!hasMask && (
                     <div className="mb-3">
                        <label className="text-xs text-gray-400 mb-1 block">Or describe target:</label>
                        <input 
                            type="text" 
                            value={targetDescription} 
                            onChange={(e) => setTargetDescription(e.target.value)}
                            placeholder="e.g. Red Logo"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none"
                        />
                     </div>
                 )}

                <Button 
                    onClick={handleRemove} 
                    isLoading={isProcessing} 
                    disabled={isProcessing || (!hasMask && !targetDescription)} 
                    className="w-full"
                    variant="primary"
                >
                    <Eraser className="w-4 h-4 mr-2" />
                    {hasMask ? 'Erase Red Area' : 'Auto Erase'} & HD Repair
                </Button>
            </div>
        </div>
      </div>
    );
  }

  // --- WATERMARK TOOL ---
  if (activeTool === ToolType.WATERMARK) {
    const w = imageState.watermark;
    const updateW = (patch: Partial<typeof w>) => onUpdateImage({ watermark: { ...w, ...patch } });

    const handleAIText = async () => {
        if (!aiTextPrompt) return;
        setIsProcessing(true);
        const suggestions = await generateWatermarkTextAI(aiTextPrompt);
        if (suggestions.length > 0) updateW({ text: suggestions[0] });
        setIsProcessing(false);
    };

    const handleAutoDesign = async () => {
        if (!w.text) return;
        setIsProcessing(true);
        const style = await suggestLogoStyleAI(w.text);
        if (style) {
             const updates: any = {};
             if (style.shape) updates.shape = style.shape;
             if (style.color) updates.color = style.color;
             if (style.borderColor) updates.borderColor = style.borderColor;
             if (style.borderWidth) updates.borderWidth = style.borderWidth;
             if (style.fontFamily) updates.fontFamily = style.fontFamily;
             if (style.fontWeight) updates.fontWeight = style.fontWeight;
             if (style.letterSpacing) updates.letterSpacing = style.letterSpacing;
             
             if (style.shape === 'DOUBLE_CIRCLE' || style.shape === 'CIRCLE') {
                 updates.padding = 40;
             }
             
             updateW(updates);
        }
        setIsProcessing(false);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    updateW({ 
                        type: WatermarkType.IMAGE, 
                        imageUrl: ev.target.result as string 
                    });
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleRemoveBg = async () => {
        if (!w.imageUrl) return;
        setIsProcessing(true);
        try {
            const base64 = w.imageUrl.split(',')[1];
            const newImage = await removeBackgroundAI(base64);
            updateW({ imageUrl: newImage });
        } catch (error) {
            alert('Failed to remove background.');
        }
        setIsProcessing(false);
    };

    return (
      <div className="w-80 bg-panel border-l border-border p-6 flex flex-col h-full overflow-y-auto">
        <h2 className="text-lg font-bold mb-6 text-white flex items-center gap-2">
            <Type className="w-5 h-5 text-blue-500" /> Watermark & Seals
        </h2>

        {/* Sync/Batch Toggle */}
        <BatchToggle />

        {/* MODE TOGGLE */}
        <div className="mb-6 bg-gray-800 p-1 rounded-lg flex border border-gray-700">
             <button 
                onClick={() => updateW({ type: WatermarkType.TEXT })}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded transition-all ${w.type === WatermarkType.TEXT ? 'bg-blue-600 text-white font-medium shadow' : 'text-gray-400 hover:text-white'}`}
             >
                <Type className="w-3 h-3" /> Text Logo
             </button>
             <button 
                onClick={() => updateW({ type: WatermarkType.IMAGE })}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded transition-all ${w.type === WatermarkType.IMAGE ? 'bg-blue-600 text-white font-medium shadow' : 'text-gray-400 hover:text-white'}`}
             >
                <ImagePlus className="w-3 h-3" /> Image Logo
             </button>
        </div>

        {/* ==================== TEXT MODE ==================== */}
        {w.type === WatermarkType.TEXT && (
            <>
                {/* Style Gallery Presets */}
                <div className="mb-6">
                    <label className="text-xs font-bold text-gray-400 mb-3 block uppercase tracking-wider">Quick Styles</label>
                    <div className="grid grid-cols-2 gap-2">
                        {STYLE_PRESETS.map(preset => (
                            <button
                                key={preset.name}
                                onClick={() => updateW({ ...preset, type: WatermarkType.TEXT })}
                                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 rounded-lg p-2 text-center transition-all group relative overflow-hidden"
                            >
                                <span className="text-sm relative z-10" style={{ fontFamily: preset.fontFamily, fontWeight: preset.fontWeight, color: preset.color }}>
                                    {preset.name}
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Input */}
                <div className="mb-6 space-y-3">
                    <div>
                        <label className="text-xs text-gray-400 mb-1 block flex justify-between">
                            <span>Logo Text</span>
                            <span className="text-[10px] text-blue-400 cursor-pointer hover:underline" onClick={handleAIText}>AI Text Suggest</span>
                        </label>
                        <div className="flex gap-2 items-start">
                            <div className="relative flex-1">
                                <textarea 
                                    value={w.text} 
                                    onChange={(e) => updateW({ text: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none resize-none transition-colors"
                                    rows={2}
                                    placeholder="Enter text..."
                                />
                                {w.text.length === 0 && (
                                    <div className="absolute bottom-2 right-2 flex items-center gap-1">
                                        <input 
                                            value={aiTextPrompt}
                                            onChange={(e) => setAiTextPrompt(e.target.value)}
                                            placeholder="Topic?"
                                            className="w-16 bg-gray-900/80 border border-gray-600 rounded text-[10px] px-1 py-0.5 text-white"
                                        />
                                        <Button size="sm" variant="ghost" className="!p-0.5 h-5 w-5 rounded-full bg-blue-600 text-white" onClick={handleAIText} disabled={!aiTextPrompt}>
                                            <Sparkles className="w-3 h-3" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                            
                            <button 
                                onClick={handleAutoDesign}
                                disabled={isProcessing || !w.text}
                                className="h-full px-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 flex flex-col items-center justify-center gap-1"
                                title="Auto-Design Logo Style based on Text"
                            >
                                <Sparkles className="w-4 h-4" />
                                AI Style
                            </button>
                        </div>
                    </div>
                </div>

                {/* Shape Controls */}
                <div className="space-y-5 border-t border-gray-700 pt-5">
                    <div>
                        <label className="text-xs text-gray-400 mb-2 block font-medium flex items-center gap-2">
                            <Stamp className="w-3 h-3" /> Shape / Seal
                        </label>
                        <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                            {[
                                { id: 'NONE', icon: MessageSquare, title: 'Text Only' },
                                { id: 'CIRCLE', icon: Circle, title: 'Circle' },
                                { id: 'SQUARE', icon: Square, title: 'Box' },
                                { id: 'ROUNDED', icon: BoxSelect, title: 'Badge' }
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => updateW({ shape: opt.id as any })}
                                    title={opt.title}
                                    className={`flex-1 p-2 rounded flex justify-center ${w.shape === opt.id ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                >
                                    <opt.icon className="w-4 h-4" />
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {w.shape !== 'NONE' && (
                        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Border Color</label>
                                <input 
                                    type="color" 
                                    value={w.borderColor}
                                    onChange={(e) => updateW({ borderColor: e.target.value })}
                                    className="h-5 w-6 rounded cursor-pointer bg-transparent border-none"
                                />
                            </div>
                            <Slider label="Border Width" value={w.borderWidth} min={0} max={10} unit="px" onChange={(v) => updateW({ borderWidth: v })} />
                            <Slider label="Padding" value={w.padding || 20} min={0} max={100} unit="px" onChange={(v) => updateW({ padding: v })} />
                        </div>
                    )}

                    {/* Typography */}
                    <div>
                        <label className="text-xs text-gray-400 mb-2 block font-medium">Typography</label>
                        <div className="grid grid-cols-1 gap-2">
                            <select 
                                value={w.fontFamily} 
                                onChange={(e) => updateW({ fontFamily: e.target.value })}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg h-9 px-2 text-xs text-white focus:border-blue-500 outline-none"
                            >
                                {FONTS.map(f => (
                                    <option key={f.name} value={f.value}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Text Color</label>
                            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg p-1">
                                <input 
                                    type="color" 
                                    value={w.color}
                                    onChange={(e) => updateW({ color: e.target.value })}
                                    className="h-6 w-8 rounded cursor-pointer bg-transparent border-none"
                                />
                                <span className="text-xs font-mono text-gray-400">{w.color.toUpperCase()}</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Weight</label>
                            <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                                <button 
                                    onClick={() => updateW({ fontWeight: '400' })}
                                    className={`flex-1 text-xs py-1 rounded ${w.fontWeight === '400' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
                                >Reg</button>
                                <button 
                                    onClick={() => updateW({ fontWeight: '700' })}
                                    className={`flex-1 text-xs py-1 rounded ${w.fontWeight === '700' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
                                >Bold</button>
                            </div>
                        </div>
                    </div>

                    <Slider label="Letter Spacing" value={w.letterSpacing} min={-2} max={20} unit="px" onChange={(v) => updateW({ letterSpacing: v })} />
                </div>
            </>
        )}

        {/* ==================== IMAGE MODE ==================== */}
        {w.type === WatermarkType.IMAGE && (
            <div className="mb-6 space-y-4">
                <div className="p-4 border-2 border-dashed border-gray-700 rounded-xl hover:border-blue-500 hover:bg-gray-800 transition-all flex flex-col items-center justify-center relative cursor-pointer group">
                     {w.imageUrl ? (
                         <img src={w.imageUrl} alt="logo preview" className="h-20 object-contain mb-2" />
                     ) : (
                         <div className="p-3 bg-gray-700 rounded-full mb-2 group-hover:bg-gray-600">
                             <ImagePlus className="w-5 h-5 text-gray-300" />
                         </div>
                     )}
                     <span className="text-xs text-gray-400 font-medium">
                         {w.imageUrl ? 'Click to Change Image' : 'Click to Upload Logo'}
                     </span>
                     <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>

                {w.imageUrl && (
                    <Button 
                        onClick={handleRemoveBg}
                        isLoading={isProcessing}
                        disabled={isProcessing}
                        variant="secondary"
                        className="w-full flex items-center justify-center gap-2"
                        size="sm"
                    >
                        <Scissors className="w-4 h-4 text-blue-400" /> AI Remove Background
                    </Button>
                )}
            </div>
        )}

        {/* ==================== SHARED CONTROLS (Size, Opacity, etc.) ==================== */}
        <div className="space-y-5 border-t border-gray-700 pt-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Appearance</h3>
            
            <Slider label="Opacity" value={w.opacity} min={0} max={100} unit="%" onChange={(v) => updateW({ opacity: v })} />
            <Slider label="Size" value={w.size} min={10} max={150} unit="px" onChange={(v) => updateW({ size: v })} />
            <Slider label="Rotation" value={w.rotation} min={-180} max={180} unit="°" onChange={(v) => updateW({ rotation: v })} />
            
            <div className="pt-4 border-t border-gray-700">
                 <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Grid className="w-4 h-4" /> Tiling Mode
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={w.isTiled} onChange={(e) => updateW({ isTiled: e.target.checked })} className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                 </div>
                 {w.isTiled && (
                     <Slider label="Density" value={w.tileDensity} min={1} max={5} onChange={(v) => updateW({ tileDensity: v })} />
                 )}
            </div>

            {totalImages > 1 && !isBatchMode && (
                <div className="pt-4 border-t border-gray-700">
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="w-full flex items-center gap-2 justify-center"
                        onClick={() => onApplyToAll('WATERMARK')}
                    >
                        <Copy className="w-4 h-4" /> Apply to All Images (Sync Pos)
                    </Button>
                </div>
            )}
        </div>
      </div>
    );
  }

  // --- ADJUST TOOL ---
  if (activeTool === ToolType.ADJUST) {
    const a = imageState.adjustments;
    const updateA = (patch: Partial<typeof a>) => onUpdateImage({ adjustments: { ...a, ...patch } });

    return (
        <div className="w-80 bg-panel border-l border-border p-6 flex flex-col h-full overflow-y-auto">
             <h2 className="text-lg font-bold mb-6 text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-500" /> Adjustments
            </h2>
            
            <BatchToggle />

            <div className="space-y-6">
                <Slider label="Brightness" value={a.brightness} min={0} max={200} onChange={(v) => updateA({ brightness: v })} />
                <Slider label="Contrast" value={a.contrast} min={0} max={200} onChange={(v) => updateA({ contrast: v })} />
                <Slider label="Saturation" value={a.saturation} min={0} max={200} onChange={(v) => updateA({ saturation: v })} />
                <Slider label="Blur" value={a.blur} min={0} max={10} unit="px" onChange={(v) => updateA({ blur: v })} />
                <Slider label="Sepia" value={a.sepia} min={0} max={100} unit="%" onChange={(v) => updateA({ sepia: v })} />

                {totalImages > 1 && !isBatchMode && (
                    <div className="pt-4 border-t border-gray-700">
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            className="w-full flex items-center gap-2 justify-center"
                            onClick={() => onApplyToAll('ADJUST')}
                        >
                            <Copy className="w-4 h-4" /> Copy to All Images
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
  }

  // --- EXPORT TOOL ---
  if (activeTool === ToolType.EXPORT) {
    return (
        <div className="w-80 bg-panel border-l border-border p-6 flex flex-col h-full overflow-y-auto">
             <h2 className="text-lg font-bold mb-6 text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-500" /> Export
            </h2>
            <div className="p-4 bg-gray-800 rounded-lg mb-4">
                <div className="flex justify-between text-sm text-gray-300 mb-2">
                    <span>Format</span>
                    <span className="font-mono text-gray-400">JPG</span>
                </div>
                <div className="flex justify-between text-sm text-gray-300 mb-2">
                    <span>Quality</span>
                    <span className="font-mono text-gray-400">High (Recommended)</span>
                </div>
            </div>
            
            <div className="space-y-3">
                <Button variant="primary" size="lg" className="w-full" onClick={onDownloadRequest}>
                    Save to Device
                </Button>
                
                {totalImages > 1 && (
                    <Button 
                        variant="secondary" 
                        size="lg" 
                        className="w-full flex items-center gap-2 justify-center" 
                        onClick={onBatchDownloadRequest}
                    >
                        <Layers className="w-4 h-4" /> Download All ({totalImages})
                    </Button>
                )}
            </div>
        </div>
    );
  }

  return null;
};