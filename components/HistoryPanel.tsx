import React, { useState, useMemo } from 'react';
import { History, Trash2, Clock, Zap, BrainCircuit, Layers as LayersIcon, Play, Search, X } from 'lucide-react';
import { sanitizeSvg } from '../utils/svgSanitizer';
import { ArtStyle } from '../types';

interface HistoryItem {
  id?: number;
  prompt: string;
  style: ArtStyle;
  svg: string;
  timestamp: number;
  model: string;
  layersEnabled?: boolean;
  animationEnabled?: boolean;
}

interface HistoryPanelProps {
  history: HistoryItem[];
  currentSvg: string | null;
  onLoad: (item: HistoryItem) => void;
  onClear: () => void;
  onCopyPrompt: (e: React.MouseEvent, prompt: string) => void;
}

function getDateGroup(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekAgo) return 'This Week';
  return 'Older';
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, currentSvg, onLoad, onClear, onCopyPrompt }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [styleFilter, setStyleFilter] = useState('');

  const filteredHistory = useMemo(() => {
    let items = history;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => item.prompt.toLowerCase().includes(q));
    }
    if (styleFilter) {
      items = items.filter(item => item.style === styleFilter);
    }
    return items;
  }, [history, searchQuery, styleFilter]);

  const groupedHistory = useMemo(() => {
    const groups: Record<string, HistoryItem[]> = {};
    for (const item of filteredHistory) {
      const group = getDateGroup(item.timestamp);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    }
    return groups;
  }, [filteredHistory]);

  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'];

  return (
    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4" />
          Session History
        </h3>
        {history.length > 0 && (
          <button onClick={onClear} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Search & Filter */}
      {history.length > 0 && (
        <div className="space-y-2 mb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800/50 text-gray-200 text-xs pl-8 pr-7 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-600 placeholder-gray-600"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            value={styleFilter}
            onChange={(e) => setStyleFilter(e.target.value)}
            className="w-full bg-gray-800/50 text-gray-300 text-xs px-2.5 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-gray-600"
          >
            <option value="">All Styles</option>
            {Object.values(ArtStyle).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      {/* History List */}
      <div className="space-y-3 flex-1 overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm italic">{history.length === 0 ? 'No designs yet.' : 'No matching designs.'}</p>
          </div>
        ) : (
          groupOrder.map(groupName => {
            const items = groupedHistory[groupName];
            if (!items || items.length === 0) return null;
            return (
              <div key={groupName}>
                <h4 className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-1.5 px-1">{groupName}</h4>
                <div className="space-y-2">
                  {items.map((item) => (
                    <button
                      key={item.id ?? item.timestamp}
                      onClick={() => onLoad(item)}
                      onContextMenu={(e) => onCopyPrompt(e, item.prompt)}
                      title="Right-click to copy prompt"
                      className={`w-full text-left group p-3 rounded-lg border transition-all duration-200
                        ${currentSvg === item.svg
                          ? 'bg-gray-800 border-indigo-500/50 ring-1 ring-indigo-500/20'
                          : 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-800 hover:border-gray-600'
                        }
                      `}
                    >
                      <div className="flex gap-3">
                        {/* SVG Thumbnail */}
                        <div className="w-12 h-12 flex-shrink-0 overflow-hidden rounded border border-gray-700 bg-gray-900 relative">
                          <div
                            className="absolute inset-0 pointer-events-none flex items-center justify-center"
                            dangerouslySetInnerHTML={{ __html: sanitizeSvg(
                              item.svg.replace(/<svg([^>]*)>/, (_, attrs) => {
                                // Force thumbnail sizing
                                const cleaned = attrs.replace(/width=["'][^"']*["']/g, '').replace(/height=["'][^"']*["']/g, '');
                                return `<svg${cleaned} width="48" height="48">`;
                              })
                            )}}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              currentSvg === item.svg ? 'bg-indigo-900/50 text-indigo-300' : 'bg-gray-700 text-gray-400'
                            }`}>
                              {item.style}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {item.layersEnabled && (
                                <span title="Smart Layers On">
                                  <LayersIcon className="w-3 h-3 text-gray-500" />
                                </span>
                              )}
                              {item.animationEnabled && (
                                <span title="Animation On">
                                  <Play className="w-3 h-3 text-gray-500" />
                                </span>
                              )}
                              <span className="flex items-center gap-1 text-[10px] text-gray-600">
                                {item.model?.includes('pro') ? <BrainCircuit className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                                {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                          </div>
                          <p className="text-gray-300 text-xs line-clamp-2 leading-relaxed group-hover:text-white">
                            "{item.prompt}"
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HistoryPanel;
