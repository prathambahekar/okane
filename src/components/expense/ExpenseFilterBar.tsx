import React from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import type { Category, Wallet } from '../../types';

interface Props {
  search?: string;
  setSearch?: (s: string) => void;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  activeFilterCount: number;
  catFilter: string;
  setCatFilter: (c: string) => void;
  typeFilter: string;
  setTypeFilter: (t: string) => void;
  walletFilter: string;
  setWalletFilter: (w: string) => void;
  sort: string;
  setSort: (s: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  flowFilter: string;
  setFlowFilter: (f: string) => void;
  categories: Category[];
  wallets: Wallet[];
  onClearAll: () => void;
}

export const ExpenseFilterBar: React.FC<Props> = ({
  showFilters,
  setShowFilters,
  activeFilterCount,
  catFilter,
  setCatFilter,
  typeFilter,
  setTypeFilter,
  walletFilter,
  setWalletFilter,
  sort,
  setSort,
  categories,
  wallets,
  onClearAll,
}) => {
  const isFiltered = catFilter || typeFilter || walletFilter || sort !== 'date-desc';

  return (
    <div className="filter-bar" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
        <button
          type="button"
          className={`btn ${showFilters || activeFilterCount > 0 ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            height: 32,
            padding: '0 12px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 'var(--radius)',
            gap: 6,
            display: 'inline-flex',
            alignItems: 'center',
          }}
          onClick={() => setShowFilters(prev => !prev)}
          title="Toggle filters"
        >
          <SlidersHorizontal size={14} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span
              style={{
                backgroundColor: 'var(--accent-contrast, #ffffff)',
                color: 'var(--accent)',
                fontSize: 10,
                fontWeight: 700,
                borderRadius: '10px',
                padding: '1px 6px',
                lineHeight: 1.2,
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Quick Active Filters Scroll Row */}
        {(showFilters || activeFilterCount > 0) && (
          <div className="filter-scroll-row" style={{ animation: 'fadein 0.15s ease', flex: 1, marginLeft: 6 }}>
            <select className="filter-pill-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">Category: All</option>
              {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>

            <select className="filter-pill-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">Type: All</option>
              <option value="personal">Personal</option>
              <option value="for_friend">For Friend</option>
              <option value="by_friend">By Friend</option>
            </select>

            <select className="filter-pill-select" value={walletFilter} onChange={e => setWalletFilter(e.target.value)}>
              <option value="">Wallet: All</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>

            <select className="filter-pill-select" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="date-desc">Sort: Latest</option>
              <option value="date-asc">Sort: Oldest</option>
              <option value="amount-desc">Sort: Highest</option>
              <option value="amount-asc">Sort: Lowest</option>
            </select>

            {isFiltered && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11.5, padding: '4px 8px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={onClearAll}
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

