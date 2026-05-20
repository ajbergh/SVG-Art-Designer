import React, { useState, KeyboardEvent } from 'react';
import { Send, Sparkles, Wand2, LayoutGrid, Layers } from 'lucide-react';

interface InputSectionProps {
  onGenerate: (prompt: string) => void;
  onEnhance: (prompt: string) => Promise<string>;
  loading: boolean;
  isRefinement: boolean;
  onOpenTemplates?: () => void;
  onBatchGenerate?: (prompt: string) => void;
}

const InputSection: React.FC<InputSectionProps> = ({ onGenerate, onEnhance, loading, isRefinement, onOpenTemplates, onBatchGenerate }) => {
  const [prompt, setPrompt] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleSubmit = () => {
    if (!prompt.trim() || loading || isEnhancing) return;
    onGenerate(prompt);
    setPrompt('');
  };

  const handleEnhance = async () => {
    if (!prompt.trim() || isEnhancing || loading) return;
    setIsEnhancing(true);
    try {
        const enhanced = await onEnhance(prompt);
        setPrompt(enhanced);
    } catch (e) {
        // Fail silently or show toast
    } finally {
        setIsEnhancing(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/15 via-violet-500/10 to-purple-500/15 rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative bg-gray-900/90 backdrop-blur-md rounded-2xl border border-gray-800 shadow-xl overflow-hidden glow-focus-within">
        <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRefinement ? "Ask for changes (e.g., 'Make it blue', 'Add a background')..." : "Describe what you want to design..."}
            className="w-full bg-transparent text-white p-4 pr-16 min-h-[95px] max-h-[160px] resize-none focus:outline-none placeholder-gray-600 text-sm sm:text-base leading-relaxed"
            disabled={loading || isEnhancing}
        />
        
        {/* Actions Toolbar positioned absolute bottom right */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
            
            {/* Templates Button */}
            {onOpenTemplates && !isRefinement && (
                <button
                    onClick={onOpenTemplates}
                    disabled={loading}
                    className="p-2.5 rounded-xl bg-gray-850 text-indigo-400 hover:bg-indigo-950/30 hover:text-indigo-300 border border-gray-800 scale-hover"
                    title="Browse templates"
                >
                    <LayoutGrid className="w-4 h-4" />
                </button>
            )}

            {/* Batch Generate Button */}
            {onBatchGenerate && prompt.trim().length > 3 && !isRefinement && (
                <button
                    onClick={() => { onBatchGenerate(prompt); setPrompt(''); }}
                    disabled={loading || isEnhancing}
                    className="p-2.5 rounded-xl bg-gray-850 text-amber-400 hover:bg-amber-950/30 hover:text-amber-300 border border-gray-800 scale-hover"
                    title="Generate 4 variations"
                >
                    <Layers className="w-4 h-4" />
                </button>
            )}

            {/* Enhance Button */}
            {prompt.trim().length > 3 && !isRefinement && (
                <button
                    onClick={handleEnhance}
                    disabled={loading || isEnhancing}
                    className="p-2.5 rounded-xl bg-gray-850 text-purple-400 hover:bg-purple-950/30 hover:text-purple-300 border border-gray-800 scale-hover"
                    title="Enhance prompt with AI"
                >
                     <Wand2 className={`w-4 h-4 ${isEnhancing ? 'animate-spin text-purple-300' : ''}`} />
                </button>
            )}

            {/* Send Button */}
            <button
            onClick={handleSubmit}
            disabled={!prompt.trim() || loading || isEnhancing}
            title="Generate SVG Design"
            aria-label="Generate SVG Design"
            className={`
                p-2.5 rounded-xl flex items-center justify-center scale-hover
                ${!prompt.trim() || loading || isEnhancing
                ? 'bg-gray-850 text-gray-600 cursor-not-allowed border border-gray-800/60' 
                : 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/35 border border-indigo-500/20'
                }
            `}
            >
            {loading ? (
                <Sparkles className="w-4 h-4 animate-spin text-white pulse-loader" />
            ) : (
                <Send className="w-4 h-4" />
            )}
            </button>
        </div>
        </div>
        <div className="mt-2 flex justify-between items-center px-1">
             <p className="text-xs text-gray-500 flex items-center gap-1">
                {isRefinement ? "Refining previous design" : "Ready for a new design"}
                {isEnhancing && <span className="text-purple-400 animate-pulse">- Enhancing prompt...</span>}
             </p>
             <span className="text-xs text-gray-600">Press Enter to send</span>
        </div>
    </div>
  );
};

export default InputSection;
