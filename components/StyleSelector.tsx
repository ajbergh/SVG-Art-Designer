import React from 'react';
import { ArtStyle } from '../types';
import { Palette, Zap, Smile, Pen, Box, Layers, Grid, Activity, Ban } from 'lucide-react';

interface StyleSelectorProps {
  selectedStyle: ArtStyle;
  onSelect: (style: ArtStyle) => void;
  disabled: boolean;
}

const styles = [
  { id: ArtStyle.NO_STYLE, icon: Ban, label: 'None' },
  { id: ArtStyle.ICON, icon: Zap, label: 'Icon' },
  { id: ArtStyle.FLAT, icon: Layers, label: 'Flat' },
  { id: ArtStyle.CARTOON, icon: Smile, label: 'Cartoon' },
  { id: ArtStyle.LINE_ART, icon: Pen, label: 'Line Art' },
  { id: ArtStyle.LOGO, icon: Box, label: 'Logo' },
  { id: ArtStyle.ABSTRACT, icon: Activity, label: 'Abstract' },
  { id: ArtStyle.GRADIENT, icon: Palette, label: 'Gradient' },
  { id: ArtStyle.PIXEL, icon: Grid, label: 'Pixel' },
];

const StyleSelector: React.FC<StyleSelectorProps> = ({ selectedStyle, onSelect, disabled }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest pl-1">Art Style</h3>
      <div className="grid grid-cols-3 gap-2">
        {styles.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            disabled={disabled}
            className={`
              style-card flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-300 border
              ${selectedStyle === item.id 
                ? 'style-card-selected' 
                : 'bg-gray-900/30 border-gray-800/60 text-gray-400 hover:border-indigo-500/30 hover:text-indigo-200 hover:-translate-y-0.5'
              }
              ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <item.icon className={`w-4 h-4 mb-2 transition-transform duration-300 ${selectedStyle === item.id ? 'text-white scale-110' : 'text-gray-500'}`} />
            <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StyleSelector;
