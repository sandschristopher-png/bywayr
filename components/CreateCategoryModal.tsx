// components/CreateCategoryModal.tsx
'use client';

import { useState } from 'react';
import { createCustomCategory, CustomCategory } from '@/lib/categories';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated: (category: CustomCategory) => void;
}

const PRESET_COLORS = [
  '#2563eb', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
];

const PRESET_ICONS = ['📍', '☕', '🍸', '🌅', '🌲', '🎨', '📸', '✨'];

export default function CreateCategoryModal({ isOpen, onClose, onCategoryCreated }: Props) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(PRESET_ICONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const newCat = await createCustomCategory(name.trim(), selectedIcon, selectedColor);
      onCategoryCreated(newCat);
      setName('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-6 text-white shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">New Custom Category</h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-xs text-red-400 bg-red-950/40 border border-red-800 p-2 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Category Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Speakeasies, Rooftops"
              maxLength={30}
              required
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Icon
            </label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_ICONS.map((icon) => (
                <button
                  type="button"
                  key={icon}
                  onClick={() => setSelectedIcon(icon)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition ${
                    selectedIcon === icon
                      ? 'bg-blue-600 ring-2 ring-blue-400'
                      : 'bg-neutral-800 hover:bg-neutral-700'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Accent Color
            </label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    selectedColor === color ? 'scale-125 ring-2 ring-white' : 'opacity-80'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-sm font-medium hover:bg-neutral-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}