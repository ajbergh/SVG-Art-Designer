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
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Art Style</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {styles.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            disabled={disabled}
            className={`
              flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 border
              ${selectedStyle === item.id 
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/50 scale-105' 
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750 hover:border-gray-600 hover:text-gray-200'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <item.icon className={`w-5 h-5 mb-2 ${selectedStyle === item.id ? 'text-white' : 'text-gray-500'}`} />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StyleSelector;
