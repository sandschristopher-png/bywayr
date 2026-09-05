'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';

interface EmptyStateProps {
  category?: string;
  onResetFilter?: () => void;
  onAddSpot?: () => void;
  onClose?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  category,
  onResetFilter,
  onAddSpot,
  onClose,
}) => {
  return (
    <div className="absolute top-[205px] left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-sm rounded-2xl bg-white/95 p-5 shadow-lg backdrop-blur-sm border border-neutral-100 text-center transition-all animate-in fade-in zoom-in-95">
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          className="absolute top-3 right-3 rounded-full bg-neutral-100 p-1.5 text-neutral-400 hover:text-neutral-700 transition-colors"
          title="Dismiss / Show All"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      <h3 className="text-base font-semibold text-neutral-900 pr-6 pl-6">
        No unmapped spots here yet
      </h3>

      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
        {category && category !== 'All' ? (
          <>
            No places found under <span className="font-medium text-neutral-700">"{category}"</span> in this area.
          </>
        ) : (
          'Be the first explorer to plot a hidden gem or local favorite around this area.'
        )}
      </p>

      <div className="mt-4 flex items-center justify-center gap-2">
        {category && category !== 'All' && onResetFilter && (
          <button
            onClick={onResetFilter}
            type="button"
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Show All Spots
          </button>
        )}
        {onAddSpot && (
          <button
            onClick={onAddSpot}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#e05a47] px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#c94d3c] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Drop a Pin
          </button>
        )}
      </div>
    </div>
  );
};