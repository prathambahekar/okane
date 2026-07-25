import { useState, useRef } from 'react';
import { useColorMode } from '../theme';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import { useStore } from '../store';
import { CURRENCIES, DEFAULT_CATEGORIES, FRIEND_PALETTE } from '../db';
import type { Category, AppDB } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Settings() {
  const { db, updateSettings, resetDB, restoreDB, loadSampleData, showToast } = useStore();
  const { settings } = db;
  const fileRef = useRef<HTMLInputElement>(null);
  const [showReset, setShowReset] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(FRIEND_PALETTE[0]);
  const { mode, toggleMode } = useColorMode();
  const isDark = mode === 'dark';

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    if (settings.categories.some(c => c.name.toLowerCase() === newCatName.trim().toLowerCase())) {
      showToast('Category already exists.');
      return;
    }
    updateSettings({ categories: [...settings.categories, { name: newCatName.trim(), color: newCatColor }] });
    setNewCatName('');
  };

  const handleDeleteCategory = (name: string) => {
    if (settings.categories.length <= 1) { showToast('Must have at least one category.'); return; }
    updateSettings({
      categories: settings.categories.filter(c => c.name !== name),
      defaultCategory: settings.defaultCategory === name ? settings.categories[0]?.name ?? '' : settings.defaultCategory,
    });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Data exported successfully');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as AppDB;
        if (!data.expenses || !data.friends || !data.settings) throw new Error('Invalid format');
        restoreDB(data);
        showToast('Data imported successfully');
      } catch {
        showToast('Invalid file format. Please use a valid Okane backup.');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleReset = () => {
    resetDB();
    setShowReset(false);
    showToast('All data cleared');
  };

  const handleLoadSample = () => {
    loadSampleData();
    showToast('Sample data loaded');
  };

  return (
    <div className="view-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Preferences and data management</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Appearance */}
        <div className="card">
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Appearance</h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>Dark Mode</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Use dark theme for the interface</div>
            </div>
            <Switch
              checked={isDark}
              onChange={() => toggleMode()}
              color="primary"
              inputProps={{ 'aria-label': 'dark mode toggle' }}
            />
          </div>
        </div>
        {/* Preferences */}
        <div className="card">
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Preferences</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select className="form-select" value={settings.currency} onChange={e => updateSettings({ currency: e.target.value })}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Default Category</label>
              <select className="form-select" value={settings.defaultCategory} onChange={e => updateSettings({ defaultCategory: e.target.value })}>
                {settings.categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Default Expense Status</label>
              <select className="form-select" value={settings.defaultStatus} onChange={e => updateSettings({ defaultStatus: e.target.value as 'paid' | 'unpaid' })}>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Default Wallet</label>
              <select className="form-select" value={settings.defaultWalletId} onChange={e => updateSettings({ defaultWalletId: e.target.value })}>
                {db.wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="card">
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Categories</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {settings.categories.map((c: Category) => (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <span className="cat-dot" style={{ background: c.color }} />
                <span style={{ fontSize: 12.5 }}>{c.name}</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, display: 'flex', fontSize: 14 }}
                  onClick={() => handleDeleteCategory(c.name)}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="form-input" style={{ flex: 1 }} value={newCatName} onChange={e => setNewCatName(e.target.value)}
              placeholder="New category name" onKeyDown={e => e.key === 'Enter' && handleAddCategory()} />
            <div className="color-swatch-grid" style={{ flexWrap: 'nowrap' }}>
              {FRIEND_PALETTE.slice(0, 6).map(c => (
                <button key={c} type="button" className={`color-swatch ${newCatColor === c ? 'selected' : ''}`}
                  style={{ background: c }} onClick={() => setNewCatColor(c)} />
              ))}
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleAddCategory}><AddIcon fontSize="small" /> Add</button>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
              onClick={() => updateSettings({ categories: [...DEFAULT_CATEGORIES] })}>
              Reset to defaults
            </button>
          </div>
        </div>

        {/* Data Management */}
        <div className="card">
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Data Management</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>All data is stored locally in your browser.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}><DownloadIcon fontSize="small" /> Export JSON</button>
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}><UploadIcon fontSize="small" /> Import JSON</button>
            <button className="btn btn-secondary btn-sm" onClick={handleLoadSample}>Load Sample Data</button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--debit)', marginBottom: 6 }}>Danger Zone</h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 10 }}>
              This will permanently delete all expenses, friends, wallets, and settlements.
            </p>
            <button className="btn btn-danger btn-sm" onClick={() => setShowReset(true)}>Reset All Data</button>
          </div>
        </div>

        {/* About */}
        <div className="card">
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>About Okane</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.7 }}>
            Okane is a personal expense tracker with friend debt management. Track your spending,
            manage shared expenses with friends, and stay on top of who owes whom.
          </p>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 20 }}>
            <span>{db.expenses.length} expenses</span>
            <span>{db.friends.length} friends</span>
            <span>{db.wallets.length} wallets</span>
            <span>{db.settlements.length} settlements</span>
          </div>
        </div>
      </div>

      {showReset && (
        <ConfirmDialog title="Reset All Data"
          message="This will permanently delete ALL your data including expenses, friends, wallets, and settlements. This cannot be undone."
          confirmLabel="Reset Everything"
          onConfirm={handleReset} onClose={() => setShowReset(false)} />
      )}
    </div>
  );
}
