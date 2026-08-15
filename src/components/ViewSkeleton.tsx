import React from 'react';

export type ViewSkeletonType =
  | 'recurring'
  | 'settlements'
  | 'split-trips'
  | 'analytics'
  | 'settings'
  | 'dev-sql'
  | 'table'
  | 'cards'
  | 'dashboard'
  | 'friends'
  | 'general';

export interface ViewSkeletonProps {
  type?: ViewSkeletonType;
}

/** Helper component for a styled shimmer bar/box */
const Shimmer: React.FC<{
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
  className?: string;
}> = ({ width = '100%', height = 16, borderRadius = 6, style = {}, className = '' }) => (
  <div
    className={`sk-shimmer ${className}`}
    style={{
      width,
      height,
      borderRadius,
      ...style,
    }}
  />
);

/* ==========================================================================
   1. Recurring / Autopay Skeleton
   ========================================================================== */
const SkeletonRecurring: React.FC = () => (
  <div className="view-container">
    {/* Header */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Shimmer width={120} height={28} borderRadius={8} />
      </div>

      {/* Side-by-side Search Bar + Add New Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <div style={{ flex: 1 }}>
          <Shimmer height={38} borderRadius={10} />
        </div>
        <Shimmer width={100} height={38} borderRadius={10} />
      </div>
    </div>

    {/* Metric Card: Subscription Spend */}
    <div style={{ marginBottom: 16 }}>
      <div className="card" style={{ padding: '14px 16px', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Shimmer width={140} height={12} borderRadius={4} />
          <Shimmer width={16} height={16} borderRadius="50%" />
        </div>
        <Shimmer width={120} height={26} borderRadius={6} />
      </div>
    </div>

    {/* Tabs: Subscriptions vs Logs vs All */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <Shimmer width={130} height={32} borderRadius={16} />
      <Shimmer width={100} height={32} borderRadius={16} />
      <Shimmer width={70} height={32} borderRadius={16} />
    </div>

    {/* Subscription Cards List */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1, 2, 3, 4].map(idx => (
        <div
          key={idx}
          className="card"
          style={{
            padding: '12px 14px',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <Shimmer width={40} height={40} borderRadius={10} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shimmer width="45%" height={15} borderRadius={4} />
                <Shimmer width={50} height={16} borderRadius={10} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shimmer width={65} height={12} borderRadius={4} />
                <Shimmer width={80} height={12} borderRadius={4} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <Shimmer width={70} height={18} borderRadius={4} />
            <Shimmer width={50} height={12} borderRadius={4} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ==========================================================================
   2. Settlements Skeleton
   ========================================================================== */
const SkeletonSettlements: React.FC = () => (
  <div className="view-container">
    {/* Header */}
    <div className="page-header" style={{ marginBottom: 20 }}>
      <Shimmer width={150} height={28} borderRadius={8} />
    </div>

    {/* Pending Settlements Section */}
    <div
      className="card"
      style={{
        marginBottom: 20,
        padding: '14px 16px',
        borderRadius: 12,
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shimmer width={28} height={28} borderRadius={8} />
          <Shimmer width={150} height={16} borderRadius={4} />
          <Shimmer width={24} height={18} borderRadius={12} />
        </div>
        <Shimmer width={24} height={24} borderRadius={6} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
        {[1, 2].map(k => (
          <div
            key={k}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '10px 12px',
              background: 'var(--surface2)',
              borderRadius: 10,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
              <Shimmer width={34} height={34} borderRadius="50%" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <Shimmer width="70%" height={13} borderRadius={4} />
                <Shimmer width="50%" height={11} borderRadius={4} />
              </div>
            </div>
            <Shimmer width={55} height={26} borderRadius={6} />
          </div>
        ))}
      </div>
    </div>

    {/* Search & Filter Toolbar */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
      <Shimmer height={38} borderRadius={10} />
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        <Shimmer width={100} height={28} borderRadius={14} />
        <Shimmer width={80} height={28} borderRadius={14} />
        <Shimmer width={80} height={28} borderRadius={14} />
        <Shimmer width={90} height={28} borderRadius={14} />
      </div>
    </div>

    {/* Settlements History List */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2].map(g => (
        <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <Shimmer width={110} height={14} borderRadius={4} />
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          {[1, 2].map(idx => (
            <div
              key={idx}
              className="card"
              style={{
                padding: '12px 14px',
                background: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Shimmer width={36} height={36} borderRadius="50%" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Shimmer width={120} height={14} borderRadius={4} />
                  <Shimmer width={80} height={11} borderRadius={4} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shimmer width={70} height={18} borderRadius={4} />
                <Shimmer width={24} height={24} borderRadius={6} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

/* ==========================================================================
   3. Split Trips Skeleton
   ========================================================================== */
const SkeletonSplitTrips: React.FC = () => (
  <div className="view-container">
    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <Shimmer width={140} height={28} borderRadius={8} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Shimmer width={90} height={32} borderRadius={8} />
        <Shimmer width={100} height={32} borderRadius={8} />
      </div>
    </div>

    {/* Active Trip Hero Banner Card */}
    <div
      className="card"
      style={{
        padding: '16px',
        marginBottom: 16,
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shimmer width={36} height={36} borderRadius={10} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Shimmer width={160} height={18} borderRadius={4} />
            <Shimmer width={100} height={12} borderRadius={4} />
          </div>
        </div>
        <Shimmer width={70} height={22} borderRadius={12} />
      </div>

      {/* Stats row inside trip banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
          <Shimmer width={60} height={10} borderRadius={3} style={{ marginBottom: 4 }} />
          <Shimmer width={80} height={18} borderRadius={4} />
        </div>
        <div style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
          <Shimmer width={75} height={10} borderRadius={3} style={{ marginBottom: 4 }} />
          <Shimmer width={80} height={18} borderRadius={4} />
        </div>
        <div style={{ background: 'var(--surface2)', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
          <Shimmer width={50} height={10} borderRadius={3} style={{ marginBottom: 4 }} />
          <Shimmer width={60} height={18} borderRadius={4} />
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Shimmer height={42} borderRadius={12} />
        </div>
        <div style={{ flex: 1 }}>
          <Shimmer height={42} borderRadius={12} />
        </div>
      </div>
    </div>

    {/* Expenses Log Section */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
        <Shimmer width={150} height={16} borderRadius={4} />
        <Shimmer width={70} height={14} borderRadius={4} />
      </div>

      {[1, 2, 3].map(idx => (
        <div
          key={idx}
          className="card"
          style={{
            padding: '12px 14px',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Shimmer width={36} height={36} borderRadius={8} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Shimmer width={130} height={14} borderRadius={4} />
              <div style={{ display: 'flex', gap: 6 }}>
                <Shimmer width={60} height={11} borderRadius={4} />
                <Shimmer width={80} height={11} borderRadius={4} />
              </div>
            </div>
          </div>
          <Shimmer width={70} height={18} borderRadius={4} />
        </div>
      ))}
    </div>
  </div>
);

/* ==========================================================================
   4. Analytics Skeleton
   ========================================================================== */
const SkeletonAnalytics: React.FC = () => (
  <div className="view-container" style={{ paddingBottom: 24 }}>
    {/* Header */}
    <div className="page-header" style={{ marginBottom: 12 }}>
      <Shimmer width={130} height={28} borderRadius={8} />
    </div>

    {/* Filter Pills */}
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      <Shimmer width={120} height={26} borderRadius={99} />
      <Shimmer width={100} height={26} borderRadius={99} />
    </div>

    {/* Spending Bar Chart Card */}
    <div className="card" style={{ padding: '16px', marginBottom: 16, background: 'var(--surface)' }}>
      {/* Chart Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shimmer width={140} height={18} borderRadius={4} />
          <Shimmer width={100} height={24} borderRadius={6} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shimmer width={85} height={24} borderRadius={6} />
          <Shimmer width={120} height={26} borderRadius={8} />
        </div>
      </div>

      {/* Chart Columns Placeholder */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
          height: 160,
          paddingTop: 16,
          paddingBottom: 6,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {[55, 35, 80, 20, 95, 60, 40].map((h, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 36 }}>
            <Shimmer width={28} height={12} borderRadius={3} />
            <div style={{ height: 100, display: 'flex', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
              <Shimmer width={24} height={`${h}%`} borderRadius="4px 4px 0 0" />
            </div>
            <Shimmer width={20} height={10} borderRadius={3} />
          </div>
        ))}
      </div>
    </div>

    {/* 2-Column Grid: Daily Log + Category Share */}
    <div className="dashboard-grid" style={{ gap: 16 }}>
      {/* Daily Log Card */}
      <div className="card" style={{ padding: '14px', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shimmer width={18} height={18} borderRadius="50%" />
            <Shimmer width={140} height={16} borderRadius={4} />
          </div>
          <Shimmer width={60} height={22} borderRadius={6} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map(idx => (
            <div
              key={idx}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shimmer width={14} height={14} borderRadius={4} />
                <Shimmer width={100} height={14} borderRadius={4} />
              </div>
              <Shimmer width={65} height={14} borderRadius={4} />
            </div>
          ))}
        </div>
      </div>

      {/* Category Share Card */}
      <div className="card" style={{ padding: '14px', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Shimmer width={120} height={16} borderRadius={4} />
          <Shimmer width={70} height={14} borderRadius={4} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shimmer width={24} height={24} borderRadius={6} />
                  <Shimmer width={90} height={13} borderRadius={4} />
                </div>
                <Shimmer width={60} height={13} borderRadius={4} />
              </div>
              <Shimmer height={6} borderRadius={3} />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/* ==========================================================================
   5. Settings Skeleton
   ========================================================================== */
const SkeletonSettings: React.FC = () => (
  <div className="view-container">
    {/* Header */}
    <div className="page-header" style={{ marginBottom: 16 }}>
      <Shimmer width={120} height={28} borderRadius={8} />
    </div>

    {/* Profile Card Header */}
    <div className="card" style={{ padding: '16px', marginBottom: 14, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Shimmer width={44} height={44} borderRadius={12} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shimmer width={80} height={18} borderRadius={4} />
              <Shimmer width={45} height={16} borderRadius={6} />
            </div>
            <Shimmer width={140} height={12} borderRadius={4} />
          </div>
        </div>
        <Shimmer width={120} height={32} borderRadius={8} />
      </div>
    </div>

    {/* Structured Settings Summary Cards List */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[
        { title: 150, sub: 180 },
        { title: 160, sub: 140 },
        { title: 155, sub: 160 },
        { title: 140, sub: 120 },
        { title: 150, sub: 170 },
        { title: 165, sub: 130 },
        { title: 130, sub: 150 },
        { title: 140, sub: 140 },
      ].map((item, idx) => (
        <div
          key={idx}
          className="card settings-summary-card"
          style={{
            background: 'var(--surface)',
            padding: '14px 16px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <Shimmer width={36} height={36} borderRadius={10} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <Shimmer width={item.title} height={15} borderRadius={4} />
              <Shimmer width={item.sub} height={12} borderRadius={4} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shimmer width={18} height={18} borderRadius={4} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ==========================================================================
   6. Dev SQL Console Skeleton
   ========================================================================== */
const SkeletonDevSQL: React.FC = () => (
  <div className="view-container">
    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Shimmer width={180} height={26} borderRadius={6} />
        <Shimmer width={40} height={18} borderRadius={8} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Shimmer width={80} height={32} borderRadius={8} />
        <Shimmer width={80} height={32} borderRadius={8} />
      </div>
    </div>

    {/* Database Tables Chips */}
    <div className="card" style={{ padding: '14px 16px', marginBottom: 16, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Shimmer width={120} height={16} borderRadius={4} />
        <Shimmer width={60} height={14} borderRadius={4} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5, 6].map(idx => (
          <Shimmer key={idx} width={100} height={28} borderRadius={6} />
        ))}
      </div>
    </div>

    {/* Query Editor Box */}
    <div className="card" style={{ padding: '16px', marginBottom: 16, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Shimmer width={100} height={16} borderRadius={4} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Shimmer width={75} height={28} borderRadius={6} />
          <Shimmer width={60} height={28} borderRadius={6} />
        </div>
      </div>
      <Shimmer height={100} borderRadius={8} />
    </div>

    {/* Query Results Table */}
    <div className="card" style={{ padding: '14px', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Shimmer width={120} height={16} borderRadius={4} />
        <Shimmer width={80} height={14} borderRadius={4} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3, 4].map(idx => (
          <Shimmer key={idx} height={36} borderRadius={6} />
        ))}
      </div>
    </div>
  </div>
);

/* ==========================================================================
   7. Table / Expenses Skeleton
   ========================================================================== */
const SkeletonTable: React.FC = () => (
  <div className="view-container">
    {/* Header */}
    <div className="page-header" style={{ marginBottom: 16 }}>
      <Shimmer width={130} height={28} borderRadius={8} />
      <Shimmer width={110} height={36} borderRadius={10} />
    </div>

    {/* Filter Toolbar */}
    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <Shimmer height={38} borderRadius={10} />
      </div>
      <Shimmer width={100} height={38} borderRadius={10} />
      <Shimmer width={100} height={38} borderRadius={10} />
    </div>

    {/* Summary Totals */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
      <div className="card" style={{ padding: '12px 14px', background: 'var(--surface)' }}>
        <Shimmer width={80} height={11} borderRadius={3} style={{ marginBottom: 4 }} />
        <Shimmer width={100} height={22} borderRadius={4} />
      </div>
      <div className="card" style={{ padding: '12px 14px', background: 'var(--surface)' }}>
        <Shimmer width={80} height={11} borderRadius={3} style={{ marginBottom: 4 }} />
        <Shimmer width={100} height={22} borderRadius={4} />
      </div>
    </div>

    {/* Expenses Rows */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3, 4, 5, 6].map(idx => (
        <div
          key={idx}
          className="card"
          style={{
            padding: '12px 14px',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Shimmer width={38} height={38} borderRadius={10} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Shimmer width={140} height={15} borderRadius={4} />
              <div style={{ display: 'flex', gap: 6 }}>
                <Shimmer width={60} height={12} borderRadius={4} />
                <Shimmer width={75} height={12} borderRadius={4} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <Shimmer width={65} height={16} borderRadius={4} />
            <Shimmer width={40} height={11} borderRadius={4} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ==========================================================================
   8. Cards / Wallets Skeleton
   ========================================================================== */
const SkeletonCards: React.FC = () => (
  <div className="view-container">
    {/* Header */}
    <div className="page-header" style={{ marginBottom: 16 }}>
      <Shimmer width={110} height={28} borderRadius={8} />
      <Shimmer width={100} height={36} borderRadius={10} />
    </div>

    {/* Net Worth Card */}
    <div className="card" style={{ padding: '16px', marginBottom: 16, background: 'var(--surface)' }}>
      <Shimmer width={80} height={12} borderRadius={3} style={{ marginBottom: 6 }} />
      <Shimmer width={140} height={28} borderRadius={6} />
    </div>

    {/* Wallet Cards Grid */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
      {[1, 2, 3].map(k => (
        <div
          key={k}
          className="card"
          style={{
            padding: '16px',
            background: 'var(--surface)',
            borderRadius: 14,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 120,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Shimmer width={80} height={14} borderRadius={4} />
            <Shimmer width={28} height={28} borderRadius={8} />
          </div>
          <div>
            <Shimmer width={110} height={22} borderRadius={4} style={{ marginBottom: 4 }} />
            <Shimmer width={60} height={11} borderRadius={3} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ==========================================================================
   9. Contacts / Friends Skeleton
   ========================================================================== */
const SkeletonFriends: React.FC = () => (
  <div className="view-container">
    <div className="page-header" style={{ marginBottom: 16 }}>
      <Shimmer width={110} height={28} borderRadius={8} />
      <Shimmer width={100} height={36} borderRadius={10} />
    </div>

    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      <div style={{ flex: 1 }}>
        <Shimmer height={38} borderRadius={10} />
      </div>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3, 4, 5].map(idx => (
        <div
          key={idx}
          className="card"
          style={{
            padding: '12px 14px',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Shimmer width={38} height={38} borderRadius="50%" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Shimmer width={120} height={15} borderRadius={4} />
              <Shimmer width={70} height={11} borderRadius={4} />
            </div>
          </div>
          <Shimmer width={70} height={16} borderRadius={4} />
        </div>
      ))}
    </div>
  </div>
);

/* ==========================================================================
   10. Main Router / View Skeleton Dispatcher
   ========================================================================== */
export const ViewSkeleton: React.FC<ViewSkeletonProps> = ({ type = 'general' }) => {
  switch (type) {
    case 'recurring':
      return <SkeletonRecurring />;
    case 'settlements':
      return <SkeletonSettlements />;
    case 'split-trips':
      return <SkeletonSplitTrips />;
    case 'analytics':
      return <SkeletonAnalytics />;
    case 'settings':
      return <SkeletonSettings />;
    case 'dev-sql':
      return <SkeletonDevSQL />;
    case 'table':
      return <SkeletonTable />;
    case 'cards':
      return <SkeletonCards />;
    case 'friends':
      return <SkeletonFriends />;
    case 'dashboard':
    case 'general':
    default:
      return <SkeletonTable />;
  }
};

export default ViewSkeleton;
