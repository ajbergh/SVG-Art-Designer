import React from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { sanitizeSvg } from '../utils/svgSanitizer';

export interface Variation {
  id: number;
  svg: string | null;
  loading: boolean;
  error: string | null;
}

interface VariationsGridProps {
  variations: Variation[];
  onSelect: (svg: string) => void;
  onClose: () => void;
}

const VariationsGrid: React.FC<VariationsGridProps> = ({ variations, onSelect, onClose }) => {
  const completedCount = variations.filter(v => v.svg).length;
  const totalCount = variations.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col m-4" role="dialog" aria-modal="true" aria-labelledby="variations-title" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-white" id="variations-title">Variations</h2>
            <p className="text-xs text-gray-400 mt-0.5">{completedCount}/{totalCount} generated</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors" aria-label="Close variations">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grid */}
        <div className="p-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            {variations.map((v) => (
              <div
                key={v.id}
                className={`relative aspect-square border rounded-xl overflow-hidden transition-all ${
                  v.svg
                    ? 'border-gray-700 hover:border-indigo-500 cursor-pointer group'
                    : v.error
                    ? 'border-red-500/30 bg-red-900/10'
                    : 'border-gray-800 bg-gray-800/30'
                }`}
                onClick={() => v.svg && onSelect(v.svg)}
              >
                {v.loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  </div>
                )}
                {v.error && (
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <p className="text-red-400 text-xs text-center">{v.error}</p>
                  </div>
                )}
                {v.svg && (
                  <>
                    <div
                      className="w-full h-full flex items-center justify-center p-4"
                      dangerouslySetInnerHTML={{ __html: sanitizeSvg(v.svg) }}
                    />
                    <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> Use This
                      </div>
                    </div>
                  </>
                )}
                <div className="absolute bottom-2 right-2 text-xs text-gray-600 font-mono">#{v.id}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VariationsGrid;
