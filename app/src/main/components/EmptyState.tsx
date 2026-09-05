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
    <div
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '20px',
        padding: '16px 20px',
        boxShadow: '0 20px 40px -15px rgba(28, 25, 23, 0.08), 0 0 1px 1px rgba(28, 25, 23, 0.04)',
        border: '1px solid #e7e5e4',
        textAlign: 'center',
      }}
    >
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            border: 'none',
            background: '#f5f5f4',
            borderRadius: '50%',
            width: '26px',
            height: '26px',
            cursor: 'pointer',
            color: '#78716c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Dismiss / Show All"
        >
          <X style={{ width: '14px', height: '14px' }} />
        </button>
      )}

      <h3
        style={{
          margin: '0 0 4px 0',
          fontSize: '15px',
          fontWeight: 700,
          color: '#1c1917',
          letterSpacing: '-0.02em',
          padding: '0 24px',
        }}
      >
        No unmapped spots here yet
      </h3>

      <p
        style={{
          margin: '0 0 12px 0',
          fontSize: '12px',
          color: '#78716c',
          lineHeight: 1.35,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {category && category !== 'All' ? (
          <>
            No spots in <span style={{ fontWeight: 600, color: '#44403c' }}>"{category}"</span> nearby.
          </>
        ) : (
          'Be the first to plot a hidden gem here.'
        )}
      </p>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
        {category && category !== 'All' && onResetFilter && (
          <button
            onClick={onResetFilter}
            type="button"
            style={{
              padding: '7px 12px',
              backgroundColor: '#f5f5f4',
              color: '#44403c',
              border: '1px solid #e7e5e4',
              borderRadius: '12px',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Show All Spots
          </button>
        )}
        {onAddSpot && (
          <button
            onClick={onAddSpot}
            type="button"
            style={{
              padding: '7px 14px',
              backgroundColor: '#e05a47',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 8px rgba(224, 90, 71, 0.3)',
            }}
          >
            <Plus style={{ width: '13px', height: '13px' }} /> Drop a Pin
          </button>
        )}
      </div>
    </div>
  );
};