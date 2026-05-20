import React from 'react';
import { PenTool, Settings } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  return (
    <header className="flex items-center justify-between px-6 py-4 glass-header z-30">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30 ring-1 ring-white/10 scale-100 hover:scale-105 transition-all">
          <PenTool className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-100 to-gray-400">
            SVG Art Designer
          </h1>
          <p className="text-[10px] text-indigo-400/80 font-bold tracking-widest uppercase">AI-Powered Vector Studio</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSettings}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800/40 rounded-xl transition-all rotate-hover-container border border-transparent hover:border-gray-800"
          title="Settings (Ctrl+,)"
          aria-label="Open settings"
        >
          <Settings className="w-5 h-5 rotate-hover transition-transform" />
        </button>
        <div className="hidden sm:block">
          <span className="px-3 py-1.5 text-xs font-bold text-indigo-200 bg-indigo-950/45 rounded-full border border-indigo-500/40 pulse-glow-badge backdrop-blur-sm">
            Gemini 3.5 Flash Premium
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
