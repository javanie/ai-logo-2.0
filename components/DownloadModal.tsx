import React from 'react';
import { Button } from './Button';
import { Download, X, Sparkles, Image as ImageIcon, Layers } from 'lucide-react';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewUrl: string | null;
  onDownloadWatermarked: () => void;
  onDownloadClean: () => void;
  fileName: string;
  count?: number;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
  previewUrl,
  onDownloadWatermarked,
  onDownloadClean,
  fileName,
  count = 1
}) => {
  if (!isOpen) return null;

  const isBatch = count > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            {isBatch ? <Layers className="w-5 h-5 text-blue-500" /> : <Download className="w-5 h-5 text-blue-500" />}
            {isBatch ? `Export ${count} Images` : 'Export Image'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6">
          
          {/* Preview Section */}
          <div className="relative aspect-video bg-black/50 rounded-lg overflow-hidden border border-gray-800 flex items-center justify-center group">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="animate-pulse w-full h-full bg-gray-800" />
            )}
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm">
              {isBatch ? 'Preview (First Image)' : 'Preview (With Logo)'}
            </div>
          </div>

          <div className="space-y-3">
             {/* Primary Option: With Logo */}
            <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-4 hover:bg-blue-900/30 transition-colors">
                 <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-600 rounded-lg">
                             <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-white">{isBatch ? 'Download All with Design' : 'Download with Design'}</h4>
                            <p className="text-xs text-blue-200">Includes watermark/logo on {isBatch ? 'all images' : 'image'}.</p>
                        </div>
                     </div>
                 </div>
                 <Button onClick={onDownloadWatermarked} className="w-full" size="md">
                    {isBatch ? `Download All (${count})` : 'Download Final Image'}
                 </Button>
            </div>

            {/* Secondary Option: Clean */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:bg-gray-800 transition-colors">
                 <div className="flex items-center justify-between mb-3">
                     <div className="flex items-center gap-2">
                        <div className="p-2 bg-gray-700 rounded-lg">
                             <ImageIcon className="w-4 h-4 text-gray-300" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-200">{isBatch ? 'Download All Clean' : 'Download Clean Image'}</h4>
                            <p className="text-xs text-gray-500">No logos, just the repaired {isBatch ? 'images' : 'image'}.</p>
                        </div>
                     </div>
                 </div>
                 <Button onClick={onDownloadClean} variant="secondary" className="w-full" size="md">
                    {isBatch ? `Download Clean (${count})` : 'Download Clean (No Logo)'}
                 </Button>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-950 text-center border-t border-gray-800">
            <p className="text-[10px] text-gray-500">File: {fileName} {isBatch && `(+${count - 1} others)`}</p>
        </div>
      </div>
    </div>
  );
};