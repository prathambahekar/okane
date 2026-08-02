import { useState, useRef } from 'react';
import { useColorMode } from '../theme';
import Switch from '@mui/material/Switch';
import { Plus, X, RotateCcw, Tag, Download, Upload, FlaskConical, Trash2, ChevronRight, Edit2, Palette, ExternalLink } from 'lucide-react';
import { useStore } from '../store';
import { CURRENCIES, DEFAULT_CATEGORIES, FRIEND_PALETTE } from '../db';
import type { Category, AppDB } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

import CategoryIcon, { AVAILABLE_ICONS } from '../components/CategoryIcon';

function ColorPickerSection({ color, onChangeColor }: { color: string; onChangeColor: (c: string) => void }) {
  const isCustom = !FRIEND_PALETTE.includes(color);
  return (
    <div className="category-color-picker">
      {FRIEND_PALETTE.map(c => (
        <button
          key={c}
          type="button"
          className={`color-swatch-btn ${color === c ? 'selected' : ''}`}
          style={{ background: c }}
          onClick={() => onChangeColor(c)}
          aria-label={`Select color ${c}`}
        />
      ))}
      <label
        className={`color-swatch-btn ${isCustom ? 'selected' : ''}`}
        style={{
          background: color,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          border: '1.5px dashed rgba(255,255,255,0.4)',
        }}
        title="Choose Custom Color"
      >
        <Palette size={13} style={{ color: '#fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }} />
        <input
          type="color"
          value={color}
          onChange={e => onChangeColor(e.target.value)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
          }}
        />
      </label>
    </div>
  );
}

export default function Settings() {
  const { db, updateSettings, updateCategory, resetDB, restoreDB, loadSampleData, showToast } = useStore();
  const { settings } = db;
  const fileRef = useRef<HTMLInputElement>(null);
  const [showReset, setShowReset] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(FRIEND_PALETTE[0]);
  const [newCatIcon, setNewCatIcon] = useState('other');

  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#F97362');
  const [editIcon, setEditIcon] = useState('other');

  const { mode, toggleMode } = useColorMode();
  const isDark = mode === 'dark';

  const startEditCategory = (c: Category) => {
    setEditingCat(c);
    setEditName(c.name);
    setEditColor(c.color);
    setEditIcon(c.icon || 'other');
  };

  const handleSaveEditCategory = () => {
    if (!editingCat) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      showToast('Category name cannot be empty.');
      return;
    }
    const oldName = editingCat.name;
    if (trimmed.toLowerCase() !== oldName.toLowerCase() && settings.categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Category with this name already exists.');
      return;
    }
    updateCategory(oldName, { name: trimmed, color: editColor, icon: editIcon });
    setEditingCat(null);
    showToast(`Updated category "${trimmed}"`);
  };

  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (settings.categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast('Category already exists.');
      return;
    }
    updateSettings({ categories: [...settings.categories, { name: trimmed, color: newCatColor, icon: newCatIcon }] });
    setNewCatName('');
    setNewCatIcon('other');
    showToast(`Category "${trimmed}" added!`);
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
      const exportData: AppDB = {
        ...db,
        recurringRules: db.recurringRules || [],
      };
      const json = JSON.stringify(exportData, null, 2);
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
              <Tag size={18} style={{ color: 'var(--accent)' }} />
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
              <RotateCcw size={15} /> Reset Defaults
            </button>
          </div>

          <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 16 }}>
            Manage category tags used for organizing your spending.
          </p>

          {/* Chips Grid */}
          <div className="category-chip-list">
            {settings.categories.map((c: Category) => {
              const bgTint = c.color.startsWith('#') && c.color.length === 7 ? `${c.color}20` : 'var(--accent-soft)';
              return (
                <div key={c.name} className="category-chip">
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: bgTint,
                      color: c.color,
                      flexShrink: 0,
                    }}
                  >
                    <CategoryIcon category={c.name} icon={c.icon} size={13} style={{ color: c.color }} />
                  </span>
                  <span>{c.name}</span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 2 }}>
                    <button
                      type="button"
                      className="category-chip-edit"
                      title={`Edit ${c.name}`}
                      onClick={() => startEditCategory(c)}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="category-chip-delete"
                      title={`Remove ${c.name}`}
                      onClick={() => handleDeleteCategory(c.name)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Category Section */}
          <div className="category-add-box">
            <div className="category-add-header">Add New Category</div>
            <div className="category-add-form" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
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
                <ColorPickerSection color={newCatColor} onChangeColor={setNewCatColor} />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11.5 }}>Category Icon</label>
                <div className="category-icon-picker">
                  {AVAILABLE_ICONS.map(({ id, label, Icon }) => {
                    const isSelected = newCatIcon === id;
                    const bgStyle = isSelected
                      ? (newCatColor.startsWith('#') && newCatColor.length === 7 ? `${newCatColor}20` : 'var(--accent-soft)')
                      : undefined;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`icon-picker-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => setNewCatIcon(id)}
                        title={label}
                        style={{
                          color: isSelected ? newCatColor : 'var(--text-2)',
                          borderColor: isSelected ? newCatColor : undefined,
                          background: bgStyle,
                        }}
                      >
                        <Icon size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleAddCategory}
                style={{ padding: '9px 16px', gap: 6, justifyContent: 'center', justifySelf: 'start', marginTop: 4 }}
              >
                <Plus size={18} /> Add Category
              </button>
            </div>
          </div>
        </div>

        {/* Edit Category Modal */}
        {editingCat && (
          <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setEditingCat(null); }}>
            <div className="modal" style={{ maxWidth: 460 }}>
              <div className="modal-header">
                <span className="modal-title">Edit Category</span>
                <button className="btn-icon" onClick={() => setEditingCat(null)} aria-label="Close dialog"><X size={18} /></button>
              </div>
              <form onSubmit={e => { e.preventDefault(); handleSaveEditCategory(); }}>
                <div className="modal-body">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Category Name *</label>
                      <input
                        className="form-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Category name..."
                        autoFocus
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Color Tag</label>
                      <ColorPickerSection color={editColor} onChangeColor={setEditColor} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Category Icon</label>
                      <div className="category-icon-picker">
                        {AVAILABLE_ICONS.map(({ id, label, Icon }) => {
                          const isSelected = editIcon === id;
                          const bgStyle = isSelected
                            ? (editColor.startsWith('#') && editColor.length === 7 ? `${editColor}20` : 'var(--accent-soft)')
                            : undefined;
                          return (
                            <button
                              key={id}
                              type="button"
                              className={`icon-picker-btn ${isSelected ? 'selected' : ''}`}
                              onClick={() => setEditIcon(id)}
                              title={label}
                              style={{
                                color: isSelected ? editColor : 'var(--text-2)',
                                borderColor: isSelected ? editColor : undefined,
                                background: bgStyle,
                              }}
                            >
                              <Icon size={16} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingCat(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}

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
              <Download size={26} />
              <span className="data-action-label">Export</span>
            </button>

            <button type="button" className="data-action-card" onClick={() => fileRef.current?.click()}>
              <Upload size={26} />
              <span className="data-action-label">Import</span>
            </button>

            <button type="button" className="data-action-card" onClick={handleLoadSample}>
              <FlaskConical size={26} />
              <span className="data-action-label">Sample</span>
            </button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </div>

          <div className="data-reset-row" onClick={() => setShowReset(true)} role="button" tabIndex={0}>
            <div className="data-reset-left">
              <Trash2 size={20} />
              <span>Reset all data</span>
            </div>
            <ChevronRight size={20} style={{ color: 'var(--text-3)' }} />
          </div>
        </div>

        {/* About */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Version</h2>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '2px 10px',
                borderRadius: 12,
                background: 'var(--surface2)',
                color: 'var(--accent)',
                border: '1px solid var(--border)'
              }}>
                v0.7
              </span>
            </div>

            <a
              href="https://github.com/prathambahekar/okane/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '6px 12px',
                textDecoration: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline-block' }}>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>GitHub Repository</span>
              <ExternalLink size={13} style={{ color: 'var(--text-3)' }} />
            </a>
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
