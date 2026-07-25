import { useState, useRef } from 'react';
import { useColorMode } from '../theme';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
// import DownloadIcon from '@mui/icons-material/Download';
// import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import CategoryIcon from '@mui/icons-material/Category';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useStore } from '../store';
import { CURRENCIES, DEFAULT_CATEGORIES, FRIEND_PALETTE } from '../db';
import type { Category, AppDB } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

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



  const handleExport = async () => {
    try {
      const json = JSON.stringify(db, null, 2);
      const fileName = `ledger-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

      // Web
      if (Capacitor.getPlatform() === "web") {
        const blob = new Blob([json], {
          type: "application/json",
        });

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();

        URL.revokeObjectURL(url);

        showToast("Backup downloaded successfully");
        return;
      }

      // Android / iOS native
      try {
        await Filesystem.requestPermissions();
      } catch {
        // Ignore if permissions request isn't implemented/supported
      }

      let savedToDownloadFolder = false;

      // On Android, attempt writing directly to the Download folder on external storage
      if (Capacitor.getPlatform() === "android") {
        try {
          await Filesystem.writeFile({
            path: `Download/${fileName}`,
            data: json,
            directory: Directory.ExternalStorage,
            encoding: Encoding.UTF8,
            recursive: true,
          });
          savedToDownloadFolder = true;
        } catch (e) {
          console.warn("Direct write to ExternalStorage Download folder failed:", e);
        }
      }

      // Write to Cache directory so Share plugin can share the file via FileProvider
      const result = await Filesystem.writeFile({
        path: fileName,
        data: json,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
        recursive: true,
      });

      try {
        await Share.share({
          title: "Ledger Backup",
          text: "Ledger backup file",
          url: result.uri,
          dialogTitle: "Save or Share Backup",
        });
      } catch (shareErr) {
        console.warn("Share sheet dismissed or skipped:", shareErr);
      }

      if (savedToDownloadFolder) {
        showToast("Backup saved to Download folder!");
      } else {
        showToast("Backup created successfully");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to export data");
    }
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CategoryIcon style={{ fontSize: 18, color: 'var(--accent)' }} />
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Categories</h2>
              <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text-2)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, border: '1px solid var(--border)' }}>
                {settings.categories.length}
              </span>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, gap: 4, padding: '4px 8px' }}
              onClick={() => {
                updateSettings({ categories: [...DEFAULT_CATEGORIES] });
                showToast('Reset categories to default');
              }}
            >
              <RefreshIcon style={{ fontSize: 15 }} /> Reset Defaults
            </button>
          </div>

          <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 16 }}>
            Manage category tags used for organizing your spending.
          </p>

          {/* Chips Grid */}
          <div className="category-chip-list">
            {settings.categories.map((c: Category) => (
              <div key={c.name} className="category-chip">
                <span className="category-chip-dot" style={{ background: c.color }} />
                <span>{c.name}</span>
                <button
                  type="button"
                  className="category-chip-delete"
                  title={`Remove ${c.name}`}
                  onClick={() => handleDeleteCategory(c.name)}
                >
                  <CloseIcon style={{ fontSize: 14 }} />
                </button>
              </div>
            ))}
          </div>

          {/* Add Category Section */}
          <div className="category-add-box">
            <div className="category-add-header">Add New Category</div>
            <div className="category-add-form">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11.5 }}>Category Name</label>
                <input
                  className="form-input"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="e.g. Subscriptions, Fuel, Food..."
                  onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11.5 }}>Color Tag</label>
                <div className="category-color-picker">
                  {FRIEND_PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`color-swatch-btn ${newCatColor === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setNewCatColor(c)}
                      aria-label={`Select color ${c}`}
                    />
                  ))}
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleAddCategory}
                style={{ padding: '9px 16px', gap: 6, justifyContent: 'center' }}
              >
                <AddIcon style={{ fontSize: 18 }} /> Add Category
              </button>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Data</h2>

          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', margin: 0 }}>
            Nothing leaves your browser.
          </p>

          <div className="data-action-grid">
            <button type="button" className="data-action-card" onClick={handleExport}>
              <FileDownloadOutlinedIcon style={{ fontSize: 26 }} />
              <span className="data-action-label">Export</span>
            </button>

            <button type="button" className="data-action-card" onClick={() => fileRef.current?.click()}>
              <FileUploadOutlinedIcon style={{ fontSize: 26 }} />
              <span className="data-action-label">Import</span>
            </button>

            <button type="button" className="data-action-card" onClick={handleLoadSample}>
              <ScienceOutlinedIcon style={{ fontSize: 26 }} />
              <span className="data-action-label">Sample</span>
            </button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </div>

          <div className="data-reset-row" onClick={() => setShowReset(true)} role="button" tabIndex={0}>
            <div className="data-reset-left">
              <DeleteOutlineIcon style={{ fontSize: 20 }} />
              <span>Reset all data</span>
            </div>
            <ChevronRightIcon style={{ fontSize: 20, color: 'var(--text-3)' }} />
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
