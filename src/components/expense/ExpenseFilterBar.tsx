import React from 'react';
import { Search, Filter } from 'lucide-react';
import type { Category, Wallet } from '../../types';

interface Props {
  search: string;
  setSearch: (s: string) => void;
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
  search,
  setSearch,
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
  statusFilter,
  flowFilter,
  categories,
  wallets,
  onClearAll,
}) => {
  const isFiltered = search || catFilter || typeFilter || statusFilter || flowFilter || walletFilter || sort !== 'date-desc';

  return (
    <div className="filter-bar">
      <div className="search-input-wrap">
        <Search size={16} className="search-icon" />
        <input
          className="form-input"
          placeholder="Search expenses…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          type="button"
          className={`filter-toggle-btn ${showFilters || activeFilterCount > 0 ? 'active' : ''}`}
          onClick={() => setShowFilters(prev => !prev)}
          title="Toggle filters"
        >
          <Filter size={16} />
          {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
        </button>
      </div>

      {(showFilters || activeFilterCount > 0) && (
        <div className="filter-scroll-row" style={{ animation: 'fadein 0.15s ease' }}>
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
              style={{ fontSize: 11.5, padding: '4px 10px', whiteSpace: 'nowrap' }}
              onClick={onClearAll}
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
};
