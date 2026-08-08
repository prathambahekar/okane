import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useColorMode, ACCENT_PRESETS } from '../theme';
import Switch from '@mui/material/Switch';
import { Plus, X, RotateCcw, Tag, Upload, FlaskConical, Trash2, ChevronRight, Edit2, Palette, ExternalLink, Sparkles, Zap, FileCode, Check, ChevronDown, ChevronUp, Database, Terminal, Download, RefreshCw, ArrowUpCircle, CheckCircle2, History, GitCommit, Plane, Send, HelpCircle, MessageSquarePlus, Bug, Lightbulb, GitPullRequest, Sliders, Moon, Sun } from 'lucide-react';
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
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleCustomTrigger = () => {
    if (colorInputRef.current) {
      try {
        if ('showPicker' in colorInputRef.current && typeof colorInputRef.current.showPicker === 'function') {
          colorInputRef.current.showPicker();
          return;
        }
      } catch {
        // Fallback to click
      }
      colorInputRef.current.click();
    }
  };

  return (
    <div className="category-color-picker" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
      <button
        type="button"
        className={`color-swatch-btn ${isCustom ? 'selected' : ''}`}
        onClick={handleCustomTrigger}
        style={{
          background: color,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: isCustom ? '2px solid #ffffff' : '1.5px dashed rgba(255,255,255,0.7)',
          boxShadow: isCustom ? '0 0 0 2px var(--accent)' : 'none',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}
        title="Choose Custom Color"
      >
        <Palette size={14} style={{ color: '#fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }} />
      </button>

      {/* Touch-safe native color picker input */}
      <input
        ref={colorInputRef}
        type="color"
        value={color.startsWith('#') && color.length === 7 ? color : '#3B82F6'}
        onChange={e => onChangeColor(e.target.value)}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 1,
          height: 1,
          pointerEvents: 'none',
          visibility: 'hidden',
        }}
      />
    </div>
  );
}

export default function Settings({
  onNavigate,
  onOpenGuide,
  onStartExpenseTutorial,
}: {
  onNavigate?: (v: ViewName) => void;
  onOpenGuide?: () => void;
  onStartExpenseTutorial?: () => void;
}) {
  const {
    db, updateSettings, updateCategory, resetDB, restoreDB, loadSampleData, showToast,
    availableUpdate, releaseHistory, isCheckingUpdate, isUpdating, updateProgress, updateStatusMessage,
    checkForUpdates, installUpdate
  } = useStore();
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

  // Saved Custom Accent Colors
  const [savedCustomColors, setSavedCustomColors] = useState<{ id: string; name: string; hex: string }[]>(() => {
    try {
      const saved = localStorage.getItem('saved_custom_accent_colors');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });
  const [newColorName, setNewColorName] = useState('');
  const customAccentInputRef = useRef<HTMLInputElement>(null);

  const handleSaveCustomColor = () => {
    const hex = customColor.trim();
    if (!/^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(hex)) {
      showToast('Invalid color hex code');
      return;
    }

    const name = newColorName.trim() || hex.toUpperCase();
    const id = 'custom_' + Date.now();
    const newEntry = { id, name, hex };

    const existingIdx = savedCustomColors.findIndex(c => c.hex.toLowerCase() === hex.toLowerCase());
    let updated: { id: string; name: string; hex: string }[];
    if (existingIdx >= 0) {
      updated = [...savedCustomColors];
      updated[existingIdx] = newEntry;
    } else {
      updated = [...savedCustomColors, newEntry];
    }

    setSavedCustomColors(updated);
    try {
      localStorage.setItem('saved_custom_accent_colors', JSON.stringify(updated));
    } catch {
      // ignore
    }
    setNewColorName('');
    setAccent('custom');
    setCustomColor(hex);
    updateSettings({ accent: 'custom', customAccentColor: hex });
    showToast('Saved custom color preset!');
  };

  const handleRemoveCustomColor = (id: string, hex: string) => {
    const updated = savedCustomColors.filter(c => c.id !== id);
    setSavedCustomColors(updated);
    try {
      localStorage.setItem('saved_custom_accent_colors', JSON.stringify(updated));
    } catch {
      // ignore
    }
    if (accent === 'custom' && customColor.toLowerCase() === hex.toLowerCase()) {
      setAccent('blue');
      updateSettings({ accent: 'blue' });
    }
    showToast('Removed custom accent preset');
  };
  const [showAddCategory, setShowAddCategory] = useState(false);
  const isDevMode = settings.devMode ?? false;
  const [showDevSheet, setShowDevSheet] = useState(false);
  const [showAppearanceSheet, setShowAppearanceSheet] = useState(false);
  const [showCategoriesSheet, setShowCategoriesSheet] = useState(false);
  const [showPreferencesSheet, setShowPreferencesSheet] = useState(false);
  const [showDataSheet, setShowDataSheet] = useState(false);
  const [showVersionSheet, setShowVersionSheet] = useState(false);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const [jsonSettings, setJsonSettings] = useState<Record<string, unknown>>({
    appName: "Okane",
    appVersion: "0.8.2",
    buildNumber: "108",
    updateChannel: "release",
    autoCheckUpdates: true,
    enableAIAssistant: true,
    defaultAiEngine: "offline",
    defaultCurrency: "INR",
    lastUpdated: "2026-08-05"
  });
  const [showJsonView, setShowJsonView] = useState(false);

  // Feedback & Bug Report state
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature'>('bug');
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackDescription, setFeedbackDescription] = useState('');
  const [includeVersionInfo, setIncludeVersionInfo] = useState(true);
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [githubTokenInput, setGithubTokenInput] = useState(() => localStorage.getItem('okane_github_token') || '');
  const [createdIssueInfo, setCreatedIssueInfo] = useState<{ url: string; number: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSendFeedback = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedTitle = feedbackTitle.trim();
    const trimmedDesc = feedbackDescription.trim();

    if (!trimmedTitle) {
      showToast('Please enter a title for your issue or feature idea.');
      return;
    }
    if (!trimmedDesc) {
      showToast('Please enter a description for your issue or feature idea.');
      return;
    }

    setIsSubmittingFeedback(true);
    setFeedbackStatus('idle');
    setErrorMessage('');
    setCreatedIssueInfo(null);

    const appVersion = String(settings.installedVersion || jsonSettings.appVersion || '0.8.2');

    try {
      const res = await fetch('/api/github-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDesc,
          type: feedbackType,
          version: includeVersionInfo ? appVersion : undefined,
          platform: includeVersionInfo ? (Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'Web Browser') : undefined,
          userAgent: includeVersionInfo ? navigator.userAgent : undefined,
          token: githubTokenInput.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'MISSING_TOKEN') {
          setErrorMessage('GitHub Access Token required: Please enter a Personal Access Token below or configure GITHUB_TOKEN in .env.example.');
        } else {
          setErrorMessage(data.error || 'Failed to create GitHub issue.');
        }
        setFeedbackStatus('error');
        showToast(data.error || 'Failed to create GitHub issue.');
        return;
      }

      if (data.success) {
        if (githubTokenInput.trim()) {
          localStorage.setItem('okane_github_token', githubTokenInput.trim());
        }
        setCreatedIssueInfo({ url: data.issueUrl, number: data.issueNumber });
        setFeedbackStatus('success');
        showToast(`Issue #${data.issueNumber} created automatically!`);
        setFeedbackTitle('');
        setFeedbackDescription('');
      }
    } catch (err: unknown) {
      console.error('Error creating GitHub issue:', err);
      const message = err instanceof Error ? err.message : 'Network error while creating GitHub issue.';
      setErrorMessage(message);
      setFeedbackStatus('error');
      showToast('Failed to connect to backend server.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

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



  const getExportContent = () => {
    return {
      content: generateSQLDumpString(),
      contentType: 'application/octet-stream',
      fileName: `okane-backup-${new Date().toISOString().slice(0, 10)}.db`,
    };
  };

  const handleExportClick = () => {
    const isMobile = window.innerWidth <= 768 || Capacitor.isNativePlatform() || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      setExportModalOpen(true);
    } else {
      handleSaveToStorage();
    }
  };

  const handleSaveToStorage = async () => {
    const { content, contentType, fileName } = getExportContent();
    try {
      let savedToDevice = false;

      // Native Mobile (Capacitor)
      if (Capacitor.isNativePlatform()) {
        try {
          await Filesystem.requestPermissions();
        } catch {
          // ignore
        }

        if (Capacitor.getPlatform() === 'android') {
          try {
            await Filesystem.writeFile({
              path: `Download/${fileName}`,
              data: content,
              directory: Directory.ExternalStorage,
              encoding: Encoding.UTF8,
              recursive: true,
            });
            savedToDevice = true;
          } catch (e) {
            console.warn('Direct ExternalStorage Download write failed, attempting Documents:', e);
          }
        }

        if (!savedToDevice) {
          try {
            await Filesystem.writeFile({
              path: fileName,
              data: content,
              directory: Directory.Documents,
              encoding: Encoding.UTF8,
              recursive: true,
            });
            savedToDevice = true;
          } catch (e) {
            console.warn('Documents write failed:', e);
          }
        }
      }

      // Always trigger browser blob download link so file lands in browser download manager
      const blob = new Blob([content], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportModalOpen(false);
      showToast(`Backup saved to Downloads!`);
    } catch (err) {
      console.error('Save to storage error:', err);
      showToast('Failed to save backup file.');
    }
  };

  const handleShareToApps = async () => {
    const { content, contentType, fileName } = getExportContent();
    try {
      // 1. Native Mobile (Capacitor)
      if (Capacitor.isNativePlatform()) {
        try {
          await Filesystem.requestPermissions();
        } catch {
          // ignore
        }

        const result = await Filesystem.writeFile({
          path: fileName,
          data: content,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
          recursive: true,
        });

        await Share.share({
          title: 'Okane Backup',
          text: 'My Okane data backup file',
          url: result.uri,
          dialogTitle: 'Share Backup to Apps',
        });

        setExportModalOpen(false);
        showToast('Share sheet opened!');
        return;
      }

      // 2. Web Share API (Mobile Web Browsers: Chrome on Android, Safari on iOS)
      if (navigator.share) {
        try {
          const blob = new Blob([content], { type: contentType });
          const fileObj = new File([blob], fileName, { type: contentType });

          if (navigator.canShare && navigator.canShare({ files: [fileObj] })) {
            await navigator.share({
              title: 'Okane Backup',
              text: 'My Okane data backup file',
              files: [fileObj],
            });
            setExportModalOpen(false);
            showToast('Shared successfully!');
            return;
          }
        } catch (shareErr) {
          if ((shareErr as Error).name === 'AbortError') {
            setExportModalOpen(false);
            return;
          }
          console.warn('Web Share API file share failed, using fallback download:', shareErr);
        }
      }

      // Download fallback for desktop browsers
      const blob = new Blob([content], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportModalOpen(false);
      showToast('Backup saved to Downloads! Attach it to share on WhatsApp or Telegram.');
    } catch (err) {
      console.error('Share to apps failed:', err);
      showToast('Failed to share backup file.');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        let text = (ev.target?.result as string) || '';

        // Strip UTF-8 BOM if present
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1);
        }
        text = text.trim();

        if (!text) {
          showToast('Selected backup file is empty.');
          return;
        }

        // Check for raw binary SQLite header
        if (text.startsWith('SQLite format 3')) {
          showToast('Selected file is a binary SQLite database. Okane expects an Okane .db/.sql text dump or .json backup file.');
          return;
        }

        // 1. Try parsing JSON first if content looks like JSON
        if (text.startsWith('{') || text.startsWith('[')) {
          try {
            const data = JSON.parse(text) as Record<string, unknown>;
            const friendsList = Array.isArray(data.friends)
              ? data.friends
              : (Array.isArray(data.contacts) ? data.contacts : []);

            if (Array.isArray(data.contacts) && (!Array.isArray(data.friends) || data.friends.length === 0)) {
              data.friends = data.contacts;
            }

            if (data.expenses || data.settings || data.wallets) {
              data.friends = friendsList;
              restoreDB(data as unknown as AppDB);
              showToast('JSON database backup imported successfully!');
              return;
            }
          } catch (jsonErr) {
            console.warn('JSON parse attempt failed, trying SQL dump format...', jsonErr);
          }
        }

        // 2. Try SQL dump parse if content contains SQL keywords
        const isSqlSyntax =
          text.includes('CREATE TABLE') ||
          text.includes('INSERT INTO') ||
          text.includes('DELETE FROM') ||
          text.startsWith('--');

        if (isSqlSyntax) {
          try {
            const restoredDB = importSQLDumpString(text);
            restoreDB(restoredDB);
            showToast('SQL database dump (.db) imported successfully!');
            return;
          } catch (sqlErr) {
            console.warn('Primary SQL dump import failed, attempting fallback...', sqlErr);
          }
        }

        // 3. Fallback: Try regex extraction for JSON object if prefixed with comments or headers
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
            if (data.expenses || data.settings || data.wallets) {
              restoreDB(data as unknown as AppDB);
              showToast('Database backup imported successfully!');
              return;
            }
          }
        } catch {
          // ignore
        }

        // 4. Last fallback: Force SQL dump import
        try {
          const restoredDB = importSQLDumpString(text);
          restoreDB(restoredDB);
          showToast('SQL database dump imported successfully!');
          return;
        } catch (finalSqlErr) {
          console.error('Final SQL import attempt failed:', finalSqlErr);
        }

        showToast('Invalid file format. Please select a valid Okane .db, .sql, or .json backup file.');
      } catch (err) {
        console.error('Import error:', err);
        showToast('Failed to import database file.');
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

      <div className="settings-cards-list">
        {/* Help & User Guide Card (Dev Mode Feature) */}
        {isDevMode && (settings.enableUserGuide ?? false) && (
          <div className="card" style={{ background: 'linear-gradient(135deg, var(--surface2) 0%, var(--surface) 100%)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="settings-card-icon">
                  <Sparkles size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Okane User Guide & Help Center</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                    Confused about "Paid for Friend" vs "Paid by Friend"? Learn how Okane works in 2 minutes.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {onStartExpenseTutorial && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onStartExpenseTutorial}
                    style={{ fontSize: 12.5, padding: '8px 16px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                  >
                    <Sparkles size={15} />
                    <span>Interactive Expense Tutorial</span>
                  </button>
                )}

                {onOpenGuide && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onOpenGuide}
                    style={{ fontSize: 12.5, padding: '8px 16px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>Open App Guide</span>
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Appearance Summary Card */}
        <div className="card settings-summary-card" onClick={() => setShowAppearanceSheet(true)}>
          <div className="settings-card-inner">
            <div className="settings-card-left">
              <div className="settings-card-icon">
                <Palette size={19} />
              </div>
              <div className="settings-card-text">
                <h2 className="settings-card-title">Appearance & Theme</h2>
                <p className="settings-card-sub">
                  {isDark ? 'Dark Mode' : 'Light Mode'} • {accent === 'custom' ? 'Custom Accent' : (ACCENT_PRESETS.find(p => p.id === accent)?.name || 'Classic Blue')}
                </p>
              </div>
            </div>

            <div className="settings-card-right">
              <div className="settings-card-badge">
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: accent === 'custom'
                    ? customColor
                    : (accent === 'monochrome' ? (isDark ? '#ffffff' : '#111111') : (isDark ? ACCENT_PRESETS.find(p => p.id === accent)?.swatchDark : ACCENT_PRESETS.find(p => p.id === accent)?.swatchLight)),
                  border: '1px solid rgba(0,0,0,0.15)',
                  flexShrink: 0
                }} />
                <span>{accent === 'custom' ? 'Custom' : (ACCENT_PRESETS.find(p => p.id === accent)?.name || 'Classic')}</span>
              </div>
              <ChevronRight className="settings-card-arrow" size={18} />
            </div>
          </div>
        </div>

        {/* Bottom Sheet Drawer Modal for Appearance & Theme */}
        {showAppearanceSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowAppearanceSheet(false)}>
            <div className="sheet-modal sheet-modal-lg" onClick={(e) => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)',
                    display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0
                  }}>
                    <Palette size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Appearance & Theme
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '1px 0 0 0' }}>
                      Choose dark mode & primary accent color
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAppearanceSheet(false)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--text-2)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Theme Mode Toggle Row */}
              <div style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isDark ? <Moon size={18} style={{ color: 'var(--accent)' }} /> : <Sun size={18} style={{ color: 'var(--accent)' }} />}
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Dark Theme Mode</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Switch between dark and light background</div>
                  </div>
                </div>
                <Switch
                  checked={isDark}
                  onChange={() => {
                    const nextMode = isDark ? 'light' : 'dark';
                    toggleMode();
                    updateSettings({ colorMode: nextMode });
                  }}
                  color="primary"
                />
              </div>

              {/* Accent Color Presets */}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                Preset Accent Colors
              </div>
              <div className="accent-picker-grid">
                {ACCENT_PRESETS.map(preset => {
                  const isSelected = accent === preset.id;
                  const colorHex = isDark ? preset.swatchDark : preset.swatchLight;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setAccent(preset.id);
                        updateSettings({ accent: preset.id });
                      }}
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
              </div>

              {/* Saved Custom Colors */}
              {savedCustomColors.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Saved Custom Colors</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', textTransform: 'none' }}>
                      ({savedCustomColors.length})
                    </span>
                  </div>
                  <div className="accent-picker-grid">
                    {savedCustomColors.map(saved => {
                      const isSelected = accent === 'custom' && customColor.toLowerCase() === saved.hex.toLowerCase();

                      return (
                        <div
                          key={saved.id}
                          onClick={() => {
                            setAccent('custom');
                            setCustomColor(saved.hex);
                            updateSettings({ accent: 'custom', customAccentColor: saved.hex });
                          }}
                          className="accent-picker-btn"
                          style={{
                            border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                            background: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 10px',
                          }}
                        >
                          <div style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: saved.hex,
                            border: '1px solid rgba(0,0,0,0.12)',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                            flexShrink: 0,
                            display: 'grid',
                            placeItems: 'center'
                          }}>
                            {isSelected && <Check size={12} style={{ color: '#fff' }} />}
                          </div>
                          <span style={{
                            fontSize: 12,
                            fontWeight: isSelected ? 600 : 500,
                            color: 'var(--text)',
                            lineHeight: 1.2,
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {saved.name}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCustomColor(saved.id, saved.hex);
                            }}
                            title="Remove custom accent"
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 3,
                              borderRadius: 4,
                              cursor: 'pointer',
                              color: 'var(--text-3)',
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Color Picker & Save Form */}
              <div style={{
                marginTop: 18,
                padding: '16px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Palette size={16} style={{ color: 'var(--accent)' }} />
                    <span>Create Custom Accent</span>
                  </div>
                  {accent === 'custom' && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                      Active
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                  {/* Quick Color Swatches */}
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8 }}>
                      Quick Color Palette
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        '#EF4444', '#F43F5E', '#EC4899', '#A855F7', '#8B5CF6', '#6366F1',
                        '#3B82F6', '#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', '#22C55E',
                        '#84CC16', '#EAB308', '#F97316', '#EA580C', '#8D6E63', '#475569'
                      ].map(swatch => (
                        <button
                          key={swatch}
                          type="button"
                          className={`color-swatch-btn ${customColor.toUpperCase() === swatch ? 'selected' : ''}`}
                          style={{ background: swatch }}
                          onClick={() => {
                            setCustomColor(swatch);
                            setAccent('custom');
                            updateSettings({ accent: 'custom', customAccentColor: swatch });
                          }}
                          aria-label={`Select accent color ${swatch}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Pick Color Button + Native Picker + Hex Input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (customAccentInputRef.current) {
                          try {
                            if ('showPicker' in customAccentInputRef.current && typeof customAccentInputRef.current.showPicker === 'function') {
                              customAccentInputRef.current.showPicker();
                              return;
                            }
                          } catch {
                            // Fallback
                          }
                          customAccentInputRef.current.click();
                        }
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '0 16px',
                        height: 40,
                        borderRadius: 'var(--radius)',
                        background: customColor,
                        color: '#ffffff',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                        userSelect: 'none',
                        flexShrink: 0,
                        border: 'none',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <Palette size={16} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
                      <span>Pick Color</span>
                    </button>

                    <input
                      ref={customAccentInputRef}
                      type="color"
                      className="native-color-picker"
                      value={customColor.startsWith('#') && customColor.length === 7 ? customColor : '#6366F1'}
                      onChange={e => {
                        const hex = e.target.value;
                        setCustomColor(hex);
                        setAccent('custom');
                        updateSettings({ accent: 'custom', customAccentColor: hex });
                      }}
                      title="Native color picker"
                    />

                    <div style={{ flex: 1, minWidth: 110 }}>
                      <input
                        type="text"
                        className="form-input"
                        value={customColor}
                        onChange={e => {
                          const hex = e.target.value;
                          setCustomColor(hex);
                          setAccent('custom');
                          updateSettings({ accent: 'custom', customAccentColor: hex });
                        }}
                        placeholder="#6366F1"
                        maxLength={7}
                        style={{ fontFamily: 'monospace', fontWeight: 600, textTransform: 'uppercase', minHeight: 40 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={newColorName}
                      onChange={e => setNewColorName(e.target.value)}
                      placeholder="Preset name (e.g. Neon Violet)"
                      style={{ flex: 1, minWidth: 160, fontSize: 13, minHeight: 40 }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveCustomColor();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveCustomColor}
                      className="btn btn-primary"
                      style={{ height: 40, padding: '0 16px', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, gap: 6 }}
                    >
                      <Plus size={16} /> Save Preset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Preferences Summary Card */}
        <div className="card settings-summary-card" onClick={() => setShowPreferencesSheet(true)}>
          <div className="settings-card-inner">
            <div className="settings-card-left">
              <div className="settings-card-icon">
                <Sliders size={19} />
              </div>
              <div className="settings-card-text">
                <h2 className="settings-card-title">Preferences</h2>
                <p className="settings-card-sub">
                  Currency ({settings.currency}), default category & wallet
                </p>
              </div>
            </div>

            <div className="settings-card-right">
              <span className="badge settings-card-badge">
                {settings.currency}
              </span>
              <ChevronRight className="settings-card-arrow" size={18} />
            </div>
          </div>
        </div>

        {/* Bottom Sheet Drawer Modal for Preferences */}
        {showPreferencesSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowPreferencesSheet(false)}>
            <div className="sheet-modal" onClick={(e) => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)',
                    display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0
                  }}>
                    <Sliders size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      App Preferences
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '1px 0 0 0' }}>
                      Configure currency, default category & wallet
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPreferencesSheet(false)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--text-2)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Preferences Form Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Currency</label>
                  <select className="form-select" value={settings.currency} onChange={e => updateSettings({ currency: e.target.value })}>
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Default Category</label>
                  <select className="form-select" value={settings.defaultCategory} onChange={e => updateSettings({ defaultCategory: e.target.value })}>
                    {settings.categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Default Expense Status</label>
                  <select className="form-select" value={settings.defaultStatus} onChange={e => updateSettings({ defaultStatus: e.target.value as 'paid' | 'unpaid' })}>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Default Wallet</label>
                  <select className="form-select" value={settings.defaultWalletId} onChange={e => updateSettings({ defaultWalletId: e.target.value })}>
                    {db.wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Categories Summary Card */}
        <div className="card settings-summary-card" onClick={() => setShowCategoriesSheet(true)}>
          <div className="settings-card-inner">
            <div className="settings-card-left">
              <div className="settings-card-icon">
                <Tag size={19} />
              </div>
              <div className="settings-card-text">
                <h2 className="settings-card-title">Categories</h2>
                <p className="settings-card-sub">
                  Manage category tags & color labels ({settings.categories.length} configured)
                </p>
              </div>
            </div>

            <div className="settings-card-right">
              <span className="badge settings-card-badge">
                {settings.categories.length} Tags
              </span>
              <ChevronRight className="settings-card-arrow" size={18} />
            </div>
          </div>
        </div>

        {/* Bottom Sheet Drawer Modal for Categories */}
        {showCategoriesSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowCategoriesSheet(false)}>
            <div className="sheet-modal sheet-modal-lg" onClick={(e) => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)',
                    display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0
                  }}>
                    <Tag size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Manage Category Tags
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '1px 0 0 0' }}>
                      {settings.categories.length} category tags configured
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11.5, gap: 4, padding: '4px 8px' }}
                    onClick={() => {
                      updateSettings({ categories: [...DEFAULT_CATEGORIES] });
                      showToast('Reset categories to default');
                    }}
                  >
                    <RotateCcw size={14} /> Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCategoriesSheet(false)}
                    style={{
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: '50%',
                      width: 32,
                      height: 32,
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--text-2)',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* All Category Chips Grid */}
              <div className="category-chip-list" style={{ marginBottom: 18 }}>
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
                  <div className="category-add-form" style={{ gridTemplateColumns: '1fr', gap: 14, marginTop: 14 }}>
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
          </div>,
          document.body
        )}

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
        <div className="card settings-summary-card" onClick={() => setShowDevSheet(true)}>
          <div className="settings-card-inner">
            <div className="settings-card-left">
              <div className="settings-card-icon">
                <FlaskConical size={19} />
              </div>
              <div className="settings-card-text">
                <h2 className="settings-card-title">Developer Mode</h2>
                <p className="settings-card-sub">
                  {isDevMode ? 'Experimental tools & developer features active' : 'Enable experimental tools & developer features'}
                </p>
              </div>
            </div>

            <div className="settings-card-right">
              <span className="badge settings-card-badge" style={{
                background: isDevMode ? 'var(--accent-soft)' : 'var(--surface2)',
                color: isDevMode ? 'var(--accent)' : 'var(--text-3)',
              }}>
                {isDevMode ? 'Enabled' : 'Disabled'}
              </span>
              <ChevronRight className="settings-card-arrow" size={18} />
            </div>
          </div>
        </div>

        {/* Bottom Sheet Drawer Modal for Experimental Features */}
        {showDevSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowDevSheet(false)}>
            <div className="sheet-modal" onClick={(e) => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: 'var(--accent-soft)',
                    display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0
                  }}>
                    <FlaskConical size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Experimental Features
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '1px 0 0 0' }}>
                      Toggle & test developer features
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDevSheet(false)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--text-2)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Master Developer Mode Toggle Row */}
              <div style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FlaskConical size={18} style={{ color: isDevMode ? 'var(--accent)' : 'var(--text-3)' }} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Enable Developer Mode</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Master switch for experimental tools</div>
                  </div>
                </div>
                <Switch
                  checked={isDevMode}
                  onChange={e => {
                    const checked = e.target.checked;
                    updateSettings({ devMode: checked });
                    showToast(checked ? 'Developer Mode enabled!' : 'Developer Mode disabled.');
                  }}
                  color="primary"
                />
              </div>

              {/* Single Column Clean List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: isDevMode ? 1 : 0.5, pointerEvents: isDevMode ? 'auto' : 'none', transition: 'all 0.2s ease' }}>
                {/* 1. SQL Console */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: (isDevMode && (settings.enableDevSQLConsole ?? true)) ? 'var(--accent-soft)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <Terminal size={17} style={{ color: (isDevMode && (settings.enableDevSQLConsole ?? true)) ? 'var(--accent)' : 'var(--text-3)' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>SQL Dev Console</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Execute raw AlaSQL queries
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {isDevMode && (settings.enableDevSQLConsole ?? true) && onNavigate && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setShowDevSheet(false); onNavigate('dev-sql'); }}
                        style={{ padding: '3px 10px', fontSize: 11.5, height: 28, gap: 4 }}
                      >
                        <Database size={13} /> Open
                      </button>
                    )}
                    <Switch
                      disabled={!isDevMode}
                      checked={isDevMode && (settings.enableDevSQLConsole ?? true)}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateSettings({ enableDevSQLConsole: enabled });
                        showToast(enabled ? 'SQL Dev Console enabled' : 'SQL Dev Console disabled');
                      }}
                      color="primary"
                      size="small"
                    />
                  </div>
                </div>

                {/* 2. AI Assistant */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: (isDevMode && (settings.enableAIAssistant ?? true)) ? 'var(--accent-soft)' : 'var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Sparkles size={17} style={{ color: (isDevMode && (settings.enableAIAssistant ?? true)) ? 'var(--accent)' : 'var(--text-3)' }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>AI Assistant (Max)</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Voice & floating AI trigger
                        </div>
                      </div>
                    </div>

                    <Switch
                      disabled={!isDevMode}
                      checked={isDevMode && (settings.enableAIAssistant ?? true)}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateSettings({ enableAIAssistant: enabled });
                        showToast(enabled ? 'AI Assistant enabled' : 'AI Assistant disabled');
                      }}
                      color="primary"
                      size="small"
                    />
                  </div>

                  {isDevMode && (settings.enableAIAssistant ?? true) && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      paddingTop: 8, borderTop: '1px solid var(--border)'
                    }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text-2)', fontWeight: 500 }}>Engine Mode</span>
                      <div style={{ display: 'flex', gap: 3, background: 'var(--surface)', padding: 2, borderRadius: 6, border: '1px solid var(--border)' }}>
                        <button
                          type="button"
                          disabled={!isDevMode}
                          onClick={() => {
                            updateSettings({ defaultAiEngine: 'offline' });
                            localStorage.setItem('ai_engine_mode', 'offline');
                            showToast('Set AI engine to Offline (Local)');
                          }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 4,
                            fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                            background: (settings.defaultAiEngine ?? 'offline') === 'offline' ? 'var(--accent-soft)' : 'transparent',
                            color: (settings.defaultAiEngine ?? 'offline') === 'offline' ? 'var(--accent)' : 'var(--text-3)'
                          }}
                        >
                          <Zap size={11} /> Offline
                        </button>
                        <button
                          type="button"
                          disabled={!isDevMode}
                          onClick={() => {
                            updateSettings({ defaultAiEngine: 'online' });
                            localStorage.setItem('ai_engine_mode', 'online');
                            showToast('Set AI engine to Gemini Cloud');
                          }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 4,
                            fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                            background: (settings.defaultAiEngine ?? 'offline') === 'online' ? 'var(--accent-soft)' : 'transparent',
                            color: (settings.defaultAiEngine ?? 'offline') === 'online' ? 'var(--accent)' : 'var(--text-3)'
                          }}
                        >
                          <Sparkles size={11} /> Gemini
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Split & Trips */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: (isDevMode && (settings.enableSplitTrips ?? true)) ? 'var(--accent-soft)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <Plane size={17} style={{ color: (isDevMode && (settings.enableSplitTrips ?? true)) ? 'var(--accent)' : 'var(--text-3)' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>Split & Trips</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Group ledgers & trip expense splitting
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {isDevMode && (settings.enableSplitTrips ?? true) && onNavigate && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setShowDevSheet(false); onNavigate('split-trips'); }}
                        style={{ padding: '3px 10px', fontSize: 11.5, height: 28, gap: 4 }}
                      >
                        <Plane size={13} /> Open
                      </button>
                    )}
                    <Switch
                      disabled={!isDevMode}
                      checked={isDevMode && (settings.enableSplitTrips ?? true)}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateSettings({ enableSplitTrips: enabled });
                        showToast(enabled ? 'Split & Trips enabled' : 'Split & Trips disabled');
                      }}
                      color="primary"
                      size="small"
                    />
                  </div>
                </div>

                {/* 4. Sample Data Loader */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: (isDevMode && (settings.enableSampleData ?? false)) ? 'var(--accent-soft)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <FlaskConical size={17} style={{ color: (isDevMode && (settings.enableSampleData ?? false)) ? 'var(--accent)' : 'var(--text-3)' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>Sample Data Loader</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Populate demo transactions & wallets
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {isDevMode && (settings.enableSampleData ?? false) && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleLoadSample}
                        style={{ padding: '3px 10px', fontSize: 11.5, height: 28, gap: 4 }}
                      >
                        Load
                      </button>
                    )}
                    <Switch
                      disabled={!isDevMode}
                      checked={isDevMode && (settings.enableSampleData ?? false)}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateSettings({ enableSampleData: enabled });
                        showToast(enabled ? 'Sample Data Loader enabled' : 'Sample Data Loader disabled');
                      }}
                      color="primary"
                      size="small"
                    />
                  </div>
                </div>

                {/* 5. User Guide */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: (isDevMode && (settings.enableUserGuide ?? false)) ? 'var(--accent-soft)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <HelpCircle size={17} style={{ color: (isDevMode && (settings.enableUserGuide ?? false)) ? 'var(--accent)' : 'var(--text-3)' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>User Guide & Tour</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Interactive guide & walkthrough
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {isDevMode && (settings.enableUserGuide ?? false) && onStartExpenseTutorial && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setShowDevSheet(false); onStartExpenseTutorial(); }}
                        style={{ padding: '3px 10px', fontSize: 11.5, height: 28, gap: 4 }}
                      >
                        Tour
                      </button>
                    )}
                    <Switch
                      disabled={!isDevMode}
                      checked={isDevMode && (settings.enableUserGuide ?? false)}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateSettings({ enableUserGuide: enabled });
                        showToast(enabled ? 'User Guide enabled' : 'User Guide disabled');
                      }}
                      color="primary"
                      size="small"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Data Summary Card */}
        <div className="card settings-summary-card" onClick={() => setShowDataSheet(true)}>
          <div className="settings-card-inner">
            <div className="settings-card-left">
              <div className="settings-card-icon">
                <Database size={19} />
              </div>
              <div className="settings-card-text">
                <h2 className="settings-card-title">Data</h2>
                <p className="settings-card-sub">
                  Export backup, import data, or reset storage
                </p>
              </div>
            </div>

            <div className="settings-card-right">
              <ChevronRight className="settings-card-arrow" size={18} />
            </div>
          </div>
        </div>

        {/* Bottom Sheet Drawer Modal for Data */}
        {showDataSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowDataSheet(false)}>
            <div className="sheet-modal" onClick={(e) => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)',
                    display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0
                  }}>
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Data
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '1px 0 0 0' }}>
                      Export, import, or manage local storage
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDataSheet(false)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--text-2)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Action Buttons Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
                <button type="button" className="data-action-card" onClick={() => { setShowDataSheet(false); handleExportClick(); }}>
                  <Download size={24} />
                  <span className="data-action-label" style={{ fontWeight: 600 }}>Export</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Save or share backup</span>
                </button>

                <button type="button" className="data-action-card" onClick={() => fileRef.current?.click()}>
                  <Upload size={24} />
                  <span className="data-action-label" style={{ fontWeight: 600 }}>Import</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Restore from backup</span>
                </button>

                {settings.devMode && (settings.enableSampleData ?? false) && (
                  <button type="button" className="data-action-card" onClick={handleLoadSample}>
                    <FlaskConical size={24} />
                    <span className="data-action-label" style={{ fontWeight: 600 }}>Sample Data</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Load Demo</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="*/*" style={{ display: 'none' }} onChange={handleImport} />
              </div>

              <div className="data-reset-row" onClick={() => { setShowDataSheet(false); setShowReset(true); }} role="button" tabIndex={0}>
                <div className="data-reset-left">
                  <Trash2 size={20} />
                  <span>Reset all data</span>
                </div>
                <ChevronRight size={20} style={{ color: 'var(--text-3)' }} />
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Report a Bug / Suggest a Feature Card (Only visible when Dev Mode is active) */}
        {isDevMode && (
          <div className="card settings-summary-card" onClick={() => setShowFeedbackSheet(true)}>
            <div className="settings-card-inner">
              <div className="settings-card-left">
                <div className="settings-card-icon">
                  <MessageSquarePlus size={19} />
                </div>
                <div className="settings-card-text">
                  <h2 className="settings-card-title">
                    Report Bug / Feature Request
                  </h2>
                  <p className="settings-card-sub">
                    Submit feedback, bug report, or feature request
                  </p>
                </div>
              </div>

              <div className="settings-card-right">
                <ChevronRight className="settings-card-arrow" size={18} />
              </div>
            </div>
          </div>
        )}

        {/* Bottom Sheet Drawer Modal for Report Bug / Suggest Feature */}
        {showFeedbackSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowFeedbackSheet(false)}>
            <div className="sheet-modal" onClick={(e) => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)',
                    display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0
                  }}>
                    <MessageSquarePlus size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Report Bug / Feature Request
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '1px 0 0 0' }}>
                      Create an issue on prathambahekar/okane
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFeedbackSheet(false)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--text-2)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSendFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Type Selection */}
                <div>
                  <label className="form-label" style={{ marginBottom: 8, display: 'block', fontSize: 12.5, fontWeight: 600 }}>
                    Feedback Type
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setFeedbackType('bug')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius)',
                        border: feedbackType === 'bug' ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: feedbackType === 'bug' ? 'var(--accent-soft)' : 'var(--surface2)',
                        color: 'var(--text)',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Bug size={16} style={{ color: feedbackType === 'bug' ? 'var(--accent)' : 'var(--text-2)' }} />
                      <span>Bug / Issue</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFeedbackType('feature')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius)',
                        border: feedbackType === 'feature' ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: feedbackType === 'feature' ? 'var(--accent-soft)' : 'var(--surface2)',
                        color: 'var(--text)',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Lightbulb size={16} style={{ color: feedbackType === 'feature' ? 'var(--accent)' : 'var(--text-2)' }} />
                      <span>Suggest Feature</span>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600 }}>
                    Title
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={feedbackTitle}
                    onChange={(e) => setFeedbackTitle(e.target.value)}
                    placeholder={feedbackType === 'bug' ? "e.g., Error when settling friend balance" : "e.g., Add custom tags for expense search"}
                    required
                  />
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600 }}>
                    Description
                  </label>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={feedbackDescription}
                    onChange={(e) => setFeedbackDescription(e.target.value)}
                    placeholder={feedbackType === 'bug' ? "Describe what happened, expected behavior, or steps to reproduce..." : "Describe the feature idea and how it would improve the app..."}
                    required
                    style={{ resize: 'vertical', minHeight: 90 }}
                  />
                </div>

                {/* App Version Checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface2)', padding: '10px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <input
                    type="checkbox"
                    id="includeVersionInfo"
                    checked={includeVersionInfo}
                    onChange={(e) => setIncludeVersionInfo(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  <label htmlFor="includeVersionInfo" style={{ fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', flex: 1, userSelect: 'none' }}>
                    Include current app version (<strong style={{ color: 'var(--text)' }}>v{String(settings.installedVersion || jsonSettings.appVersion || '0.8.2')}</strong>) & device details
                  </label>
                </div>

                {/* Action Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <GitPullRequest size={13} />
                    <span>Target Repo: prathambahekar/okane</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={isSubmittingFeedback || !feedbackTitle.trim() || !feedbackDescription.trim()}
                      style={{ fontSize: 12.5, fontWeight: 700, padding: '8px 18px', borderRadius: 8, gap: 6 }}
                    >
                      {isSubmittingFeedback ? (
                        <>
                          <RefreshCw size={14} className="spin" />
                          <span>Creating Issue...</span>
                        </>
                      ) : (
                        <>
                          <GitPullRequest size={15} />
                          <span>Submit Issue</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* GitHub PAT field */}
                <div style={{ marginTop: 2, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                  <details open={Boolean(errorMessage && errorMessage.includes('Token'))} style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text)', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <GitPullRequest size={14} style={{ color: 'var(--accent)' }} />
                      <span>GitHub Personal Access Token Settings</span>
                    </summary>
                    
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface2)', padding: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                        <strong style={{ color: 'var(--text)' }}>What is this token?</strong>
                        <br />
                        GitHub requires authentication to create issues on repository <code style={{ background: 'var(--surface)', padding: '1px 5px', borderRadius: 4, color: 'var(--accent)' }}>prathambahekar/okane</code> without opening the web form manually.
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)' }}>
                          Paste GitHub Token here:
                        </label>
                        <input
                          type="password"
                          className="form-input"
                          value={githubTokenInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGithubTokenInput(val);
                            localStorage.setItem('okane_github_token', val.trim());
                          }}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          style={{ fontSize: 12, padding: '8px 12px', fontFamily: 'monospace' }}
                        />
                      </div>
                    </div>
                  </details>
                </div>

                {/* Success Notification */}
                {feedbackStatus === 'success' && createdIssueInfo && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: 10, color: '#22c55e', fontSize: 12.5, fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={18} />
                      <span>Issue #{createdIssueInfo.number} created!</span>
                    </div>
                    <a
                      href={createdIssueInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#22c55e', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                    >
                      <span>View Issue</span>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                )}

                {/* Error Notification */}
                {feedbackStatus === 'error' && errorMessage && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 10, color: '#ef4444', fontSize: 12.5 }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <X size={16} />
                      <span>Unable to create GitHub issue</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>
                      {errorMessage}
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* App Version Summary Card */}
        <div className="card settings-summary-card" onClick={() => setShowVersionSheet(true)}>
          <div className="settings-card-inner">
            <div className="settings-card-left">
              <div className="settings-card-icon">
                <HelpCircle size={19} />
              </div>
              <div className="settings-card-text">
                <h2 className="settings-card-title">App Info & Version</h2>
                <p className="settings-card-sub">
                  Check for updates, release notes & app info
                </p>
              </div>
            </div>

            <div className="settings-card-right">
              <span className="badge settings-card-badge">
                v{String(settings.installedVersion || jsonSettings.appVersion || '0.8.2')}
              </span>
              <ChevronRight className="settings-card-arrow" size={18} />
            </div>
          </div>
        </div>

        {/* Bottom Sheet Drawer Modal for App Version */}
        {showVersionSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowVersionSheet(false)}>
            <div className="sheet-modal" onClick={(e) => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)',
                    display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0
                  }}>
                    <HelpCircle size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      App Version & Info
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '1px 0 0 0' }}>
                      v{String(settings.installedVersion || jsonSettings.appVersion || '0.8.2')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowVersionSheet(false)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--text-2)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Software Update Status Panel */}
              {availableUpdate ? (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  marginBottom: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ArrowUpCircle size={18} style={{ color: '#2563eb', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                          v{availableUpdate.version} Available
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                          Build #{availableUpdate.buildNumber} · {availableUpdate.releaseDate}
                        </div>
                      </div>
                    </div>
                    {!isUpdating && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => installUpdate()}
                        style={{ gap: 5, padding: '5px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 600 }}
                      >
                        <Download size={12} /> Download
                      </button>
                    )}
                  </div>
                  {isUpdating && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontWeight: 600, marginBottom: 3 }}>
                        <span>{updateStatusMessage}</span>
                        <span>{updateProgress}%</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--surface3)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${updateProgress}%`, background: 'var(--text)', borderRadius: 99 }} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 auto' }}>
                    <CheckCircle2 size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>Up to date</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      • Checked {settings.lastUpdateCheck || String(jsonSettings.lastUpdated || 'Today')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => checkForUpdates(true)}
                    disabled={isCheckingUpdate}
                    style={{ gap: 6, fontSize: 11.5, padding: '5px 12px', borderRadius: 8, fontWeight: 600, flexShrink: 0 }}
                  >
                    <RefreshCw size={12} className={isCheckingUpdate ? 'spin' : ''} />
                    {isCheckingUpdate ? 'Checking...' : 'Check Updates'}
                  </button>
                </div>
              )}

              {/* Action Toolbar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 12,
                flexWrap: 'wrap'
              }}>
                <button
                  type="button"
                  onClick={() => { setShowVersionSheet(false); setHistoryModalOpen(true); }}
                  style={{
                    flex: '1 1 auto',
                    minWidth: '120px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <History size={14} style={{ color: 'var(--text-2)' }} />
                  <span>Version History</span>
                  {releaseHistory.length > 0 && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: 'var(--surface3)', color: 'var(--text-2)', fontWeight: 600 }}>
                      {releaseHistory.length}
                    </span>
                  )}
                </button>

                {isDevMode && (
                  <button
                    type="button"
                    onClick={() => setShowJsonView(!showJsonView)}
                    style={{
                      flex: '1 1 auto',
                      minWidth: '110px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: '1px solid var(--border)',
                      background: showJsonView ? 'var(--surface3)' : 'var(--surface2)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                    }}
                  >
                    <FileCode size={14} />
                    <span>{showJsonView ? 'Hide JSON' : 'settings.json'}</span>
                  </button>
                )}

                <a
                  href="https://github.com/prathambahekar/okane/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '8px 12px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-2)',
                    textDecoration: 'none',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <span>GitHub</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              {isDevMode && showJsonView && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)' }}>public/settings.json</span>
                    <a href="/settings.json" target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: 'var(--accent)', textDecoration: 'none' }}>
                      Open Raw File ↗
                    </a>
                  </div>
                  <pre style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    background: 'var(--surface2)',
                    padding: 10,
                    borderRadius: 6,
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
          </div>,
          document.body
        )}
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

      {/* Export Options Modal */}
      {exportModalOpen && createPortal(
        <div
          className="modal-backdrop"
          style={{ zIndex: 99999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setExportModalOpen(false);
          }}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '380px',
              padding: '20px 22px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div className="modal-handle-bar">
              <div className="modal-handle" />
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '12px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'grid',
                  placeItems: 'center'
                }}>
                  <Download size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700, color: 'var(--text)' }}>
                    Export Backup
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                    Save or share your backup file
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text-2)',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Export Method Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Option 1: Save to Storage */}
              <button
                type="button"
                onClick={handleSaveToStorage}
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}>
                    <Download size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                      Export to Storage
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '2px' }}>
                      Save file directly to Downloads folder
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--text-3)' }} />
              </button>

              {/* Option 2: Share to Apps */}
              <button
                type="button"
                onClick={handleShareToApps}
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(34, 197, 94, 0.12)',
                    color: '#22c55e',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}>
                    <Send size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                      Share to Apps
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '2px' }}>
                      Send via WhatsApp, Telegram, Drive, Email
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--text-3)' }} />
              </button>
            </div>

            {/* Cancel */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setExportModalOpen(false)}
              style={{ width: '100%', marginTop: '4px' }}
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Release History Modal */}
      {historyModalOpen && createPortal(
        <div
          className="modal-backdrop"
          style={{ zIndex: 99999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryModalOpen(false);
          }}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '460px',
              maxHeight: '85vh',
              padding: '20px 22px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div className="modal-handle-bar">
              <div className="modal-handle" />
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'var(--surface2)',
                  color: 'var(--text-2)',
                  display: 'grid',
                  placeItems: 'center'
                }}>
                  <GitCommit size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                    Release History
                  </h3>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
                    prathambahekar/okane
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text-2)',
                  cursor: 'pointer'
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* List */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              overflowY: 'auto',
              maxHeight: '55vh',
              paddingRight: '2px'
            }}>
              {releaseHistory.length === 0 ? (
                <div style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--text-3)',
                  fontSize: '13px',
                  fontStyle: 'italic'
                }}>
                  No release history loaded yet. Click "Check Updates" in settings to fetch releases.
                </div>
              ) : (
                releaseHistory.map((item, idx) => {
                  const currentVer = settings.installedVersion || jsonSettings.appVersion || '0.8.2';
                  const normalizedItemVer = item.version.replace(/^v/, '').trim();
                  const normalizedCurrentVer = String(currentVer).replace(/^v/, '').trim();
                  const isCurrent = normalizedItemVer === normalizedCurrentVer;
                  const hasNotes = item.releaseNotes && item.releaseNotes.trim() !== 'No release notes provided.';

                  return (
                    <div
                      key={item.version + '_' + idx}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                            {item.name || `v${item.version}`}
                          </span>
                          {isCurrent && (
                            <span style={{
                              fontSize: 9.5,
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: 99,
                              background: 'rgba(34, 197, 94, 0.12)',
                              color: '#22c55e',
                              border: '1px solid rgba(34, 197, 94, 0.25)'
                            }}>
                              Installed
                            </span>
                          )}
                          {item.isPrerelease && (
                            <span style={{
                              fontSize: 9.5,
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: 99,
                              background: 'rgba(245, 158, 11, 0.12)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245, 158, 11, 0.2)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3
                            }}>
                              <FlaskConical size={10} />
                              Pre-release
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 10.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                          {item.releaseDate}
                        </span>
                      </div>

                      {hasNotes && (
                        <p style={{
                          fontSize: 11.5,
                          color: 'var(--text-2)',
                          margin: '2px 0 4px 0',
                          lineHeight: 1.35,
                          whiteSpace: 'pre-line'
                        }}>
                          {item.releaseNotes}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 2 }}>
                        <a
                          href={item.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 11,
                            color: 'var(--text-2)',
                            fontWeight: 500,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3
                          }}
                        >
                          <span>View on GitHub</span>
                          <ExternalLink size={10} style={{ color: 'var(--text-3)' }} />
                        </a>
                        {item.downloadUrl && (
                          <a
                            href={item.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 11,
                              color: 'var(--text-3)',
                              fontWeight: 500,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              marginLeft: 'auto'
                            }}
                          >
                            <Download size={10} />
                            <span>Download</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setHistoryModalOpen(false)}
              style={{ width: '100%', borderRadius: '12px', padding: '10px' }}
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
