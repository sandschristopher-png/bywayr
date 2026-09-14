'use client';

import { useState } from 'react';
import { CustomCategory, deleteCustomCategory } from '@/lib/categories';
import { Settings, Trash2, X, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  categories: CustomCategory[];
  onClose: () => void;
  onCategoryDeleted: (categoryId: string) => void;
}

export default function ManageCategoriesModal({
  isOpen,
  categories,
  onClose,
  onCategoryDeleted,
}: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async (cat: CustomCategory) => {
    if (!confirm(`Delete category "${cat.name}"? Spots will remain but lose this tag.`)) return;

    setDeletingId(cat.id);
    try {
      await deleteCustomCategory(cat.id);
      onCategoryDeleted(cat.id);
    } catch (err) {
      console.error('Failed to delete category:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="animate-fade-in fixed inset-0 z-[100010] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="animate-scale-up w-full max-w-sm rounded-3xl border border-neutral-800 bg-neutral-900 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-800 text-neutral-300">
              <Settings className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Manage Categories</h3>
              <p className="text-xs text-neutral-400">{categories.length} custom categories</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {categories.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-400">
            No custom categories created yet.
          </div>
        ) : (
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1 my-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-800/50 px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{cat.icon || '📍'}</span>
                  <span className="text-xs font-semibold text-neutral-200">{cat.name}</span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: cat.color || '#2563eb' }}
                  />
                </div>

                <button
                  type="button"
                  disabled={deletingId === cat.id}
                  onClick={() => handleDelete(cat)}
                  className="rounded-lg p-1.5 text-neutral-500 hover:bg-red-950/40 hover:text-red-400 transition"
                  title="Delete category"
                >
                  {deletingId === cat.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-red-400" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl bg-neutral-800 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}