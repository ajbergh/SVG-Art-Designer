import React from 'react';
import { PenTool, Settings } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
          <PenTool className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            SVG Art Designer
          </h1>
          <p className="text-xs text-gray-500 font-medium tracking-wide">AI-POWERED VECTOR GENERATION</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSettings}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          title="Settings"
          aria-label="Open settings"
        >
          <Settings className="w-5 h-5" />
        </button>
        <div className="hidden sm:block">
          <span className="px-3 py-1 text-xs font-semibold text-indigo-300 bg-indigo-900/30 rounded-full border border-indigo-500/30">
            Powered by Gemini 3
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
