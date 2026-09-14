'use client';

import { useState, useEffect } from 'react';
import { CustomCategory, getSpotCategoryIds, tagSpotWithCategories } from '@/lib/categories';
import { Tag, Check, X, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  spotId?: string;
  spotName: string;
  categories: CustomCategory[];
  onClose: () => void;
  onTagsUpdated?: (selectedCategoryIds: string[]) => void;
}

export default function SpotTagModal({
  isOpen,
  spotId,
  spotName,
  categories,
  onClose,
  onTagsUpdated,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !spotId) return;

    let isMounted = true;
    setLoading(true);

    getSpotCategoryIds(spotId)
      .then((ids) => {
        if (isMounted) setSelectedIds(ids);
      })
      .catch((err) => console.error('Failed to load spot tags:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, spotId]);

  if (!isOpen || !spotId) return null;

  const toggleCategory = (catId: string) => {
    setSelectedIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await tagSpotWithCategories(spotId, selectedIds);
      if (onTagsUpdated) onTagsUpdated(selectedIds);
      onClose();
    } catch (err) {
      console.error('Failed to update tags:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in fixed inset-0 z-[100010] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="animate-scale-up w-full max-w-sm rounded-3xl border border-neutral-800 bg-neutral-900 p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-white line-clamp-1">
                Tag Spot
              </h3>
              <p className="text-xs text-neutral-400 line-clamp-1">{spotName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : categories.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-neutral-400">
              You haven&apos;t created any custom categories yet.
            </p>
          </div>
        ) : (
          <div className="my-4 max-h-60 space-y-2 overflow-y-auto pr-1">
            {categories.map((cat) => {
              const isChecked = selectedIds.includes(cat.id);
              return (
                <div
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                    isChecked
                      ? 'border-neutral-700 bg-neutral-800'
                      : 'border-neutral-800/80 bg-neutral-900/60 hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{cat.icon || '📍'}</span>
                    <span className="text-xs font-semibold text-neutral-200">{cat.name}</span>
                  </div>

                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                      isChecked
                        ? 'border-transparent text-white'
                        : 'border-neutral-700 bg-transparent'
                    }`}
                    style={{ backgroundColor: isChecked ? cat.color || '#e05a47' : undefined }}
                  >
                    {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-neutral-800 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading || categories.length === 0}
            onClick={handleSave}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-orange-600/20 hover:bg-orange-500 disabled:opacity-50 transition"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Tags'}
          </button>
        </div>
      </div>
    </div>
  );
}