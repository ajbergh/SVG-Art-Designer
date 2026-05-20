import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import StyleSelector from './components/StyleSelector';
import PreviewArea from './components/PreviewArea';
import InputSection from './components/InputSection';
import LayerPanel from './components/LayerPanel';
import SettingsDialog from './components/SettingsDialog';
import HistoryPanel from './components/HistoryPanel';
import TemplateGallery from './components/TemplateGallery';
import VariationsGrid, { Variation } from './components/VariationsGrid';
import MobileTabBar, { MobileTab } from './components/MobileTabBar';
import { Template } from './data/templates';
import { generateSvg, resetSession, enhancePrompt } from './services/geminiService';
import { fetchDesigns, clearAllDesigns, DesignItem } from './services/apiService';
import { toggleLayerVisibility, reorderLayer, groupLayers, ungroupLayer, deleteLayer } from './utils/svgLayerUtils';
import { sanitizeSvg } from './utils/svgSanitizer';
import { useHistory } from './hooks/useHistory';
import { ArtStyle, GeminiModel, GenerationError } from './types';
import { Plus, Zap, BrainCircuit, Check, Layers as LayersIcon, Play, AlertTriangle, RotateCw } from 'lucide-react';

interface HistoryItem {
  id?: number;
  prompt: string;
  style: ArtStyle;
  svg: string;
  timestamp: number;
  model: GeminiModel;
  layersEnabled?: boolean;
  animationEnabled?: boolean;
}

function designToHistoryItem(d: DesignItem): HistoryItem {
  return {
    id: d.id,
    prompt: d.prompt,
    style: d.style as ArtStyle,
    svg: d.svg_content,
    timestamp: new Date(d.created_at).getTime(),
    model: d.model as GeminiModel,
    layersEnabled: d.layers_enabled,
    animationEnabled: d.animation_enabled,
  };
}

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle>(ArtStyle.NO_STYLE);
  const [selectedModel, setSelectedModel] = useState<GeminiModel>('gemini-3-flash-preview');
  const [enableLayers, setEnableLayers] = useState<boolean>(true);
  const [enableAnimation, setEnableAnimation] = useState<boolean>(false);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<GenerationError | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [showLayers, setShowLayers] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [showVariations, setShowVariations] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('preview');
  
  // Load history from backend on mount
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Undo/Redo
  const { pushState, undo, redo, canUndo, canRedo, clear: clearUndoHistory } = useHistory();

  const pushCurrentState = useCallback(() => {
    if (svgContent) {
      pushState({ svgCode: svgContent, timestamp: Date.now() });
    }
  }, [svgContent, pushState]);

  const handleUndo = useCallback(() => {
    if (!svgContent) return;
    const prev = undo({ svgCode: svgContent, timestamp: Date.now() });
    if (prev) setSvgContent(prev.svgCode);
  }, [svgContent, undo]);

  const handleRedo = useCallback(() => {
    if (!svgContent) return;
    const next = redo({ svgCode: svgContent, timestamp: Date.now() });
    if (next) setSvgContent(next.svgCode);
  }, [svgContent, redo]);

  useEffect(() => {
    fetchDesigns(100, 0)
      .then(data => {
        setHistory(data.designs.map(designToHistoryItem));
        // Migrate localStorage data if present
        try {
          const saved = localStorage.getItem('svg_designer_history_v1');
          if (saved) {
            localStorage.removeItem('svg_designer_history_v1');
          }
        } catch { /* ignore */ }
      })
      .catch(() => {
        // Fallback: try loading from localStorage if backend is unavailable
        try {
          const saved = localStorage.getItem('svg_designer_history_v1');
          if (saved) setHistory(JSON.parse(saved));
        } catch { /* ignore */ }
      });
  }, []);

  const categorizeError = (err: unknown): GenerationError => {
    if (err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('network'))) {
      return { type: 'network', message: 'Network error. Check your connection and try again.', retryable: true };
    }
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      if (msg.includes('429') || msg.includes('rate limit')) {
        return { type: 'rate_limit', message: 'Rate limit reached. Please wait a moment before trying again.', retryable: true };
      }
      if (msg.includes('401') || msg.includes('403') || msg.includes('auth') || msg.includes('api key')) {
        return { type: 'auth', message: 'Authentication failed. Check your API key in Settings.', retryable: false };
      }
      if (msg.includes('model') || msg.includes('500')) {
        return { type: 'model_error', message: `Model error: ${err.message}`, retryable: true };
      }
      return { type: 'unknown', message: err.message, retryable: true };
    }
    return { type: 'unknown', message: 'An unexpected error occurred.', retryable: true };
  };

  const handleGenerate = async (inputPrompt: string) => {
    setLoading(true);
    setError(null);
    setLastPrompt(inputPrompt);
    try {
      let svg: string;
      try {
        svg = await generateSvg(inputPrompt, selectedStyle, selectedModel, enableLayers, enableAnimation);
      } catch (firstErr) {
        // Auto-retry once for network errors
        if (firstErr instanceof TypeError && (firstErr.message.includes('fetch') || firstErr.message.includes('network'))) {
          await new Promise(r => setTimeout(r, 2000));
          svg = await generateSvg(inputPrompt, selectedStyle, selectedModel, enableLayers, enableAnimation);
        } else {
          throw firstErr;
        }
      }
      const cleanSvg = sanitizeSvg(svg);
      pushCurrentState(); // Save state before overwriting
      setSvgContent(cleanSvg);
      // Refresh history from backend (which auto-saved the design)
      fetchDesigns(100, 0)
        .then(data => setHistory(data.designs.map(designToHistoryItem)))
        .catch(() => {
          // Fallback: add to local state
          setHistory(prev => [
            {
              prompt: inputPrompt,
              style: selectedStyle,
              svg: cleanSvg,
              timestamp: Date.now(),
              model: selectedModel,
              layersEnabled: enableLayers,
              animationEnabled: enableAnimation,
            },
            ...prev,
          ]);
        });
    } catch (err) {
      setError(categorizeError(err));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnhance = async (currentPrompt: string): Promise<string> => {
      return await enhancePrompt(currentPrompt);
  };

  const handleRetry = () => {
    if (lastPrompt) {
      handleGenerate(lastPrompt);
    }
  };

  const handleBatchGenerate = async (inputPrompt: string, count: number = 4) => {
    setShowVariations(true);
    const initial: Variation[] = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      svg: null,
      loading: true,
      error: null,
    }));
    setVariations(initial);

    // Run all generations in parallel
    const promises = initial.map(async (v) => {
      try {
        const svg = await generateSvg(inputPrompt, selectedStyle, selectedModel, enableLayers, enableAnimation);
        const clean = sanitizeSvg(svg);
        setVariations(prev => prev.map(item => item.id === v.id ? { ...item, svg: clean, loading: false } : item));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Generation failed';
        setVariations(prev => prev.map(item => item.id === v.id ? { ...item, error: msg, loading: false } : item));
      }
    });
    await Promise.allSettled(promises);
  };

  const handleSelectVariation = (svg: string) => {
    pushCurrentState();
    setSvgContent(sanitizeSvg(svg));
    setShowVariations(false);
  };

  // Called when user edits code manually in the Code View
  const handleManualSvgUpdate = (newSvg: string) => {
    pushCurrentState();
    setSvgContent(sanitizeSvg(newSvg));
  };

  // Layer Actions
  const handleLayerAction = (action: (currentSvg: string) => string) => {
      if (!svgContent) return;
      pushCurrentState();
      const newSvg = action(svgContent);
      setSvgContent(newSvg);
  };

  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedStyle(template.style);
    handleGenerate(template.prompt);
  }, [selectedModel, enableLayers, enableAnimation]);

  const handleNewSession = useCallback(() => {
    setSvgContent(null);
    setPrompt('');
    setError(null);
    clearUndoHistory();
    resetSession(); // fire-and-forget async
  }, [clearUndoHistory]);

  const handleLoadHistory = (item: HistoryItem) => {
    setSvgContent(item.svg);
    setSelectedStyle(item.style);
    if (item.model) setSelectedModel(item.model);
    if (item.layersEnabled !== undefined) setEnableLayers(item.layersEnabled);
    setEnableAnimation(!!item.animationEnabled);
  };

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    clearAllDesigns().catch(() => {
      // If backend fails, also try clearing localStorage as fallback
      localStorage.removeItem('svg_designer_history_v1');
    });
  }, []);

  const handleHistoryContextMenu = (e: React.MouseEvent, promptText: string) => {
      e.preventDefault();
      navigator.clipboard.writeText(promptText);
      setNotification("Prompt copied to clipboard!");
      setTimeout(() => setNotification(null), 2000);
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
      const mod = e.ctrlKey || e.metaKey;

      if (mod) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) handleRedo();
            else handleUndo();
            return;
          case 'y':
            e.preventDefault();
            handleRedo();
            return;
          case 's':
            e.preventDefault();
            // Trigger SVG download via custom event
            window.dispatchEvent(new CustomEvent(e.shiftKey ? 'app:download-png' : 'app:download-svg'));
            return;
          case 'e':
            if (!isInputFocused) {
              e.preventDefault();
              window.dispatchEvent(new CustomEvent('app:toggle-code'));
            }
            return;
          case 'l':
            if (!isInputFocused) {
              e.preventDefault();
              setShowLayers(prev => !prev);
            }
            return;
          case ',':
            e.preventDefault();
            setShowSettings(true);
            return;
        }
      }

      if (e.key === 'Escape') {
        setShowSettings(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white relative">
      <Header onOpenSettings={() => setShowSettings(true)} />
      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onNotification={(msg) => { setNotification(msg); setTimeout(() => setNotification(null), 2000); }}
      />
      <TemplateGallery
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={handleSelectTemplate}
      />
      {showVariations && (
        <VariationsGrid
          variations={variations}
          onSelect={handleSelectVariation}
          onClose={() => setShowVariations(false)}
        />
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full shadow-2xl border border-gray-700 z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200" role="status" aria-live="polite">
            <div className="bg-green-500/20 p-1 rounded-full">
                <Check className="w-3 h-3 text-green-400" />
            </div>
            <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden relative" id="main-content">
        {/* Left Sidebar: Controls & History */}
        <nav className="w-80 bg-gray-950/40 border-r border-gray-900/60 flex flex-col p-6 overflow-y-auto hidden lg:flex shrink-0 z-20 backdrop-blur-md" aria-label="Design controls">
            
            {/* New Session Button */}
            <button 
              onClick={handleNewSession}
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 via-indigo-550 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 mb-6 transition-all scale-hover"
            >
              <Plus className="w-4 h-4 text-indigo-200" />
              New Design
            </button>

            {/* Model Selector */}
            <div className="mb-4 bg-gray-800/40 p-1 rounded-xl flex border border-gray-800/80 backdrop-blur-md">
                <button 
                    onClick={() => setSelectedModel('gemini-3-flash-preview')}
                    disabled={loading}
                    className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        selectedModel === 'gemini-3-flash-preview' 
                        ? 'bg-gray-800 text-white shadow-inner ring-1 ring-gray-700' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/20'
                    }`}
                >
                    <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" /> Flash
                </button>
                <button 
                    onClick={() => setSelectedModel('gemini-3.5-flash-preview')}
                    disabled={loading}
                    className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        selectedModel === 'gemini-3.5-flash-preview' 
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/30' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/20'
                    }`}
                >
                    <BrainCircuit className="w-3.5 h-3.5 text-violet-300" /> 3.5 Flash
                </button>
            </div>

            {/* Layer & Animation Support Toggle */}
            <div className="mb-6 space-y-2">
                <div className="flex items-center justify-between bg-gray-800/30 p-2.5 rounded-xl border border-gray-700/50">
                  <div className="flex items-center gap-2">
                    <LayersIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-300">Smart Layering</span>
                  </div>
                  <button
                    onClick={() => setEnableLayers(!enableLayers)}
                    disabled={loading}
                    className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${enableLayers ? 'bg-indigo-600' : 'bg-gray-700'}`}
                    title={enableLayers ? "AI will group elements into named layers" : "AI will generate flattened SVG code"}
                  >
                    <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${enableLayers ? 'translate-x-4' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between bg-gray-800/30 p-2.5 rounded-xl border border-gray-700/50">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-300">Animate</span>
                  </div>
                  <button
                    onClick={() => setEnableAnimation(!enableAnimation)}
                    disabled={loading}
                    className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${enableAnimation ? 'bg-indigo-600' : 'bg-gray-700'}`}
                    title={enableAnimation ? "AI will generate animated SVG" : "Static SVG"}
                  >
                    <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${enableAnimation ? 'translate-x-4' : ''}`} />
                  </button>
                </div>
            </div>

            {/* Style Selector */}
            <div className="mb-8">
                <StyleSelector 
                    selectedStyle={selectedStyle} 
                    onSelect={setSelectedStyle} 
                    disabled={loading}
                />
            </div>

            {/* Input Section (Desktop Sidebar placement) */}
             <div className="mb-8">
                <InputSection 
                    onGenerate={handleGenerate} 
                    onEnhance={handleEnhance}
                    loading={loading} 
                    isRefinement={!!svgContent}
                    onOpenTemplates={() => setShowTemplates(true)}
                    onBatchGenerate={(p) => handleBatchGenerate(p)}
                />
            </div>

            {/* History / Info */}
            <HistoryPanel 
              history={history}
              currentSvg={svgContent}
              onLoad={handleLoadHistory}
              onClear={handleClearHistory}
              onCopyPrompt={handleHistoryContextMenu}
            />
            
            {/* Error Message */}
            {error && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <p className="text-red-300 text-sm">{error.message}</p>
                    </div>
                    {error.retryable && lastPrompt && (
                      <button
                        onClick={handleRetry}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        <RotateCw className="w-3 h-3" /> Retry
                      </button>
                    )}
                </div>
            )}
        </nav>

        {/* Right / Main: Preview Area */}
        <div className="flex-1 p-4 sm:p-6 flex flex-col min-w-0 bg-gray-950 relative z-10">
          <div className="flex-1 flex flex-col h-full relative">
              <PreviewArea 
                svgContent={svgContent} 
                loading={loading} 
                onManualUpdate={handleManualSvgUpdate}
                showLayers={showLayers}
                onToggleLayers={() => setShowLayers(!showLayers)}
                error={error}
                onRetry={lastPrompt ? handleRetry : undefined}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={handleUndo}
                onRedo={handleRedo}
              />
              
               {/* Mobile Only Input (since sidebar is hidden on mobile) */}
                <div className="lg:hidden mt-4 space-y-4 pb-20">
                    {/* Mobile: Input always visible at top */}
                    <div className="flex gap-2">
                        <button 
                        onClick={handleNewSession}
                        className="bg-indigo-600 text-white p-2 rounded-xl flex-shrink-0"
                        title="New Design"
                        aria-label="New design"
                        >
                        <Plus className="w-6 h-6" />
                        </button>
                        <div className="flex-1">
                        <InputSection 
                            onGenerate={handleGenerate} 
                            onEnhance={handleEnhance}
                            loading={loading} 
                            isRefinement={!!svgContent}
                            onOpenTemplates={() => setShowTemplates(true)}
                            onBatchGenerate={(p) => handleBatchGenerate(p)}
                        />
                        </div>
                    </div>

                    {/* Mobile tab content */}
                    {mobileTab === 'layers' && (
                      <div className="bg-gray-900 rounded-xl border border-gray-800 max-h-[50vh] overflow-y-auto">
                        <LayerPanel
                          svgContent={svgContent}
                          onUpdate={setSvgContent}
                          onToggleVisibility={(idx) => handleLayerAction(svg => toggleLayerVisibility(svg, idx))}
                          onReorder={(idx, dir) => handleLayerAction(svg => reorderLayer(svg, idx, dir))}
                          onGroup={(indices) => handleLayerAction(svg => groupLayers(svg, indices))}
                          onUngroup={(idx) => handleLayerAction(svg => ungroupLayer(svg, idx))}
                          onDelete={(idx) => handleLayerAction(svg => deleteLayer(svg, idx))}
                        />
                      </div>
                    )}

                    {mobileTab === 'history' && (
                      <div className="bg-gray-900 rounded-xl border border-gray-800 max-h-[50vh] overflow-y-auto p-4">
                        <HistoryPanel
                          history={history}
                          currentSvg={svgContent}
                          onLoad={handleLoadHistory}
                          onClear={handleClearHistory}
                          onCopyPrompt={handleHistoryContextMenu}
                        />
                      </div>
                    )}

                    {(mobileTab === 'preview' || mobileTab === 'code') && (
                      <>
                        {/* Mobile Model Selector & Layers */}
                        <div className="flex flex-col gap-2">
                            <div className="flex bg-gray-800/40 p-1 rounded-xl border border-gray-800/80 backdrop-blur-md">
                                <button 
                                    onClick={() => setSelectedModel('gemini-3-flash-preview')}
                                    disabled={loading}
                                    className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                                        selectedModel === 'gemini-3-flash-preview' 
                                        ? 'bg-gray-800 text-white shadow-inner ring-1 ring-gray-700' 
                                        : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                >
                                    <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" /> Flash
                                </button>
                                <button 
                                    onClick={() => setSelectedModel('gemini-3.5-flash-preview')}
                                    disabled={loading}
                                    className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                                        selectedModel === 'gemini-3.5-flash-preview' 
                                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/30' 
                                        : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                >
                                    <BrainCircuit className="w-3.5 h-3.5 text-violet-300" /> 3.5 Flash
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center justify-between bg-gray-800/30 px-3 py-2 rounded-xl border border-gray-700/50">
                                    <div className="flex items-center gap-2">
                                        <LayersIcon className="w-3 h-3 text-gray-400" />
                                        <span className="text-xs font-medium text-gray-300">Layers</span>
                                    </div>
                                    <button
                                        onClick={() => setEnableLayers(!enableLayers)}
                                        disabled={loading}
                                        className={`w-8 h-4 rounded-full relative transition-colors duration-200 ${enableLayers ? 'bg-indigo-600' : 'bg-gray-700'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${enableLayers ? 'translate-x-4' : ''}`} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between bg-gray-800/30 px-3 py-2 rounded-xl border border-gray-700/50">
                                    <div className="flex items-center gap-2">
                                        <Play className="w-3 h-3 text-gray-400" />
                                        <span className="text-xs font-medium text-gray-300">Animate</span>
                                    </div>
                                    <button
                                        onClick={() => setEnableAnimation(!enableAnimation)}
                                        disabled={loading}
                                        className={`w-8 h-4 rounded-full relative transition-colors duration-200 ${enableAnimation ? 'bg-indigo-600' : 'bg-gray-700'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${enableAnimation ? 'translate-x-4' : ''}`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto pb-2">
                            <StyleSelector 
                                selectedStyle={selectedStyle} 
                                onSelect={setSelectedStyle} 
                                disabled={loading}
                            />
                        </div>
                      </>
                    )}
                </div>
          </div>
          
        </div>

        {/* Right Sidebar: Layers */}
        <aside 
            className={`
                fixed inset-y-0 right-0 w-72 bg-gray-900 border-l border-gray-800 transform transition-transform duration-300 ease-in-out z-30 lg:relative lg:translate-x-0
                ${showLayers ? 'translate-x-0' : 'translate-x-full lg:hidden'}
            `}
            aria-label="Layer controls"
        >
            <LayerPanel 
                svgContent={svgContent}
                onUpdate={setSvgContent}
                onToggleVisibility={(idx) => handleLayerAction(svg => toggleLayerVisibility(svg, idx))}
                onReorder={(idx, dir) => handleLayerAction(svg => reorderLayer(svg, idx, dir))}
                onGroup={(indices) => handleLayerAction(svg => groupLayers(svg, indices))}
                onUngroup={(idx) => handleLayerAction(svg => ungroupLayer(svg, idx))}
                onDelete={(idx) => handleLayerAction(svg => deleteLayer(svg, idx))}
            />
        </aside>

        <MobileTabBar
          activeTab={mobileTab}
          onTabChange={setMobileTab}
          onGenerate={() => {
            setMobileTab('preview');
            // Scroll to top where input is on mobile
            document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          loading={loading}
        />
      </main>
    </div>
  );
};

export default App;