import React, { useEffect, useState, useMemo } from 'react';
import { Download, Copy, RefreshCw, ZoomIn, ZoomOut, Check, Code, Eye, Image as ImageIcon, Layout } from 'lucide-react';

interface PreviewAreaProps {
  svgContent: string | null;
  loading: boolean;
  onManualUpdate?: (newSvg: string) => void;
  showLayers?: boolean;
  onToggleLayers?: () => void;
}

const PreviewArea: React.FC<PreviewAreaProps> = ({ svgContent, loading, onManualUpdate, showLayers, onToggleLayers }) => {
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [editableCode, setEditableCode] = useState('');
  
  // Sync editable code when incoming SVG changes
  useEffect(() => {
    if (svgContent) {
        setEditableCode(svgContent);
        setZoom(1);
    }
  }, [svgContent]);

  // Ensure the SVG has explicit width/height for rendering in the preview div.
  // Many generated SVGs (or the example provided) only have viewBox, which can cause
  // collapse to 0x0 in some flex/grid layouts or if the parent has no explicit dimensions.
  const renderableSvg = useMemo(() => {
    if (!svgContent) return null;
    let svg = svgContent;
    
    // Check if width/height are missing but viewBox exists
    const hasWidth = /<svg[^>]*width=["']([^"']*)["']/i.test(svg);
    const hasHeight = /<svg[^>]*height=["']([^"']*)["']/i.test(svg);
    
    if (!hasWidth && !hasHeight) {
        const viewBoxMatch = svg.match(/viewBox=["']\s*([\d\.-]+)\s+([\d\.-]+)\s+([\d\.-]+)\s+([\d\.-]+)\s*["']/i);
        if (viewBoxMatch) {
            const [_, x, y, width, height] = viewBoxMatch;
            // Inject width and height based on viewBox
            svg = svg.replace(/<svg([^>]*)>/i, `<svg$1 width="${width}" height="${height}">`);
        } else {
             // Fallback default
             svg = svg.replace(/<svg([^>]*)>/i, `<svg$1 width="512" height="512">`);
        }
    }
    return svg;
  }, [svgContent]);

  const handleDownloadSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `design-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = () => {
    if (!renderableSvg) return; // Use renderableSvg to ensure dimensions for canvas
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // Use renderableSvg so the image loads with correct dimensions even if original lacked them
    const svgBlob = new Blob([renderableSvg], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
        // Set canvas size to match SVG (or higher res for quality)
        canvas.width = img.width || 512;
        canvas.height = img.height || 512;
        
        if (ctx) {
            ctx.drawImage(img, 0, 0);
            const pngUrl = canvas.toDataURL('image/png');
            
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = `design-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
    };
    
    img.src = url;
  };

  const handleCopy = () => {
    if (!svgContent) return;
    navigator.clipboard.writeText(svgContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setEditableCode(newCode);
    // If the user manually edits the code, we update the parent state so the preview reflects it immediately
    if (onManualUpdate) {
        onManualUpdate(newCode);
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 0.5));

  if (!svgContent && !loading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center p-8 border-2 border-dashed border-gray-800 rounded-2xl bg-gray-900/50">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 bg-gray-800 rounded-full mx-auto flex items-center justify-center animate-pulse">
            <RefreshCw className="w-10 h-10 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-300">Ready to Create</h2>
          <p className="text-gray-500">
            Select a style on the left and describe what you want to design. Use the magic wand to enhance your prompts!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl relative">
      {/* Toolbar */}
      <div className="h-14 bg-gray-800/80 backdrop-blur-md border-b border-gray-700 flex items-center justify-between px-4 z-10 shrink-0">
        
        {/* Left: View Toggles */}
        <div className="flex items-center bg-gray-900 p-1 rounded-lg border border-gray-700">
            <button 
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'preview' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
                <Eye className="w-3 h-3" /> Preview
            </button>
            <button 
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'code' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
                <Code className="w-3 h-3" /> Code
            </button>
        </div>
        
        {loading && <span className="absolute left-1/2 -translate-x-1/2 text-xs text-indigo-400 animate-pulse font-medium">Generating...</span>}

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
            {viewMode === 'preview' && (
                <div className="hidden sm:flex items-center bg-gray-900 rounded-lg p-1 border border-gray-700 mr-2">
                    <button onClick={handleZoomOut} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Zoom Out">
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={handleZoomIn} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Zoom In">
                        <ZoomIn className="w-4 h-4" />
                    </button>
                </div>
            )}

          {/* Layer Toggle */}
          {onToggleLayers && (
            <button
              onClick={onToggleLayers}
              disabled={!svgContent || loading}
              className={`
                p-2 rounded-lg transition-colors disabled:opacity-50
                ${showLayers 
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500' 
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }
              `}
              title={showLayers ? "Hide Layers" : "Show Layers"}
            >
              <Layout className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleCopy}
            disabled={!svgContent || loading}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors disabled:opacity-50"
            title="Copy SVG Code"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
          
          <div className="h-6 w-px bg-gray-700 mx-1"></div>

          <button
            onClick={handleDownloadPng}
            disabled={!svgContent || loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            title="Export as PNG"
          >
            <ImageIcon className="w-4 h-4" />
            <span className="hidden sm:inline">PNG</span>
          </button>
          
          <button
            onClick={handleDownloadSvg}
            disabled={!svgContent || loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-900/20 disabled:opacity-50"
            title="Download SVG File"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">SVG</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden flex bg-gray-950">
        
        {loading && (
             <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-900/50 backdrop-blur-sm">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
                    <p className="text-indigo-300 font-medium animate-pulse">Designing your artwork...</p>
                </div>
             </div>
        )}

        {viewMode === 'preview' ? (
             /* Preview Mode */
            <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 checkerboard opacity-10 pointer-events-none"></div>
                {renderableSvg && (
                <div 
                    className="transition-transform duration-200 ease-out origin-center"
                    style={{ transform: `scale(${zoom})` }}
                >
                    <div 
                    className="bg-transparent shadow-2xl"
                    dangerouslySetInnerHTML={{ __html: renderableSvg }} 
                    />
                </div>
                )}
            </div>
        ) : (
            /* Code Mode */
            <div className="w-full h-full relative">
                 <textarea
                    value={editableCode}
                    onChange={handleCodeChange}
                    spellCheck={false}
                    className="w-full h-full bg-[#1e1e1e] text-blue-300 font-mono text-xs sm:text-sm p-4 resize-none focus:outline-none leading-relaxed"
                />
            </div>
        )}
      </div>
    </div>
  );
};

export default PreviewArea;