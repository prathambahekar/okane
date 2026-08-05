import { useState, useRef, useEffect } from 'react';
import { useColorMode, ACCENT_PRESETS } from '../theme';
import Switch from '@mui/material/Switch';
import { Plus, X, RotateCcw, Tag, Upload, FlaskConical, Trash2, ChevronRight, Edit2, Palette, ExternalLink, Sparkles, Zap, FileCode, Check, ChevronDown, ChevronUp, Database, Terminal } from 'lucide-react';
import { useStore } from '../store';
import { CURRENCIES, DEFAULT_CATEGORIES, FRIEND_PALETTE, generateSQLDumpString, importSQLDumpString } from '../db';
import type { Category, AppDB, ViewName } from '../types';
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

export default function Settings({ onNavigate }: { onNavigate?: (v: ViewName) => void }) {
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

  const { mode, toggleMode, accent, setAccent, customColor, setCustomColor } = useColorMode();
  const isDark = mode === 'dark';
  const [accentExpanded, setAccentExpanded] = useState(false);
  const [categoriesListExpanded, setCategoriesListExpanded] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [devExpanded, setDevExpanded] = useState(!!settings.devMode);

  const [jsonSettings, setJsonSettings] = useState<Record<string, unknown>>({
    appName: "Okane",
    appVersion: "0.8.1",
    buildNumber: "104",
    updateChannel: "beta",
    autoCheckUpdates: true,
    enableAIAssistant: true,
    defaultAiEngine: "offline",
    defaultCurrency: "INR",
    lastUpdated: "2026-08-04"
  });
  const [showJsonView, setShowJsonView] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/settings.json?t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data && data.appVersion) {
            delete data.latestVersion;
            setJsonSettings(data);
            return;
          }
        }
      } catch (err) {
        console.log('Direct settings.json fetch failed, trying /api/settings:', err);
      }

      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data && data.appVersion) {
            delete data.latestVersion;
            setJsonSettings(data);
          }
        }
      } catch (err) {
        console.log('API settings fetch notice:', err);
      }
    };

    loadSettings();
  }, []);

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
    setShowAddCategory(false);
    showToast(`Category "${trimmed}" added!`);
  };

  const handleDeleteCategory = (name: string) => {
    if (settings.categories.length <= 1) { showToast('Must have at least one category.'); return; }
    updateSettings({
      categories: settings.categories.filter(c => c.name !== name),
      defaultCategory: settings.defaultCategory === name ? settings.categories[0]?.name ?? '' : settings.defaultCategory,
    });
  };



  const handleExport = async (format: 'db' | 'json' = 'db') => {
    try {
      let dataContent = '';
      let contentType = 'application/octet-stream';
      let ext = 'db';

      if (format === 'db') {
        dataContent = generateSQLDumpString();
        contentType = 'application/octet-stream';
        ext = 'db';
      } else {
        const exportData: AppDB = {
          ...db,
          recurringRules: db.recurringRules || [],
        };
        dataContent = JSON.stringify(exportData, null, 2);
        contentType = 'application/json';
        ext = 'json';
      }

      const fileName = `okane-database-${new Date().toISOString().slice(0, 10)}.${ext}`;

      // Web
      if (Capacitor.getPlatform() === "web") {
        const blob = new Blob([dataContent], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`${ext.toUpperCase()} database backup downloaded`);
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
            data: dataContent,
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
        data: dataContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
        recursive: true,
      });

      try {
        await Share.share({
          title: `Okane ${format.toUpperCase()} Backup`,
          text: `Okane database backup file (${format.toUpperCase()})`,
          url: result.uri,
          dialogTitle: "Save or Share Backup",
        });
      } catch (shareErr) {
        console.warn("Share sheet dismissed or skipped:", shareErr);
      }

      if (savedToDownloadFolder) {
        showToast(`Backup saved to Download folder (${ext})!`);
      } else {
        showToast(`Backup created successfully (${ext})`);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to export data");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isSql = file.name.endsWith('.sql') || file.name.endsWith('.db');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        if (isSql || text.trim().startsWith('--') || text.includes('INSERT INTO') || text.includes('DELETE FROM')) {
          const restoredDB = importSQLDumpString(text);
          restoreDB(restoredDB);
          showToast('SQL database imported successfully');
        } else {
          const data = JSON.parse(text) as AppDB;
          if (!data.expenses || !data.friends || !data.settings) throw new Error('Invalid format');
          restoreDB(data);
          showToast('JSON data imported successfully');
        }
      } catch {
        showToast('Invalid file format. Please upload a valid JSON or SQL backup.');
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

          <div style={{ margin: '16px 0', borderTop: '1px solid var(--border)' }} />

          <div>
            <div
              onClick={() => setAccentExpanded(!accentExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
                padding: '2px 0',
              }}
            >
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>Accent Color</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {accentExpanded
                    ? 'Choose primary theme accent color across buttons, navigation, and badges'
                    : 'Customize interface primary theme accent'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Active selection badge preview when collapsed/expanded */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-2)',
                }}>
                  <div style={{
                    width: 13,
                    height: 13,
                    borderRadius: '50%',
                    background: accent === 'custom'
                      ? customColor
                      : (accent === 'monochrome' ? (isDark ? '#ffffff' : '#111111') : (isDark ? ACCENT_PRESETS.find(p => p.id === accent)?.swatchDark : ACCENT_PRESETS.find(p => p.id === accent)?.swatchLight)),
                    border: '1px solid rgba(0,0,0,0.15)',
                    flexShrink: 0
                  }} />
                  <span>
                    {accent === 'custom' ? 'Custom' : (ACCENT_PRESETS.find(p => p.id === accent)?.name || 'Classic Blue')}
                  </span>
                </div>

                <div style={{
                  padding: 4,
                  color: 'var(--text-3)',
                  display: 'grid',
                  placeItems: 'center',
                }}>
                  {accentExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>
            </div>

            {accentExpanded && (
              <div style={{ marginTop: 14 }}>
                <div className="accent-picker-grid">
                  {ACCENT_PRESETS.map(preset => {
                    const isSelected = accent === preset.id;
                    const colorHex = isDark ? preset.swatchDark : preset.swatchLight;

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setAccent(preset.id)}
                        className="accent-picker-btn"
                        style={{
                          border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                        }}
                      >
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: preset.id === 'monochrome'
                            ? (isDark ? '#ffffff' : '#111111')
                            : colorHex,
                          border: preset.id === 'monochrome' && isDark ? '1px solid #555' : '1px solid rgba(0,0,0,0.12)',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                          flexShrink: 0,
                          display: 'grid',
                          placeItems: 'center'
                        }}>
                          {isSelected && <Check size={12} style={{ color: preset.id === 'monochrome' && isDark ? '#000' : '#fff' }} />}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 500, color: 'var(--text)', lineHeight: 1.2 }}>
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}

                  {/* Custom option */}
                  <button
                    type="button"
                    onClick={() => setAccent('custom')}
                    className="accent-picker-btn"
                    style={{
                      border: accent === 'custom' ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: accent === 'custom' ? 'var(--accent-soft)' : 'var(--surface2)',
                    }}
                  >
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: customColor,
                      border: '1px solid rgba(0,0,0,0.12)',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center'
                    }}>
                      {accent === 'custom' && <Check size={12} style={{ color: '#fff' }} />}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: accent === 'custom' ? 600 : 500, color: 'var(--text)' }}>
                      Custom Hex
                    </span>
                  </button>
                </div>

                {accent === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                    <input
                      type="color"
                      value={customColor}
                      onChange={e => setCustomColor(e.target.value)}
                      style={{ width: 36, height: 36, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'none' }}
                    />
                    <input
                      type="text"
                      className="input"
                      value={customColor}
                      onChange={e => setCustomColor(e.target.value)}
                      placeholder="#6366f1"
                      style={{ width: 120, fontSize: 13, fontFamily: 'monospace' }}
                    />
                  </div>
                )}
              </div>
            )}
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
            {(categoriesListExpanded ? settings.categories : settings.categories.slice(0, 5)).map((c: Category) => {
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

            {!categoriesListExpanded && settings.categories.length > 5 && (
              <button
                type="button"
                className="category-chip"
                onClick={() => setCategoriesListExpanded(true)}
                style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  borderColor: 'var(--accent)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '6px 12px',
                }}
              >
                +{settings.categories.length - 5} more...
              </button>
            )}
          </div>

          {settings.categories.length > 5 && (
            <div style={{ textAlign: 'center', marginTop: -6, marginBottom: 14 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setCategoriesListExpanded(!categoriesListExpanded)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  gap: 6,
                  padding: '4px 12px',
                  margin: '0 auto',
                  borderRadius: 20,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)'
                }}
              >
                {categoriesListExpanded ? (
                  <>Show Less <ChevronUp size={14} /></>
                ) : (
                  <>Show All ({settings.categories.length} categories) <ChevronDown size={14} /></>
                )}
              </button>
            </div>
          )}

          {/* Add Category Section */}
          <div className="category-add-box" style={{ marginTop: 12 }}>
            <div
              onClick={() => setShowAddCategory(!showAddCategory)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                <Plus size={16} style={{ color: 'var(--accent)' }} />
                <span>Add New Category</span>
              </div>
              <div style={{ color: 'var(--text-3)', display: 'grid', placeItems: 'center' }}>
                {showAddCategory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {showAddCategory && (
              <div className="category-add-form" style={{ gridTemplateColumns: '1fr', gap: 16, marginTop: 14 }}>
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
            )}
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

        {/* Developer Mode Card */}
        <div className="card" style={{ padding: '20px 22px', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: settings.devMode ? 'pointer' : 'default', flex: 1, minWidth: 220 }}
              onClick={() => settings.devMode && setDevExpanded(!devExpanded)}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: 'var(--accent-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Database size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Developer Mode</h2>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                    background: 'var(--accent-soft)', color: 'var(--accent)', letterSpacing: '0.02em'
                  }}>
                    DEV TOOLS
                  </span>
                  {settings.devMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDevExpanded(!devExpanded);
                      }}
                      style={{
                        fontSize: 11, color: 'var(--text-2)', fontWeight: 600, display: 'inline-flex',
                        alignItems: 'center', gap: 4, background: 'var(--surface2)', border: '1px solid var(--border)',
                        padding: '2px 8px', borderRadius: 12, cursor: 'pointer', marginLeft: 2
                      }}
                    >
                      {devExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      <span>{devExpanded ? 'Collapse' : 'Expand'}</span>
                    </button>
                  )}
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 3, marginBottom: 0, maxWidth: 520 }}>
                  Unlocks advanced developer tools: SQL Console, AI Assistant trigger, and demo sample data loader.
                </p>
              </div>
            </div>

            <Switch
              checked={!!settings.devMode}
              onChange={e => {
                const checked = e.target.checked;
                updateSettings({ devMode: checked });
                if (checked) setDevExpanded(true);
                showToast(checked ? 'Developer Mode enabled!' : 'Developer Mode disabled.');
              }}
              color="primary"
              inputProps={{ 'aria-label': 'toggle developer mode' }}
            />
          </div>

          {settings.devMode && devExpanded && (
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              {/* 1. SQL Console Tool */}
              <div style={{
                padding: '14px 16px', borderRadius: 'var(--radius)', background: 'var(--surface2)', border: '1px solid var(--border)',
                transition: 'border-color 0.15s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, background: (settings.enableDevSQLConsole ?? true) ? 'var(--accent-soft)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s ease'
                    }}>
                      <Terminal size={17} style={{ color: (settings.enableDevSQLConsole ?? true) ? 'var(--accent)' : 'var(--text-3)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>SQL Dev Console</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>Execute raw AlaSQL queries, inspect schemas & table data</div>
                    </div>
                  </div>
                  <Switch
                    checked={settings.enableDevSQLConsole ?? true}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      updateSettings({ enableDevSQLConsole: enabled });
                      showToast(enabled ? 'SQL Dev Console enabled' : 'SQL Dev Console disabled');
                    }}
                    color="primary"
                    size="small"
                  />
                </div>
                {(settings.enableDevSQLConsole ?? true) && onNavigate && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => onNavigate('dev-sql')}
                      style={{ gap: 6, fontSize: 12 }}
                    >
                      <Database size={14} /> Open SQL Console
                    </button>
                  </div>
                )}
              </div>

              {/* 2. AI Assistant Tool */}
              <div style={{
                padding: '14px 16px', borderRadius: 'var(--radius)', background: 'var(--surface2)', border: '1px solid var(--border)',
                transition: 'border-color 0.15s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, background: (settings.enableAIAssistant ?? true) ? 'var(--accent-soft)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s ease'
                    }}>
                      <Sparkles size={17} style={{ color: (settings.enableAIAssistant ?? true) ? 'var(--accent)' : 'var(--text-3)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>AI Assistant (Max)</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>Floating voice & natural language AI assistant trigger on screen</div>
                    </div>
                  </div>
                  <Switch
                    checked={settings.enableAIAssistant ?? true}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      updateSettings({ enableAIAssistant: enabled });
                      showToast(enabled ? 'AI Assistant enabled' : 'AI Assistant disabled');
                    }}
                    color="primary"
                    size="small"
                  />
                </div>

                {(settings.enableAIAssistant ?? true) && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
                    marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)'
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      Processing Engine: <strong style={{ color: 'var(--text)' }}>
                        {(settings.defaultAiEngine ?? 'offline') === 'offline' ? 'Offline (100% Local)' : 'Gemini Cloud'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          updateSettings({ defaultAiEngine: 'offline' });
                          localStorage.setItem('ai_engine_mode', 'offline');
                          showToast('Set AI engine to Offline (Local)');
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
                          fontSize: 11.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                          background: (settings.defaultAiEngine ?? 'offline') === 'offline' ? 'var(--accent-soft)' : 'transparent',
                          color: (settings.defaultAiEngine ?? 'offline') === 'offline' ? 'var(--accent)' : 'var(--text-3)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Zap size={12} /> Offline
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateSettings({ defaultAiEngine: 'online' });
                          localStorage.setItem('ai_engine_mode', 'online');
                          showToast('Set AI engine to Gemini Cloud');
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
                          fontSize: 11.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                          background: (settings.defaultAiEngine ?? 'offline') === 'online' ? 'var(--accent-soft)' : 'transparent',
                          color: (settings.defaultAiEngine ?? 'offline') === 'online' ? 'var(--accent)' : 'var(--text-3)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Sparkles size={12} /> Gemini
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Demo Sample Data Loader */}
              <div style={{
                padding: '14px 16px', borderRadius: 'var(--radius)', background: 'var(--surface2)', border: '1px solid var(--border)',
                transition: 'border-color 0.15s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, background: (settings.enableSampleData ?? true) ? 'var(--accent-soft)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s ease'
                    }}>
                      <FlaskConical size={17} style={{ color: (settings.enableSampleData ?? true) ? 'var(--accent)' : 'var(--text-3)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>Sample Data Loader</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>Populate demo transactions, contacts, wallets & recurring rules</div>
                    </div>
                  </div>
                  <Switch
                    checked={settings.enableSampleData ?? true}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      updateSettings({ enableSampleData: enabled });
                      showToast(enabled ? 'Sample Data Loader enabled' : 'Sample Data Loader disabled');
                    }}
                    color="primary"
                    size="small"
                  />
                </div>
                {(settings.enableSampleData ?? true) && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleLoadSample}
                      style={{ gap: 6, fontSize: 12 }}
                    >
                      <FlaskConical size={14} /> Load Sample Data
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

          {settings.devMode && !devExpanded && (
            <div
              onClick={() => setDevExpanded(true)}
              style={{
                marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius)',
                background: 'var(--surface2)', fontSize: 12, color: 'var(--text-2)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)'
              }}
            >
              <span>Developer mode active. Click to expand tool toggles (SQL Console, AI Assistant, Sample Data).</span>
              <ChevronDown size={14} style={{ color: 'var(--accent)' }} />
            </div>
          )}

          {!settings.devMode && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius)',
              background: 'var(--surface2)', fontSize: 12, color: 'var(--text-3)', border: '1px dashed var(--border)'
            }}>
              Enable Developer Mode above to activate Dev SQL Console, AI Assistant, and Demo Sample Data generator.
            </div>
          )}
        </div>

        {/* Data Management */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Data & Database Backup</h2>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginBottom: 14 }}>
            All data operates on an offline relational SQL engine inside your browser. Export or restore using SQL database dumps or legacy formats.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
            <button type="button" className="data-action-card" onClick={() => handleExport('db')}>
              <Database size={24} style={{ color: 'var(--accent)' }} />
              <span className="data-action-label" style={{ fontWeight: 600 }}>Export DB</span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>.db file</span>
            </button>

            <button type="button" className="data-action-card" onClick={() => fileRef.current?.click()}>
              <Upload size={24} />
              <span className="data-action-label" style={{ fontWeight: 600 }}>Restore Data</span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>.sql, .db, .json</span>
            </button>

            {settings.devMode && (settings.enableSampleData ?? true) && (
              <button type="button" className="data-action-card" onClick={handleLoadSample}>
                <FlaskConical size={24} />
                <span className="data-action-label" style={{ fontWeight: 600 }}>Sample Data</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Load Demo</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept=".json,.sql,.db,text/plain" style={{ display: 'none' }} onChange={handleImport} />
          </div>

          <div className="data-reset-row" onClick={() => setShowReset(true)} role="button" tabIndex={0}>
            <div className="data-reset-left">
              <Trash2 size={20} />
              <span>Reset all data</span>
            </div>
            <ChevronRight size={20} style={{ color: 'var(--text-3)' }} />
          </div>
        </div>

        {/* App Version & settings.json Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileCode size={18} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>App Version & Configuration</h2>
            </div>
            <span style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '99px',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}>
              v{String(jsonSettings.appVersion || '')}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
            <div style={{ background: 'var(--surface2)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Update Channel</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, textTransform: 'capitalize' }}>{String(jsonSettings.updateChannel || '')}</div>
            </div>
            <div style={{ background: 'var(--surface2)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Last Updated</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{String(jsonSettings.lastUpdated || '')}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowJsonView(!showJsonView)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                transition: 'all 0.15s ease'
              }}
            >
              <FileCode size={13} />
              <span>{showJsonView ? 'Hide settings.json' : 'View settings.json'}</span>
            </button>

            <a
              href="https://github.com/prathambahekar/okane/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: 'var(--text-3)',
                textDecoration: 'none'
              }}
            >
              <span>GitHub</span>
              <ExternalLink size={12} />
            </a>
          </div>

          {showJsonView && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>public/settings.json</span>
                <a href="/settings.json" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
                  Open Raw File ↗
                </a>
              </div>
              <pre style={{
                fontSize: 11.5,
                fontFamily: 'monospace',
                background: 'var(--surface2)',
                padding: 12,
                borderRadius: 8,
                overflowX: 'auto',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                margin: 0
              }}>
                {JSON.stringify(jsonSettings, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {showReset && (
        <ConfirmDialog
          title="Reset All Data"
          message="This will permanently delete ALL your data including expenses, friends, wallets, and settlements. This cannot be undone."
          confirmLabel="Reset Everything"
          onConfirm={handleReset}
          onClose={() => setShowReset(false)}
        />
      )}
    </div>
  );
}
