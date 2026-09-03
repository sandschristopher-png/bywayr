'use client';

import React from 'react';
import { Compass, Plus } from 'lucide-react';

interface EmptyStateProps {
  category?: string;
  onResetFilter?: () => void;
  onAddSpot?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  category,
  onResetFilter,
  onAddSpot,
}) => {
  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-sm rounded-2xl bg-white/95 p-5 shadow-lg backdrop-blur-sm border border-neutral-100 text-center transition-all animate-in fade-in zoom-in-95">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
        <Compass className="h-6 w-6 stroke-[1.75]" />
      </div>

      <h3 className="text-base font-semibold text-neutral-900">
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-600 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Drop a Pin
          </button>
        )}
      </div>
    </div>
  );
};