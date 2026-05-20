import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Download, Copy, RefreshCw, ZoomIn, ZoomOut, Check, Code, Eye, Image as ImageIcon, Layout, AlertTriangle, RotateCw, Grid3X3, Sun, Moon, Undo2, Redo2, Maximize, Minimize2, Share, Ruler, Palette } from 'lucide-react';
import { sanitizeSvg } from '../utils/svgSanitizer';
import { optimizeSvg } from '../utils/svgOptimizer';
import ExportDialog from './ExportDialog';
import type { GenerationError, PreviewBackground } from '../types';

const SvgCodeEditor = React.lazy(() => import('./SvgCodeEditor'));

interface ColorSwatchProps {
  color: string;
}

const ColorSwatch: React.FC<ColorSwatchProps> = ({ color }) => {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(color);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isLight = color === 'white' || color === '#ffffff' || color === '#fff' || color.startsWith('rgb(255,255,255') || color === 'yellow' || color === '#ffff00';

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="w-7 h-7 rounded-full border transition-all duration-200 cursor-pointer flex items-center justify-center scale-hover relative shadow-md"
        style={{
          backgroundColor: color,
          borderColor: isLight ? '#4b5563' : 'rgba(255,255,255,0.15)',
          boxShadow: hovered ? `0 0 14px ${color}` : '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'
        }}
        title={`Copy ${color}`}
      >
        <span className="sr-only">Color {color}</span>
      </button>

      <div 
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[10px] font-medium font-mono text-white rounded bg-gray-950 border border-gray-800 shadow-xl transition-all duration-200 pointer-events-none z-50 whitespace-nowrap ${
          hovered || copied ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-1 invisible'
        }`}
      >
        {copied ? (
          <span className="text-green-400 font-bold flex items-center gap-1">
            <Check className="w-3 h-3" /> Copied!
          </span>
        ) : (
          color
        )}
      </div>
    </div>
  );
};

const extractSvgColors = (svg: string | null): string[] => {
  if (!svg) return [];
  const colorSet = new Set<string>();
  
  // 1. Hex colors
  const hexRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;
  let match;
  while ((match = hexRegex.exec(svg)) !== null) {
    colorSet.add(match[0].toLowerCase());
  }
  
  // 2. RGB/RGBA colors
  const rgbRegex = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d\.]+)?\s*\)/g;
  while ((match = rgbRegex.exec(svg)) !== null) {
    colorSet.add(match[0].toLowerCase());
  }

  // 3. Named colors in fill, stroke, stop-color, color attributes
  const attrRegex = /(?:fill|stroke|stop-color|color)\s*=\s*["']\s*([^"'\s#\(\)]+)\s*["']/gi;
  while ((match = attrRegex.exec(svg)) !== null) {
    const colorVal = match[1].toLowerCase().trim();
    if (colorVal && colorVal !== 'none' && colorVal !== 'transparent' && colorVal !== 'inherit' && !colorVal.startsWith('url')) {
      if (/^[a-z]{3,20}$/i.test(colorVal)) {
        colorSet.add(colorVal);
      }
    }
  }
  
  return Array.from(colorSet).filter(c => c.length > 2 && c.length < 30).slice(0, 16);
};

const LOADING_PHRASES = [
  "Weaving cubic Bézier curves...",
  "Aligning coordinate anchors to the golden ratio...",
  "Brewing organic CSS linear gradients...",
  "Persuading Gemini to think like Leonardo da Vinci...",
  "Structuring viewport matrix dimensions...",
  "Calculating pixel-perfect path math...",
  "Splining curves for maximum aerodynamic flow...",
  "Polishing the SVG viewBox canvas...",
  "Optimizing vector node path segments...",
  "Applying beautiful math to vector coordinates..."
];

interface PreviewAreaProps {
  svgContent: string | null;
  loading: boolean;
  onManualUpdate?: (newSvg: string) => void;
  showLayers?: boolean;
  onToggleLayers?: () => void;
  error?: GenerationError | null;
  onRetry?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

const PreviewArea: React.FC<PreviewAreaProps> = ({ svgContent, loading, onManualUpdate, showLayers, onToggleLayers, error, onRetry, canUndo, canRedo, onUndo, onRedo }) => {
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [editableCode, setEditableCode] = useState('');
  const [previewBg, setPreviewBg] = useState<PreviewBackground>('checkerboard');
  const [optimizeNotice, setOptimizeNotice] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [gridVisible, setGridVisible] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  
  // Pan & Zoom state
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Sync editable code when incoming SVG changes
  useEffect(() => {
    if (svgContent) {
        setEditableCode(svgContent);
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
    }
  }, [svgContent]);

  // Listen for app-level events (from keyboard shortcuts)
  useEffect(() => {
    const onDownloadSvg = () => handleDownloadSvg();
    const onDownloadPng = () => handleDownloadPng();
    const onToggleCode = () => setViewMode(prev => prev === 'preview' ? 'code' : 'preview');
    window.addEventListener('app:download-svg', onDownloadSvg);
    window.addEventListener('app:download-png', onDownloadPng);
    window.addEventListener('app:toggle-code', onToggleCode);
    return () => {
      window.removeEventListener('app:download-svg', onDownloadSvg);
      window.removeEventListener('app:download-png', onDownloadPng);
      window.removeEventListener('app:toggle-code', onToggleCode);
    };
  });

  // Space key for pan mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') { e.preventDefault(); setSpaceHeld(true); }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  // Mouse wheel zoom (centered on cursor)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (viewMode !== 'preview') return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(5, Math.max(0.1, zoom * factor));
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const ratio = newZoom / zoom;
      setPanOffset({
        x: cursorX - ratio * (cursorX - panOffset.x),
        y: cursorY - ratio * (cursorY - panOffset.y),
      });
      setZoom(newZoom);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoom, panOffset, viewMode]);

  const handlePanMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [spaceHeld, panOffset]);

  const handlePanMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handlePanMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleFitToCanvas = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Loading phrase sequence interval
  useEffect(() => {
    if (!loading) return;
    setLoadingPhraseIndex(0);
    const interval = setInterval(() => {
      setLoadingPhraseIndex(prev => (prev + 1) % LOADING_PHRASES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  // Robust SVG dimensions parser
  const svgDimensions = useMemo(() => {
    if (!svgContent) return { width: 512, height: 512 };
    
    let width = 512;
    let height = 512;
    
    const widthMatch = svgContent.match(/width=["']\s*([\d\.-]+)(?:px)?\s*["']/i);
    const heightMatch = svgContent.match(/height=["']\s*([\d\.-]+)(?:px)?\s*["']/i);
    
    if (widthMatch) width = Math.round(parseFloat(widthMatch[1]));
    if (heightMatch) height = Math.round(parseFloat(heightMatch[1]));
    
    if (!widthMatch || !heightMatch) {
      const viewBoxMatch = svgContent.match(/viewBox=["']\s*([\d\.-]+)\s+([\d\.-]+)\s+([\d\.-]+)\s+([\d\.-]+)\s*["']/i);
      if (viewBoxMatch) {
        const vbW = Math.round(parseFloat(viewBoxMatch[3]));
        const vbH = Math.round(parseFloat(viewBoxMatch[4]));
        if (!widthMatch) width = vbW;
        if (!heightMatch) height = vbH;
      }
    }
    
    if (isNaN(width) || width <= 0) width = 512;
    if (isNaN(height) || height <= 0) height = 512;
    
    return { width, height };
  }, [svgContent]);

  // Ruler ticks coordinates generator (every 50px)
  const rulerTicks = useMemo(() => {
    const ticksX = [];
    const ticksY = [];
    const step = 50;
    
    for (let x = 0; x <= svgDimensions.width; x += step) {
      ticksX.push(x);
    }
    for (let y = 0; y <= svgDimensions.height; y += step) {
      ticksY.push(y);
    }
    
    return { ticksX, ticksY };
  }, [svgDimensions]);

  // Extracted SVG color swatches
  const extractedColors = useMemo(() => {
    return extractSvgColors(svgContent);
  }, [svgContent]);

  // Ensure the SVG has explicit width/height for rendering in the preview div.
  const renderableSvg = useMemo(() => {
    if (!svgContent) return null;
    let svg = sanitizeSvg(svgContent);
    
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

  const handleOptimize = () => {
    if (!svgContent || !onManualUpdate) return;
    const { svg: optimized, savings } = optimizeSvg(svgContent);
    onManualUpdate(optimized);
    setOptimizeNotice(`Optimized: ${savings}% smaller`);
    setTimeout(() => setOptimizeNotice(null), 3000);
  };

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
        
        {/* Left: View Toggles + Undo/Redo */}
        <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-900 p-1 rounded-lg border border-gray-700" role="tablist" aria-label="View mode">
                <button 
                    onClick={() => setViewMode('preview')}
                    role="tab"
                    aria-selected={viewMode === 'preview'}
                    className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'preview' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <Eye className="w-3 h-3" /> Preview
                </button>
                <button 
                    onClick={() => setViewMode('code')}
                    role="tab"
                    aria-selected={viewMode === 'code'}
                    className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'code' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <Code className="w-3 h-3" /> Code
                </button>
            </div>
            {(onUndo || onRedo) && (
              <div className="hidden sm:flex items-center bg-gray-900 p-1 rounded-lg border border-gray-700">
                <button onClick={onUndo} disabled={!canUndo} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400" title="Undo (Ctrl+Z)">
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={onRedo} disabled={!canRedo} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400" title="Redo (Ctrl+Shift+Z)">
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
        </div>
        
        {loading && <span className="absolute left-1/2 -translate-x-1/2 text-xs text-indigo-400 animate-pulse font-medium">Generating...</span>}
        {optimizeNotice && <span className="absolute left-1/2 -translate-x-1/2 text-xs text-green-400 font-medium">{optimizeNotice}</span>}

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
            {viewMode === 'preview' && (
                <>
                <div className="hidden sm:flex items-center bg-gray-900 rounded-lg p-1 border border-gray-700 mr-1">
                    <button onClick={() => setPreviewBg('checkerboard')} className={`p-1.5 rounded ${previewBg === 'checkerboard' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} title="Checkerboard">
                        <Grid3X3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setPreviewBg('white')} className={`p-1.5 rounded ${previewBg === 'white' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} title="White Background">
                        <Sun className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setPreviewBg('dark')} className={`p-1.5 rounded ${previewBg === 'dark' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} title="Dark Background">
                        <Moon className="w-3.5 h-3.5" />
                    </button>
                </div>
                <button 
                  onClick={() => setGridVisible(prev => !prev)} 
                  className={`p-1.5 rounded transition-all border flex items-center justify-center ${
                    gridVisible 
                      ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)] animate-pulse' 
                      : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800'
                  }`} 
                  title="Toggle Blueprint Grid & Ruler"
                >
                  <Ruler className="w-3.5 h-3.5" />
                </button>
                <div className="hidden sm:flex items-center bg-gray-900 rounded-lg p-1 border border-gray-700 mr-2">
                    <button onClick={handleZoomOut} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Zoom Out">
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={handleZoomIn} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Zoom In">
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-gray-700 mx-0.5"></div>
                    <button onClick={handleFitToCanvas} className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Fit to Canvas">
                        <Maximize className="w-3.5 h-3.5" />
                    </button>
                </div>
                </>
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
            onClick={handleOptimize}
            disabled={!svgContent || loading}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors disabled:opacity-50"
            title="Optimize SVG (reduce file size)"
          >
            <Minimize2 className="w-4 h-4" />
          </button>

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
            onClick={() => setShowExport(true)}
            disabled={!svgContent || loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-900/20 disabled:opacity-50"
            title="Export design"
          >
            <Share className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden flex bg-gray-950">
        
        {loading && (
             <div className="absolute inset-0 flex items-center justify-center z-20 bg-gray-900/50 backdrop-blur-sm">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
                    <p className="text-indigo-300 font-medium animate-pulse">{LOADING_PHRASES[loadingPhraseIndex]}</p>
                </div>
             </div>
        )}

        {/* Error Display */}
        {error && !loading && viewMode === 'preview' && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-3 p-6 bg-red-900/20 rounded-xl border border-red-500/30 max-w-sm mx-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <p className="text-red-300 text-sm text-center">{error.message}</p>
              {error.retryable && onRetry && (
                <button onClick={onRetry} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors">
                  <RotateCw className="w-4 h-4" /> Retry Generation
                </button>
              )}
            </div>
          </div>
        )}

        {viewMode === 'preview' ? (
             /* Preview Mode */
            <div 
                ref={containerRef}
                id="canvas-viewport"
                className={`w-full h-full flex items-center justify-center relative overflow-hidden transition-colors duration-300 ${
                  gridVisible 
                    ? 'bg-[#06152d]' 
                    : previewBg === 'white' 
                      ? 'bg-white' 
                      : previewBg === 'dark' 
                        ? 'bg-gray-900' 
                        : previewBg === 'transparent' 
                          ? 'bg-gray-950' 
                          : 'bg-gray-950'
                }`}
                onMouseDown={handlePanMouseDown}
                onMouseMove={handlePanMouseMove}
                onMouseUp={handlePanMouseUp}
                onMouseLeave={handlePanMouseUp}
                style={{ cursor: isPanning ? 'grabbing' : spaceHeld ? 'grab' : 'default' }}
            >
                {previewBg === 'checkerboard' && !gridVisible && (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: 'linear-gradient(45deg, #374151 25%, transparent 25%), linear-gradient(-45deg, #374151 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #374151 75%), linear-gradient(-45deg, transparent 75%, #374151 75%)',
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                    opacity: 0.15,
                  }} />
                )}
                {renderableSvg && (
                <div 
                    className="transition-none origin-top-left"
                    style={{ 
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                      transformOrigin: '0 0',
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                    }}
                >
                    <div 
                    className="bg-transparent shadow-2xl relative"
                    style={{ 
                      width: `${svgDimensions.width}px`, 
                      height: `${svgDimensions.height}px`,
                      transform: 'translate(-50%, -50%)' 
                    }}
                    >
                      <div dangerouslySetInnerHTML={{ __html: renderableSvg }} className="w-full h-full" />
                      
                      {/* Blueprint Grid & Coordinates Overlay */}
                      {gridVisible && (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none select-none z-10 overflow-visible">
                          <defs>
                            <pattern id="blueprintMinorGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#00f0ff" strokeWidth="0.5" opacity="0.12" />
                            </pattern>
                            <pattern id="blueprintMajorGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                              <rect width="50" height="50" fill="url(#blueprintMinorGrid)" />
                              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#00f0ff" strokeWidth="1" opacity="0.25" />
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill="url(#blueprintMajorGrid)" />
                          <rect width="100%" height="100%" fill="none" stroke="#00f0ff" strokeWidth="1.5" opacity="0.5" />
                          
                          {/* X Ticks & Labels */}
                          {rulerTicks.ticksX.map(x => (
                            <g key={`tx-${x}`} transform={`translate(${x}, 0)`}>
                              <line x1="0" y1="0" x2="0" y2="8" stroke="#00f0ff" strokeWidth="1" opacity="0.6" />
                              {x % 100 === 0 && (
                                <text x="2" y="16" fill="#00f0ff" fontSize="8" fontFamily="Consolas, monospace" opacity="0.8" className="font-bold">
                                  {x}
                                </text>
                              )}
                            </g>
                          ))}
                          
                          {/* Y Ticks & Labels */}
                          {rulerTicks.ticksY.map(y => (
                            <g key={`ty-${y}`} transform={`translate(0, ${y})`}>
                              <line x1="0" y1="0" x2="8" y2="0" stroke="#00f0ff" strokeWidth="1" opacity="0.6" />
                              {y % 100 === 0 && (
                                <text x="10" y="10" fill="#00f0ff" fontSize="8" fontFamily="Consolas, monospace" opacity="0.8" className="font-bold">
                                  {y}
                                </text>
                              )}
                            </g>
                          ))}
                          
                          {/* Blueprint corner details */}
                          <path d="M 0,20 L 0,0 L 20,0" fill="none" stroke="#00f0ff" strokeWidth="2.5" />
                          <path d={`M ${svgDimensions.width - 20},0 L ${svgDimensions.width},0 L ${svgDimensions.width},20`} fill="none" stroke="#00f0ff" strokeWidth="2.5" />
                          <path d={`M 0,${svgDimensions.height - 20} L 0,${svgDimensions.height} L 20,${svgDimensions.height}`} fill="none" stroke="#00f0ff" strokeWidth="2.5" />
                          <path d={`M ${svgDimensions.width - 20},${svgDimensions.height} L ${svgDimensions.width},${svgDimensions.height} L ${svgDimensions.width},${svgDimensions.height - 20}`} fill="none" stroke="#00f0ff" strokeWidth="2.5" />
                        </svg>
                      )}
                    </div>
                </div>
                )}
            </div>
        ) : (
            /* Code Mode */
            <div className="w-full h-full relative">
                 <React.Suspense fallback={<div className="w-full h-full bg-[#1e1e1e] flex items-center justify-center text-gray-500 text-sm">Loading editor...</div>}>
                   <SvgCodeEditor
                      value={editableCode}
                      onChange={(newCode) => {
                        setEditableCode(newCode);
                        if (onManualUpdate) onManualUpdate(newCode);
                      }}
                  />
                 </React.Suspense>
            </div>
        )}
      </div>

      {/* Color Palette Swatches Drawer */}
      {viewMode === 'preview' && extractedColors.length > 0 && (
        <div id="color-palette-drawer" className="bg-gray-900/95 backdrop-blur-md border-t border-gray-800 px-4 py-3 flex flex-wrap items-center gap-4 shrink-0 transition-all duration-300">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wider select-none shrink-0">
            <Palette className="w-3.5 h-3.5 text-indigo-400" />
            <span>Art Palette</span>
            <span className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded text-[10px] font-medium">{extractedColors.length} colors</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 overflow-x-auto py-1 scrollbar-none">
            {extractedColors.map((color, index) => (
              <ColorSwatch key={`${color}-${index}`} color={color} />
            ))}
          </div>
        </div>
      )}

      {/* Export dialog */}
      {svgContent && (
        <ExportDialog
          isOpen={showExport}
          onClose={() => setShowExport(false)}
          svgContent={svgContent}
          onNotification={(msg) => { setExportNotice(msg); setTimeout(() => setExportNotice(null), 3000); }}
        />
      )}

      {/* Export notification */}
      {exportNotice && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full shadow-xl border border-gray-700 z-50 text-sm" role="status">
          {exportNotice}
        </div>
      )}
    </div>
  );
};

export default PreviewArea;