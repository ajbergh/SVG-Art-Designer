import React from 'react';
import { Eye, Layers, Code, History, Sparkles } from 'lucide-react';

export type MobileTab = 'preview' | 'layers' | 'code' | 'history';

interface MobileTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onGenerate: () => void;
  loading: boolean;
}

const tabs: { id: MobileTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'preview', label: 'Preview', Icon: Eye },
  { id: 'layers', label: 'Layers', Icon: Layers },
  { id: 'code', label: 'Code', Icon: Code },
  { id: 'history', label: 'History', Icon: History },
];

const MobileTabBar: React.FC<MobileTabBarProps> = ({ activeTab, onTabChange, onGenerate, loading }) => {
  return (
    <>
      {/* FAB - Generate button */}
      <button
        onClick={onGenerate}
        disabled={loading}
        className="lg:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-900/40 flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform"
        aria-label="Generate design"
      >
        <Sparkles className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
      </button>

      {/* Tab bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 bg-gray-900 border-t border-gray-700 flex z-40 safe-area-inset-bottom"
        aria-label="Mobile navigation"
      >
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors min-h-[48px] ${
              activeTab === id
                ? 'text-indigo-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            aria-label={label}
            role="tab"
            aria-selected={activeTab === id}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
};

export default MobileTabBar;
