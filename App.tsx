import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import StyleSelector from './components/StyleSelector';
import PreviewArea from './components/PreviewArea';
import InputSection from './components/InputSection';
import LayerPanel from './components/LayerPanel';
import SettingsDialog from './components/SettingsDialog';
import { generateSvg, resetSession, enhancePrompt } from './services/geminiService';
import { fetchDesigns, clearAllDesigns, DesignItem } from './services/apiService';
import { toggleLayerVisibility, reorderLayer, groupLayers, ungroupLayer, deleteLayer } from './utils/svgLayerUtils';
import { ArtStyle, GeminiModel } from './types';
import { History, Trash2, Plus, Clock, Zap, BrainCircuit, Check, Layers as LayersIcon, Play } from 'lucide-react';

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
  const [error, setError] = useState<string | null>(null);
  const [showLayers, setShowLayers] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Load history from backend on mount
  const [history, setHistory] = useState<HistoryItem[]>([]);

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

  const handleGenerate = async (inputPrompt: string) => {
    setLoading(true);
    setError(null);
    try {
      const svg = await generateSvg(inputPrompt, selectedStyle, selectedModel, enableLayers, enableAnimation);
      setSvgContent(svg);
      // Refresh history from backend (which auto-saved the design)
      fetchDesigns(100, 0)
        .then(data => setHistory(data.designs.map(designToHistoryItem)))
        .catch(() => {
          // Fallback: add to local state
          setHistory(prev => [
            {
              prompt: inputPrompt,
              style: selectedStyle,
              svg,
              timestamp: Date.now(),
              model: selectedModel,
              layersEnabled: enableLayers,
              animationEnabled: enableAnimation,
            },
            ...prev,
          ]);
        });
    } catch (err) {
      setError("Failed to generate SVG. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnhance = async (currentPrompt: string): Promise<string> => {
      return await enhancePrompt(currentPrompt);
  };

  // Called when user edits code manually in the Code View
  const handleManualSvgUpdate = (newSvg: string) => {
    setSvgContent(newSvg);
  };

  // Layer Actions
  const handleLayerAction = (action: (currentSvg: string) => string) => {
      if (!svgContent) return;
      const newSvg = action(svgContent);
      setSvgContent(newSvg);
  };

  const handleNewSession = useCallback(() => {
    setSvgContent(null);
    setPrompt('');
    setError(null);
    resetSession(); // fire-and-forget async
  }, []);

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

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white relative">
      <Header onOpenSettings={() => setShowSettings(true)} />
      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onNotification={(msg) => { setNotification(msg); setTimeout(() => setNotification(null), 2000); }}
      />

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full shadow-2xl border border-gray-700 z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-green-500/20 p-1 rounded-full">
                <Check className="w-3 h-3 text-green-400" />
            </div>
            <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Controls & History */}
        <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col p-6 overflow-y-auto hidden lg:flex shrink-0 z-20">
            
            {/* New Session Button */}
            <button 
              onClick={handleNewSession}
              disabled={loading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 mb-6 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              New Design
            </button>

            {/* Model Selector */}
            <div className="mb-4 bg-gray-800/50 p-1 rounded-xl flex border border-gray-700">
                <button 
                    onClick={() => setSelectedModel('gemini-3-flash-preview')}
                    disabled={loading}
                    className={`flex-1 py-2 px-2 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
                        selectedModel === 'gemini-3-flash-preview' 
                        ? 'bg-gray-700 text-white shadow-sm ring-1 ring-gray-600' 
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                >
                    <Zap className="w-3 h-3" /> Flash
                </button>
                <button 
                    onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
                    disabled={loading}
                    className={`flex-1 py-2 px-2 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
                        selectedModel === 'gemini-3.1-pro-preview' 
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/30' 
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                >
                    <BrainCircuit className="w-3 h-3" /> Pro
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
                />
            </div>

            {/* History / Info */}
            <div className="flex-1 overflow-y-auto min-h-0">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Session History
                    </h3>
                    {history.length > 0 && (
                        <button onClick={handleClearHistory} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                            <Trash2 className="w-3 h-3" /> Clear
                        </button>
                    )}
                </div>
                
                <div className="space-y-3">
                    {history.length === 0 ? (
                        <div className="text-center py-8 text-gray-600">
                          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm italic">No designs yet.</p>
                        </div>
                    ) : (
                        history.map((item, idx) => (
                            <button 
                                key={item.timestamp} 
                                onClick={() => handleLoadHistory(item)}
                                onContextMenu={(e) => handleHistoryContextMenu(e, item.prompt)}
                                title="Right-click to copy prompt"
                                className={`w-full text-left group p-3 rounded-lg border transition-all duration-200
                                  ${svgContent === item.svg 
                                    ? 'bg-gray-800 border-indigo-500/50 ring-1 ring-indigo-500/20' 
                                    : 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-800 hover:border-gray-600'
                                  }
                                `}
                            >
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                    svgContent === item.svg ? 'bg-indigo-900/50 text-indigo-300' : 'bg-gray-700 text-gray-400'
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
                                <p className="text-gray-300 text-sm line-clamp-2 leading-relaxed group-hover:text-white">
                                  "{item.prompt}"
                                </p>
                            </button>
                        ))
                    )}
                </div>
            </div>
            
            {/* Error Message */}
            {error && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 text-red-300 text-sm rounded-lg">
                    {error}
                </div>
            )}
        </div>

        {/* Right / Main: Preview Area */}
        <div className="flex-1 p-4 sm:p-6 flex flex-col min-w-0 bg-gray-950 relative z-10">
          <div className="flex-1 flex flex-col h-full relative">
              <PreviewArea 
                svgContent={svgContent} 
                loading={loading} 
                onManualUpdate={handleManualSvgUpdate}
                showLayers={showLayers}
                onToggleLayers={() => setShowLayers(!showLayers)}
              />
              
               {/* Mobile Only Input (since sidebar is hidden on mobile) */}
                <div className="lg:hidden mt-4 space-y-4">
                    <div className="flex gap-2">
                        <button 
                        onClick={handleNewSession}
                        className="bg-indigo-600 text-white p-2 rounded-xl flex-shrink-0"
                        title="New Design"
                        >
                        <Plus className="w-6 h-6" />
                        </button>
                        <div className="flex-1">
                        <InputSection 
                            onGenerate={handleGenerate} 
                            onEnhance={handleEnhance}
                            loading={loading} 
                            isRefinement={!!svgContent}
                        />
                        </div>
                    </div>

                     {/* Mobile Model Selector & Layers */}
                    <div className="flex flex-col gap-2">
                        <div className="flex bg-gray-800/50 p-1 rounded-xl border border-gray-700">
                            <button 
                                onClick={() => setSelectedModel('gemini-3-flash-preview')}
                                disabled={loading}
                                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
                                    selectedModel === 'gemini-3-flash-preview' 
                                    ? 'bg-gray-700 text-white shadow-sm ring-1 ring-gray-600' 
                                    : 'text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                <Zap className="w-3 h-3" /> Flash
                            </button>
                            <button 
                                onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
                                disabled={loading}
                                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
                                    selectedModel === 'gemini-3.1-pro-preview' 
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/30' 
                                    : 'text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                <BrainCircuit className="w-3 h-3" /> Pro
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
                </div>
          </div>
          
        </div>

        {/* Right Sidebar: Layers */}
        <div 
            className={`
                fixed inset-y-0 right-0 w-72 bg-gray-900 border-l border-gray-800 transform transition-transform duration-300 ease-in-out z-30 lg:relative lg:translate-x-0
                ${showLayers ? 'translate-x-0' : 'translate-x-full lg:hidden'}
            `}
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
        </div>

      </main>
    </div>
  );
};

export default App;