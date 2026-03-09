import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Layers, ArrowUp, ArrowDown, Folder, FolderOpen, Trash2, BoxSelect } from 'lucide-react';
import { Layer } from '../types';
import { parseLayers } from '../utils/svgLayerUtils';

interface LayerPanelProps {
  svgContent: string | null;
  onUpdate: (newSvg: string) => void;
  onToggleVisibility: (index: number) => void;
  onReorder: (index: number, direction: 'up' | 'down') => void;
  onGroup: (indices: number[]) => void;
  onUngroup: (index: number) => void;
  onDelete: (index: number) => void;
}

const LayerPanel: React.FC<LayerPanelProps> = ({ 
    svgContent, 
    onToggleVisibility, 
    onReorder,
    onGroup,
    onUngroup,
    onDelete
}) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  // Parse layers whenever SVG content changes
  const layers = useMemo(() => parseLayers(svgContent || ''), [svgContent]);

  if (!svgContent) {
      return (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 p-6 text-center">
              <Layers className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">Generate a design to view layers</p>
          </div>
      );
  }

  const toggleSelection = (index: number, multi: boolean) => {
      if (multi) {
          setSelectedIndices(prev => 
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
          );
      } else {
          setSelectedIndices(prev => prev.includes(index) && prev.length === 1 ? [] : [index]);
      }
  };

  const handleGroup = () => {
      if (selectedIndices.length < 2) return;
      onGroup(selectedIndices);
      setSelectedIndices([]);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white select-none">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" /> Layers
            </h3>
            <span className="text-xs text-gray-500">{layers.length} items</span>
        </div>

        {/* Toolbar */}
        <div className="p-2 border-b border-gray-800 flex gap-1 justify-end bg-gray-900/50">
             <button 
                onClick={handleGroup}
                disabled={selectedIndices.length < 2}
                className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent text-gray-300 transition-colors"
                title="Group Selected"
            >
                <Folder className="w-4 h-4" />
            </button>
            <button 
                onClick={() => selectedIndices.length === 1 && onDelete(selectedIndices[0])}
                disabled={selectedIndices.length !== 1}
                className="p-1.5 rounded hover:bg-red-900/30 hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent text-gray-300 transition-colors"
                title="Delete Layer"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>

        {/* Layer List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {layers.map((layer, idx) => {
                const isSelected = selectedIndices.includes(idx);
                return (
                    <div 
                        key={layer.id}
                        onClick={(e) => toggleSelection(idx, e.shiftKey || e.metaKey || e.ctrlKey)}
                        className={`
                            flex items-center gap-3 p-2 rounded-md text-sm border cursor-pointer group transition-all
                            ${isSelected 
                                ? 'bg-indigo-900/40 border-indigo-500/50' 
                                : 'bg-gray-800/20 border-transparent hover:bg-gray-800'
                            }
                            ${!layer.visible ? 'opacity-60 grayscale' : ''}
                        `}
                    >
                        {/* Visibility Toggle */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); onToggleVisibility(idx); }}
                            className="text-gray-500 hover:text-white transition-colors"
                        >
                            {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>

                        {/* Icon based on type */}
                        <div className="text-gray-400">
                            {layer.type === 'g' ? <FolderOpen className="w-4 h-4 text-yellow-500/80" /> : <BoxSelect className="w-4 h-4" />}
                        </div>

                        {/* Name */}
                        <span className="flex-1 truncate font-mono text-xs text-gray-300">
                            {layer.name}
                        </span>

                        {/* Quick Actions (Hover only) */}
                        <div className={`flex items-center gap-1 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                             {layer.type === 'g' && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onUngroup(idx); }}
                                    className="p-1 hover:bg-gray-700 rounded text-gray-400"
                                    title="Ungroup"
                                >
                                    <BoxSelect className="w-3 h-3" />
                                </button>
                             )}
                            <button 
                                onClick={(e) => { e.stopPropagation(); onReorder(idx, 'up'); }}
                                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-30"
                                disabled={idx === 0}
                                title="Move Up"
                            >
                                <ArrowUp className="w-3 h-3" />
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onReorder(idx, 'down'); }}
                                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-30"
                                disabled={idx === layers.length - 1}
                                title="Move Down"
                            >
                                <ArrowDown className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default LayerPanel;
