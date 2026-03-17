import React, { useState } from 'react';
import { templates, templateCategories, Template } from '../data/templates';
import { X, LayoutGrid, Search } from 'lucide-react';

interface TemplateGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: Template) => void;
}

const TemplateGallery: React.FC<TemplateGalleryProps> = ({ isOpen, onClose, onSelect }) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = templates.filter(t => {
    const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
    const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4" role="dialog" aria-modal="true" aria-labelledby="template-gallery-title" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white" id="template-gallery-title">Template Gallery</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors" aria-label="Close template gallery">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search + Categories */}
        <div className="p-4 space-y-3 border-b border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {['All', ...templateCategories].map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Template Grid */}
        <div className="p-4 overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No templates found.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onSelect(t); onClose(); }}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 text-left hover:border-indigo-500/50 hover:bg-gray-800 transition-all group"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-medium text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded">{t.style}</span>
                  </div>
                  <h3 className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">{t.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateGallery;
