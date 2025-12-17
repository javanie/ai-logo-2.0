import React from 'react';
import { ToolType } from '../types';
import { Image as ImageIcon, Wand2, Type, SlidersHorizontal, Download, Layers } from 'lucide-react';

interface SidebarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  hasImage: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTool, onSelectTool, hasImage }) => {
  const tools = [
    { id: ToolType.IMPORT, icon: Layers, label: 'Import', disabled: false },
    { id: ToolType.REMOVE, icon: Wand2, label: 'Magic Wand', disabled: !hasImage },
    { id: ToolType.WATERMARK, icon: Type, label: 'Watermark', disabled: !hasImage },
    { id: ToolType.ADJUST, icon: SlidersHorizontal, label: 'Adjust', disabled: !hasImage },
    { id: ToolType.EXPORT, icon: Download, label: 'Export', disabled: !hasImage },
  ];

  return (
    <div className="w-20 bg-darker border-r border-border flex flex-col items-center py-6 z-20">
      <div className="mb-8 p-2 bg-blue-600/20 rounded-xl">
         <ImageIcon className="w-8 h-8 text-blue-500" />
      </div>
      
      <nav className="flex flex-col gap-4 w-full px-2">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => !tool.disabled && onSelectTool(tool.id)}
            disabled={tool.disabled}
            className={`
              flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 group
              ${activeTool === tool.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                : tool.disabled 
                  ? 'opacity-30 cursor-not-allowed text-gray-500' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }
            `}
          >
            <tool.icon className={`w-6 h-6 mb-1 ${activeTool === tool.id ? 'stroke-2' : 'stroke-1.5'}`} />
            <span className="text-[10px] font-medium tracking-wide">{tool.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 opacity-50 blur-sm"></div>
      </div>
    </div>
  );
};