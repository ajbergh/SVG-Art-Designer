import React, { useState } from 'react';
import { X, Download, Copy, Check, FileCode, Image as ImageIcon, FileText, Code2 } from 'lucide-react';
import { ExportFormat, ExportOptions, exportSvgAs, downloadBlob } from '../utils/svgExporter';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  svgContent: string;
  onNotification: (message: string) => void;
}

const formats: { id: ExportFormat; label: string; description: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'svg', label: 'SVG', description: 'Vector format, scalable', Icon: FileCode },
  { id: 'png', label: 'PNG', description: 'Lossless raster, transparent', Icon: ImageIcon },
  { id: 'jpeg', label: 'JPEG', description: 'Compressed raster', Icon: ImageIcon },
  { id: 'webp', label: 'WebP', description: 'Modern compressed raster', Icon: ImageIcon },
  { id: 'base64', label: 'Base64', description: 'Encoded SVG string', Icon: FileText },
  { id: 'react', label: 'React', description: 'TSX component', Icon: Code2 },
];

const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, onClose, svgContent, onNotification }) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('svg');
  const [scale, setScale] = useState(1);
  const [quality, setQuality] = useState(0.92);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isRaster = selectedFormat === 'png' || selectedFormat === 'jpeg' || selectedFormat === 'webp';
  const isText = selectedFormat === 'base64' || selectedFormat === 'react';

  const handleExport = async () => {
    setExporting(true);
    try {
      const options: ExportOptions = { scale, quality };
      const result = await exportSvgAs(svgContent, selectedFormat, options);

      if (isText) {
        // Copy to clipboard
        await navigator.clipboard.writeText(result.data as string);
        setCopied(true);
        onNotification(`${selectedFormat === 'base64' ? 'Base64' : 'React component'} copied to clipboard`);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Download file
        downloadBlob(result.data as Blob, result.filename);
        onNotification(`Exported as ${result.filename}`);
      }
    } catch (err) {
      onNotification(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md m-4" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white" id="export-dialog-title">Export</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors" aria-label="Close export dialog">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Format grid */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-2 block">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {formats.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFormat(f.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    selectedFormat === f.id
                      ? 'border-indigo-500 bg-indigo-600/10 text-white'
                      : 'border-gray-700/50 bg-gray-800/30 text-gray-400 hover:text-white hover:border-gray-600'
                  }`}
                >
                  <f.Icon className="w-4 h-4 mb-1" />
                  <div className="text-xs font-medium">{f.label}</div>
                  <div className="text-[10px] text-gray-500 leading-tight">{f.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Scale option (raster only) */}
          {isRaster && (
            <div>
              <label className="text-xs font-medium text-gray-400 mb-2 block">Scale</label>
              <div className="flex gap-2">
                {[1, 2, 4].map(s => (
                  <button
                    key={s}
                    onClick={() => setScale(s)}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      scale === s
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quality slider (jpeg/webp only) */}
          {(selectedFormat === 'jpeg' || selectedFormat === 'webp') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-400">Quality</label>
                <span className="text-xs text-gray-500">{Math.round(quality * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={quality}
                onChange={e => setQuality(parseFloat(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          )}

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {exporting ? (
              <span className="animate-spin">⏳</span>
            ) : isText ? (
              copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy to Clipboard</>
            ) : (
              <><Download className="w-4 h-4" /> Download {selectedFormat.toUpperCase()}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
