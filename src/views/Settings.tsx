import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useColorMode, ACCENT_PRESETS } from '../theme';
import Switch from '@mui/material/Switch';
import { Plus, X, RotateCcw, Tag, Upload, FlaskConical, Trash2, ChevronRight, ChevronDown, Edit2, Palette, ExternalLink, Sparkles, Zap, FileCode, Check, Database, Terminal, Download, RefreshCw, ArrowUpCircle, CheckCircle2, History, GitCommit, Plane, Send, HelpCircle, MessageSquarePlus, Bug, Lightbulb, GitPullRequest, Sliders, Moon, Sun, Compass, ShieldCheck, Fingerprint, Lock, KeyRound, Smartphone, EyeOff, Eye, ArrowLeft, Search, ScanFace, Keyboard as KeyboardIcon, Coins, Wallet, Layout } from 'lucide-react';
import { useStore } from '../store';
import { CURRENCIES, DEFAULT_CATEGORIES, FRIEND_PALETTE, generateSQLDumpString, importSQLDumpString } from '../db';
import type { Category, AppDB, ViewName } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from 'capacitor-native-biometric';
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

import CategoryIcon, { AVAILABLE_ICONS } from '../components/CategoryIcon';
import PinSetupDrawer from '../components/PinSetupDrawer';
import { CURRENT_APP_VERSION } from '../utils/updateManager';
import { showSoftKeyboard } from '../utils/keyboard';

function ColorPickerSection({ color, onChangeColor }: { color: string; onChangeColor: (c: string) => void }) {
  const isCustom = !FRIEND_PALETTE.includes(color);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const safeHex = useMemo(() => {
    if (color && color.startsWith('#') && (color.length === 7 || color.length === 4)) {
      if (color.length === 4) {
        return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
      }
      return color;
    }
    return '#6366F1';
  }, [color]);

  const handleCustomClick = () => {
    const inputEl = colorInputRef.current;
    if (inputEl) {
      const elWithPicker = inputEl as HTMLInputElement & { showPicker?: () => void };
      if (typeof elWithPicker.showPicker === 'function') {
        try {
          elWithPicker.showPicker();
        } catch {
          inputEl.click();
        }
      } else {
        inputEl.click();
      }
    }
  };

  return (
    <div className="category-color-picker">
      {FRIEND_PALETTE.map(c => (
        <button
          key={c}
          type="button"
          className={`color-swatch-btn ${color === c ? 'selected' : ''}`}
          style={{
            background: c,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => onChangeColor(c)}
          aria-label={`Select color ${c}`}
        >
          {color === c && (
            <Check size={14} style={{ color: '#ffffff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
          )}
        </button>
      ))}
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          type="button"
          className={`color-swatch-btn ${isCustom ? 'selected' : ''}`}
          onClick={handleCustomClick}
          style={{
            background: isCustom ? color : 'var(--surface2, #2a2a32)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: isCustom ? 'none' : '1.5px dashed var(--border, rgba(255,255,255,0.4))',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
          title="Choose Custom Color"
        >
          {isCustom ? (
            <Check size={14} style={{ color: '#ffffff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
          ) : (
            <Palette size={14} style={{ color: 'var(--text-2)' }} />
          )}
        </button>
        <input
          ref={colorInputRef}
          type="color"
          value={safeHex}
          onChange={(e) => onChangeColor(e.target.value)}
          onInput={(e) => onChangeColor((e.target as HTMLInputElement).value)}
          aria-label="Custom color picker"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            border: 'none',
            padding: 0,
            margin: 0,
          }}
        />
      </div>
    </div>
  );
}

function FormattedReleaseNotes({ notes }: { notes: string }) {
  if (!notes || notes.trim() === 'No release notes provided.') {
    return null;
  }

  const items: Array<
    | { type: 'text'; text: string }
    | { type: 'bullet'; text: string }
    | { type: 'image'; src: string; alt?: string }
  > = [];

  const lines = notes.split('\n');

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>/gi;
    let match: RegExpExecArray | null;
    let lastIdx = 0;

    while ((match = imgRegex.exec(line)) !== null) {
      const precedingText = line.substring(lastIdx, match.index).trim();
      if (precedingText) {
        if (precedingText.startsWith('- ') || precedingText.startsWith('* ')) {
          items.push({ type: 'bullet', text: precedingText.substring(2).trim() });
        } else {
          items.push({ type: 'text', text: precedingText });
        }
      }

      const src = match[1];
      const altMatch = match[0].match(/alt=["']([^"']+)["']/i);
      items.push({ type: 'image', src, alt: altMatch ? altMatch[1] : 'Release screenshot' });
      lastIdx = imgRegex.lastIndex;
    }

    const rest = line.substring(lastIdx).trim();
    if (rest) {
      const mdMatch = rest.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (mdMatch) {
        items.push({ type: 'image', src: mdMatch[2], alt: mdMatch[1] || 'Release screenshot' });
      } else if (rest.startsWith('- ') || rest.startsWith('* ')) {
        items.push({ type: 'bullet', text: rest.substring(2).trim() });
      } else {
        items.push({ type: 'text', text: rest });
      }
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', marginBottom: '6px' }}>
      {items.map((item, idx) => {
        if (item.type === 'image') {
          return (
            <a
              key={idx}
              href={item.src}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                marginTop: '4px',
                marginBottom: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
              }}
            >
              <img
                src={item.src}
                alt={item.alt || 'Release preview'}
                loading="lazy"
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '260px',
                  objectFit: 'cover',
                  display: 'block',
                  borderRadius: '11px'
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </a>
          );
        }

        if (item.type === 'bullet') {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12.5px', color: 'var(--text-2)', lineHeight: 1.45 }}>
              <span style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'var(--accent)',
                marginTop: 6,
                flexShrink: 0
              }} />
              <span>{item.text}</span>
            </div>
          );
        }

        return (
          <p key={idx} style={{ fontSize: '12.5px', color: 'var(--text-2)', margin: 0, lineHeight: 1.45 }}>
            {item.text}
          </p>
        );
      })}
    </div>
  );
}

export default function Settings({
  onNavigate,
  onOpenGuide,
  onStartExpenseTutorial,
  initialArg,
  onTestLock,
}: {
  onNavigate?: (v: ViewName, arg?: string) => void;
  onOpenGuide?: () => void;
  onStartExpenseTutorial?: () => void;
  initialArg?: string;
  onClearViewArg?: () => void;
  onTestLock?: () => void;
}) {
  const {
    db, updateSettings, updateCategory, resetDB, restoreDB, showToast,
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

  const { mode, toggleMode, accent, setAccent } = useColorMode();
  const isDark = mode === 'dark';
  const [appearanceSubView, setAppearanceSubView] = useState<'main' | 'more'>('main');
  const [categorySubView, setCategorySubView] = useState<'list' | 'add'>('list');
  const isDevMode = settings.devMode ?? false;
  const displayReleaseHistory = useMemo(() => {
    if (isDevMode) return releaseHistory;
    return releaseHistory.filter(item => !item.isPrerelease);
  }, [releaseHistory, isDevMode]);
  const [showDevSheet, setShowDevSheet] = useState(false);
  const [showAppearanceSheet, setShowAppearanceSheet] = useState(false);
  const [showPerformanceSheet, setShowPerformanceSheet] = useState(false);
  const [showAdvancedSheet, setShowAdvancedSheet] = useState(false);
  const [showCategoriesSheet, setShowCategoriesSheet] = useState(false);
  const [showPreferencesSheet, setShowPreferencesSheet] = useState(false);
  const [showCurrencySheet, setShowCurrencySheet] = useState(false);
  const [currencySearchQuery, setCurrencySearchQuery] = useState('');
  const currencySearchInputRef = useRef<HTMLInputElement>(null);
  const newCatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCurrencySheet) {
      const timer = setTimeout(() => {
        if (currencySearchInputRef.current && (settings.autoOpenKeyboard ?? false)) {
          showSoftKeyboard(currencySearchInputRef.current, { placeCursorAtEnd: true, scroll: true });
        }
      }, 90);
      return () => clearTimeout(timer);
    }
  }, [showCurrencySheet, settings.autoOpenKeyboard]);

  useEffect(() => {
    if (categorySubView === 'add' && showCategoriesSheet) {
      const timer = setTimeout(() => {
        if (newCatInputRef.current && (settings.autoOpenKeyboard ?? false)) {
          showSoftKeyboard(newCatInputRef.current, { placeCursorAtEnd: true, scroll: true });
        }
      }, 90);
      return () => clearTimeout(timer);
    }
  }, [categorySubView, showCategoriesSheet, settings.autoOpenKeyboard]);

  const filteredCurrencies = useMemo(() => {
    const q = currencySearchQuery.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q)
    );
  }, [currencySearchQuery]);
  const [showDataSheet, setShowDataSheet] = useState(false);
  const [showVersionSheet, setShowVersionSheet] = useState(false);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [showSecuritySheet, setShowSecuritySheet] = useState(false);
  const [isPinSetupActive, setIsPinSetupActive] = useState(false);

  const isLockEnabled = Boolean(settings.enableSecurityLock ?? settings.enableBiometricLock);
  const isBiometricEnabled = Boolean(settings.enableBiometricLock ?? false);

  const handleToggleSecurityLock = (enabled: boolean) => {
    if (enabled) {
      if (!settings.securityPin) {
        setIsPinSetupActive(true);
        return;
      }
      updateSettings({ enableSecurityLock: true });
      showToast('PIN Security Lock enabled!');
    } else {
      updateSettings({ enableSecurityLock: false, enableBiometricLock: false });
      showToast('Security lock disabled.');
    }
  };

  const handleToggleBiometricOnly = async (enabled: boolean) => {
    if (enabled) {
      if (!isLockEnabled) {
        if (!settings.securityPin) {
          setIsPinSetupActive(true);
          return;
        }
        updateSettings({ enableSecurityLock: true, enableBiometricLock: true });
      }

      if (Capacitor.isNativePlatform()) {
        try {
          const available = await NativeBiometric.isAvailable();
          if (available.isAvailable) {
            await NativeBiometric.verifyIdentity({
              reason: 'Confirm Biometric Activation',
              title: 'Okane Biometrics',
              subtitle: 'Scan your fingerprint or face to enable',
              description: 'Verify identity',
            });
          }
        } catch {
          showToast('Biometric authentication cancelled or failed.');
          return;
        }
      }

      updateSettings({ enableBiometricLock: true, enableSecurityLock: true });
      showToast('Biometric unlock enabled!');
    } else {
      updateSettings({ enableBiometricLock: false });
      showToast('Biometric unlock disabled. (PIN lock remains active)');
    }
  };
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const handledArgRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialArg) {
      handledArgRef.current = null;
      return;
    }
    if (handledArgRef.current === initialArg) return;
    handledArgRef.current = initialArg;

    const timer = setTimeout(() => {
      if (initialArg === 'user-guide') {
        onOpenGuide?.();
        return;
      }
      if (initialArg === 'dev-mode') {
        onNavigate?.('dev-sql');
        return;
      }

      const sheetMap: Record<string, () => void> = {
        'appearance': () => setShowAppearanceSheet(true),
        'preferences': () => setShowPreferencesSheet(true),
        'categories': () => setShowCategoriesSheet(true),
        'data-backup': () => setShowDataSheet(true),
        'advanced-features': () => setShowAdvancedSheet(true),
        'performance': () => setShowPerformanceSheet(true),
        'app-info': () => setShowVersionSheet(true),
        'feedback': () => setShowFeedbackSheet(true),
      };

      if (sheetMap[initialArg]) {
        sheetMap[initialArg]();
      } else {
        const el = document.getElementById(`setting-${initialArg}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [initialArg, onOpenGuide, onNavigate]);

  const [jsonSettings, setJsonSettings] = useState<Record<string, unknown>>({
    appName: "Okane",
    appVersion: CURRENT_APP_VERSION,
    buildNumber: "108",
    updateChannel: "release",
    autoCheckUpdates: true,
    enableAIAssistant: true,
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

    const appVersion = String(settings.installedVersion || jsonSettings.appVersion || CURRENT_APP_VERSION);
    const platformName = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'Web Browser';
    const token = githubTokenInput.trim() || localStorage.getItem('okane_github_token')?.trim() || '';

    const bodyContent = `${trimmedDesc}\n\n---\n**Metadata:**\n- Type: ${feedbackType}\n${includeVersionInfo ? `- Version: ${appVersion}\n- Platform: ${platformName}\n- User Agent: ${navigator.userAgent}` : ''}`;

    // 1. If GitHub Token is provided, post directly to GitHub API
    if (token) {
      try {
        const ghRes = await fetch('https://api.github.com/repos/prathambahekar/okane/issues', {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: `[${feedbackType.toUpperCase()}] ${trimmedTitle}`,
            body: bodyContent,
            labels: [feedbackType === 'bug' ? 'bug' : 'enhancement'],
          }),
        });

        let data: { html_url?: string; number?: number; message?: string } | null = null;
        try {
          data = await ghRes.json();
        } catch {
          data = null;
        }

        if (ghRes.ok && data?.html_url && data?.number) {
          localStorage.setItem('okane_github_token', token);
          setCreatedIssueInfo({ url: data.html_url, number: data.number });
          setFeedbackStatus('success');
          showToast(`Issue #${data.number} created automatically!`);
          setFeedbackTitle('');
          setFeedbackDescription('');
          return;
        } else {
          const errText = data?.message || (ghRes.status === 401 ? 'Invalid or expired GitHub Personal Access Token. Please check your token permissions (repo scope required).' : `GitHub API error (${ghRes.status})`);
          setErrorMessage(errText);
          setFeedbackStatus('error');
          showToast(errText);
          return;
        }
      } catch (err: unknown) {
        console.error('Direct GitHub API creation failed:', err);
        const message = err instanceof Error ? err.message : 'Failed to connect to GitHub API.';
        setErrorMessage(message);
        setFeedbackStatus('error');
        showToast('GitHub API connection failed.');
        return;
      } finally {
        setIsSubmittingFeedback(false);
      }
    }

    // 2. If no token, attempt backend proxy /api/github-issue if available
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
          platform: includeVersionInfo ? platformName : undefined,
          userAgent: includeVersionInfo ? navigator.userAgent : undefined,
          token: undefined,
        }),
      });

      let data: { success?: boolean; issueUrl?: string; issueNumber?: number; error?: string; code?: string } | null = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        const text = await res.text().catch(() => '');
        if (text) {
          try { data = JSON.parse(text); } catch { data = null; }
        }
      }

      if (res.ok && data?.success && data?.issueUrl) {
        setCreatedIssueInfo({ url: data.issueUrl, number: data.issueNumber || 0 });
        setFeedbackStatus('success');
        showToast(`Issue #${data.issueNumber || ''} created automatically!`);
        setFeedbackTitle('');
        setFeedbackDescription('');
        return;
      }

      if (data?.error && data.code !== 'MISSING_TOKEN') {
        setErrorMessage(data.error);
        setFeedbackStatus('error');
        showToast(data.error);
        return;
      }
    } catch (backendErr) {
      console.warn('Backend proxy /api/github-issue unavailable:', backendErr);
    } finally {
      setIsSubmittingFeedback(false);
    }

    // 3. Fallback when no token is configured & backend endpoint is unavailable
    setErrorMessage('GitHub Personal Access Token is required for direct API issue creation. You can enter a token below or click "Open Form on GitHub Web".');
    setFeedbackStatus('error');
    showToast('GitHub Access Token required for direct creation');
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
    setCategorySubView('list');
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

  const processImportText = (textToImport: string): boolean => {
    let text = textToImport;
    // Strip UTF-8 BOM if present
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }
    text = text.trim();

    if (!text) {
      showToast('Backup data is empty.');
      return false;
    }

    // Check for raw binary SQLite header
    if (text.startsWith('SQLite format 3')) {
      showToast('Selected file is a binary SQLite database. Okane expects an Okane .db/.sql text dump or .json backup file.');
      return false;
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
          showToast('Database backup imported successfully!');
          return true;
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
        showToast('Database backup imported successfully!');
        return true;
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
          return true;
        }
      }
    } catch {
      // ignore
    }

    // 4. Last fallback: Force SQL dump import
    try {
      const restoredDB = importSQLDumpString(text);
      restoreDB(restoredDB);
      showToast('Database backup imported successfully!');
      return true;
    } catch (finalSqlErr) {
      console.error('Final SQL import attempt failed:', finalSqlErr);
    }

    showToast('Invalid backup format. Please select a valid Okane .db, .sql, or .json backup.');
    return false;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let text = '';

      // Method 1: Modern Blob.prototype.text() Promise API
      if (typeof file.text === 'function') {
        try {
          text = await file.text();
        } catch (textErr) {
          console.warn('file.text() read attempt failed, trying FileReader fallback...', textErr);
        }
      }

      // Method 2: FileReader readAsText fallback
      if (!text) {
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string) || '');
          reader.onerror = (err) => reject(err);
          reader.readAsText(file);
        });
      }

      // Method 3: FileReader readAsArrayBuffer + TextDecoder fallback
      if (!text) {
        const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as ArrayBuffer) || new ArrayBuffer(0));
          reader.onerror = (err) => reject(err);
          reader.readAsArrayBuffer(file);
        });
        if (buf && buf.byteLength > 0) {
          text = new TextDecoder('utf-8').decode(buf);
        }
      }

      processImportText(text);
    } catch (err) {
      console.error('Import error:', err);
      showToast('Failed to read or import database file.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleReset = () => {
    resetDB();
    setShowReset(false);
    showToast('All data cleared');
  };

  return (
    <div className="view-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
        </div>
      </div>

      <div className="settings-cards-list">
        {/* Section 1: General & Customization */}
        <div className="settings-section-group">
          <div className="settings-section-label">General & Customization</div>

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
                        {isDark ? 'Dark Mode' : 'Light Mode'} • {ACCENT_PRESETS.find(p => p.id === accent)?.name || 'Monochrome'} • Mobile Search: {(settings.searchLocation ?? 'floating') === 'topbar' ? 'Top Bar' : 'Floating'}
                      </p>
                    </div>
                  </div>

                  <div className="settings-card-right">
                    <div className="settings-card-badge">
                      <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: accent === 'monochrome' ? (isDark ? '#ffffff' : '#111111') : (isDark ? ACCENT_PRESETS.find(p => p.id === accent)?.swatchDark : ACCENT_PRESETS.find(p => p.id === accent)?.swatchLight),
                        border: '1px solid rgba(0,0,0,0.15)',
                        flexShrink: 0
                      }} />
                      <span>{ACCENT_PRESETS.find(p => p.id === accent)?.name || 'Classic'}</span>
                    </div>
                    <ChevronRight className="settings-card-arrow" size={18} />
                  </div>
                </div>
              </div>

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
                      Currency ({settings.currency}), default category, wallet & mobile keyboard
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
          </div>

        {/* Bottom Sheet Drawer Modal for Appearance & Theme */}
        {showAppearanceSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => {
            setShowAppearanceSheet(false);
            setAppearanceSubView('main');
          }}>
            <div className="sheet-modal sheet-modal-lg" onClick={(e) => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {appearanceSubView === 'main' ? (
                <>
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
                      className="drawer-close-btn"
                      onClick={() => {
                        setShowAppearanceSheet(false);
                        setAppearanceSubView('main');
                      }}
                      style={{
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
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
                    marginBottom: 12
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

                  {/* More Appearance Drawer Trigger */}
                  <div style={{ marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={() => setAppearanceSubView('more')}
                      style={{
                        width: '100%',
                        padding: '13px 16px',
                        borderRadius: 14,
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: accent === 'monochrome' ? (isDark ? '#ffffff' : '#111111') : 'var(--accent)',
                          display: 'grid',
                          placeItems: 'center',
                          color: accent === 'monochrome' ? (isDark ? '#000000' : '#ffffff') : '#ffffff',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.18)',
                          flexShrink: 0,
                        }}>
                          <Palette size={15} />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>More Appearance</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                            Hide scrollbars & display options
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={18} style={{ color: 'var(--text-3)' }} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* More Appearance Sub-View Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setAppearanceSubView('main')}
                        style={{
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          width: 32,
                          height: 32,
                          display: 'grid',
                          placeItems: 'center',
                          color: 'var(--text-2)',
                          cursor: 'pointer',
                        }}
                        title="Back to appearance"
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                          More Appearance
                        </h3>
                        <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '1px 0 0 0' }}>
                          Interface & display options
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="drawer-close-btn"
                      onClick={() => {
                        setShowAppearanceSheet(false);
                        setAppearanceSubView('main');
                      }}
                      style={{
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        width: 32,
                        height: 32,
                        display: 'grid',
                        placeItems: 'center',
                        color: 'var(--text-2)',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Hide Scrollbars Toggle Row */}
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {(settings.hideScrollbar ?? true) ? (
                        <EyeOff size={18} style={{ color: accent === 'monochrome' ? (isDark ? '#ffffff' : '#111111') : 'var(--accent)' }} />
                      ) : (
                        <Eye size={18} style={{ color: accent === 'monochrome' ? (isDark ? '#ffffff' : '#111111') : 'var(--accent)' }} />
                      )}
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Hide Scrollbars</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Hide visible scrollbar tracks for a clean mobile app look</div>
                      </div>
                    </div>
                    <Switch
                      checked={settings.hideScrollbar ?? true}
                      onChange={(e) => {
                        const hide = e.target.checked;
                        updateSettings({ hideScrollbar: hide });
                        showToast(hide ? 'Scrollbars hidden (Clean mobile style)' : 'Scrollbars visible');
                      }}
                      color="primary"
                    />
                  </div>

                  {/* Search Location Choice Row */}
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    marginTop: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Search size={18} style={{ color: accent === 'monochrome' ? (isDark ? '#ffffff' : '#111111') : 'var(--accent)' }} />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Search Placement (Mobile)</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Choose floating quick button or top bar header on mobile (desktop is always floating)</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          updateSettings({ searchLocation: 'floating' });
                          localStorage.setItem('search_location', 'floating');
                          showToast('Search position set to Floating');
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: (settings.searchLocation ?? 'floating') === 'floating' ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: (settings.searchLocation ?? 'floating') === 'floating' ? 'var(--accent-soft)' : 'var(--surface)',
                          color: 'var(--text)',
                          fontSize: 12.5,
                          fontWeight: (settings.searchLocation ?? 'floating') === 'floating' ? 700 : 500,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: (settings.searchLocation ?? 'floating') === 'floating' ? 'var(--accent)' : 'var(--text-3)' }} />
                        <span>Floating</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateSettings({ searchLocation: 'topbar' });
                          localStorage.setItem('search_location', 'topbar');
                          showToast('Search position set to Top Bar');
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: (settings.searchLocation ?? 'floating') === 'topbar' ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: (settings.searchLocation ?? 'floating') === 'topbar' ? 'var(--accent-soft)' : 'var(--surface)',
                          color: 'var(--text)',
                          fontSize: 12.5,
                          fontWeight: (settings.searchLocation ?? 'floating') === 'topbar' ? 700 : 500,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: (settings.searchLocation ?? 'floating') === 'topbar' ? 'var(--accent)' : 'var(--text-3)' }} />
                        <span>Top Bar</span>
                      </button>
                    </div>
                  </div>

                  {/* Floating Sidebar Toggle Row (Desktop) */}
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    marginTop: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Layout size={18} style={{ color: accent === 'monochrome' ? (isDark ? '#ffffff' : '#111111') : 'var(--accent)' }} />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Floating Sidebar (Desktop)</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Detached floating rounded layout or docked full-height sidebar</div>
                      </div>
                    </div>
                    <Switch
                      checked={settings.floatingSidebar ?? false}
                      onChange={(e) => {
                        const isFloating = e.target.checked;
                        updateSettings({ floatingSidebar: isFloating });
                        showToast(isFloating ? 'Floating sidebar enabled' : 'Docked full-height sidebar enabled');
                      }}
                      color="primary"
                    />
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}

        {/* Bottom Sheet Drawer Modal for Performance & Animations */}
        {showPerformanceSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowPerformanceSheet(false)}>
            <div className="sheet-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-drag-handle" />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)',
                    display: 'grid', placeItems: 'center', color: 'var(--accent)', flexShrink: 0
                  }}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Performance & Animations
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '1px 0 0 0' }}>
                      Optimize app speed & page transition effects
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowPerformanceSheet(false)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
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

              {/* Toggle 1: UI Animations */}
              <div style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <Sliders size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>UI Animations & Transitions</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      Turn off for instant page switches on mobile
                    </div>
                  </div>
                </div>
                <Switch
                  checked={settings.enableAnimations ?? true}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    updateSettings({ enableAnimations: enabled });
                    showToast(enabled ? 'Animations enabled' : 'Animations disabled (Instant navigation)');
                  }}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: 'var(--accent)',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: 'var(--accent) !important',
                      opacity: '0.85 !important',
                    },
                  }}
                />
              </div>

              {/* Toggle 2: Ultra Performance Mode */}
              <div style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <Zap size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Ultra Performance Mode</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      Removes heavy blurs & shadows for maximum frame rate
                    </div>
                  </div>
                </div>
                <Switch
                  checked={settings.performanceMode ?? false}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    updateSettings({ performanceMode: enabled });
                    showToast(enabled ? 'Ultra Performance Mode enabled' : 'Standard Mode enabled');
                  }}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: 'var(--accent)',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: 'var(--accent) !important',
                      opacity: '0.85 !important',
                    },
                  }}
                />
              </div>

              {/* Toggle 3: Hide Scrollbars */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  {(settings.hideScrollbar ?? true) ? (
                    <EyeOff size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  ) : (
                    <Eye size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Hide Scrollbars</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      Hide visible scrollbars for a clean, mobile-native interface
                    </div>
                  </div>
                </div>
                <Switch
                  checked={settings.hideScrollbar ?? true}
                  onChange={(e) => {
                    const hide = e.target.checked;
                    updateSettings({ hideScrollbar: hide });
                    showToast(hide ? 'Scrollbars hidden (Clean mobile style)' : 'Scrollbars visible');
                  }}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: 'var(--accent)',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: 'var(--accent) !important',
                      opacity: '0.85 !important',
                    },
                  }}
                />
              </div>

              <div style={{
                fontSize: 12,
                color: 'var(--text-3)',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                lineHeight: 1.4
              }}>
                💡 <strong>Mobile performance tip:</strong> If page switching feels sluggish or stutters on your phone, turn off <strong>UI Animations</strong> or enable <strong>Ultra Performance Mode</strong> for instant, butter-smooth navigation.
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Bottom Sheet Drawer Modal for Preferences */}
        {showPreferencesSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowPreferencesSheet(false)}>
            <div className="sheet-modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '88vh', overflowY: 'auto' }}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: 'var(--accent-soft)',
                    border: '1px solid var(--accent)25',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--accent)',
                    flexShrink: 0
                  }}>
                    <Sliders size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16.5, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      App Preferences
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '2px 0 0 0' }}>
                      Configure currency, transaction defaults & input behavior
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowPreferencesSheet(false)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    width: 32,
                    height: 32,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--text-2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Section 1: Financial & Transaction Defaults */}
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 8,
                marginTop: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <Coins size={12} style={{ color: 'var(--accent)' }} />
                Transaction & Financial Defaults
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(() => {
                  const currentCurrency = CURRENCIES.find(c => c.code === settings.currency) || CURRENCIES[0];
                  const currentCategory = settings.categories.find(c => c.name === settings.defaultCategory) || settings.categories[0];
                  const currentWallet = db.wallets.find(w => w.id === settings.defaultWalletId) || db.wallets[0];

                  return (
                    <>
                      {/* 1. Currency Preference Card */}
                      <div
                        onClick={() => setShowCurrencySheet(true)}
                        style={{
                          position: 'relative',
                          padding: '12px 14px',
                          borderRadius: 14,
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: 11,
                            background: 'var(--accent-soft)',
                            border: '1px solid var(--accent)33',
                            display: 'grid',
                            placeItems: 'center',
                            color: 'var(--accent)',
                            fontWeight: 700,
                            fontSize: 16,
                            flexShrink: 0
                          }}>
                            {currentCurrency.symbol}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                              Default Currency
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {currentCurrency.name} ({currentCurrency.code})
                            </div>
                          </div>
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 11px',
                          borderRadius: 9,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                          fontSize: 12.5,
                          fontWeight: 600,
                          flexShrink: 0
                        }}>
                          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{currentCurrency.symbol}</span>
                          <span>{currentCurrency.code}</span>
                          <ChevronDown size={14} style={{ color: 'var(--text-3)', marginLeft: 2 }} />
                        </div>
                      </div>

                      {/* 2. Default Category Preference Card */}
                      <div
                        style={{
                          position: 'relative',
                          padding: '12px 14px',
                          borderRadius: 14,
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: 11,
                            background: 'var(--accent-soft)',
                            border: '1px solid var(--accent)33',
                            display: 'grid',
                            placeItems: 'center',
                            color: 'var(--accent)',
                            flexShrink: 0
                          }}>
                            <Tag size={18} style={{ color: 'var(--accent)' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                              Default Category
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                              Auto-assigned for new expenses
                            </div>
                          </div>
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '6px 11px',
                          borderRadius: 9,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                          fontSize: 12.5,
                          fontWeight: 600,
                          flexShrink: 0,
                          maxWidth: 140
                        }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {currentCategory?.name || 'Select'}
                          </span>
                          <ChevronDown size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                        </div>

                        {/* Transparent Native Select Trigger */}
                        <select
                          value={settings.defaultCategory}
                          onChange={(e) => {
                            updateSettings({ defaultCategory: e.target.value });
                            showToast(`Default category set to ${e.target.value}`);
                          }}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer'
                          }}
                        >
                          {settings.categories.map(c => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 3. Default Wallet Preference Card */}
                      <div
                        style={{
                          position: 'relative',
                          padding: '12px 14px',
                          borderRadius: 14,
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: 11,
                            background: 'var(--accent-soft)',
                            border: '1px solid var(--accent)33',
                            display: 'grid',
                            placeItems: 'center',
                            color: 'var(--accent)',
                            flexShrink: 0
                          }}>
                            <Wallet size={18} style={{ color: 'var(--accent)' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                              Default Wallet
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                              Primary account for payments & transfers
                            </div>
                          </div>
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '6px 11px',
                          borderRadius: 9,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                          fontSize: 12.5,
                          fontWeight: 600,
                          flexShrink: 0,
                          maxWidth: 140
                        }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {currentWallet?.name || 'Cash'}
                          </span>
                          <ChevronDown size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                        </div>

                        {/* Transparent Native Select Trigger */}
                        <select
                          value={settings.defaultWalletId}
                          onChange={(e) => {
                            updateSettings({ defaultWalletId: e.target.value });
                            const wName = db.wallets.find(w => w.id === e.target.value)?.name || 'Wallet';
                            showToast(`Default wallet set to ${wName}`);
                          }}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer'
                          }}
                        >
                          {db.wallets.map(w => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  );
                })()}

                {/* Section 2: Input Behavior */}
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 0,
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <KeyboardIcon size={12} style={{ color: 'var(--accent)' }} />
                  Mobile Input Preference
                </div>

                {/* Auto Open Mobile Keyboard Preference */}
                <div
                  onClick={() => {
                    const nextVal = !(settings.autoOpenKeyboard ?? false);
                    localStorage.setItem('auto_open_keyboard', String(nextVal));
                    updateSettings({ autoOpenKeyboard: nextVal });
                    showToast(nextVal ? 'Auto open keyboard enabled' : 'Auto open keyboard disabled');
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent)33',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--accent)',
                      flexShrink: 0,
                      marginTop: 1
                    }}>
                      <KeyboardIcon size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                        Auto Open Keyboard
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.35, marginTop: 1 }}>
                        Auto-open soft keyboard when focusing inputs & search
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={settings.autoOpenKeyboard ?? false}
                    onChange={(e) => {
                      const val = e.target.checked;
                      localStorage.setItem('auto_open_keyboard', String(val));
                      updateSettings({ autoOpenKeyboard: val });
                      showToast(val ? 'Auto open keyboard enabled' : 'Auto open keyboard disabled');
                    }}
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: 'var(--accent)',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: 'var(--accent) !important',
                        opacity: '0.85 !important',
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Bottom Sheet Drawer Modal for Categories */}
        {showCategoriesSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => {
            setShowCategoriesSheet(false);
            setCategorySubView('list');
          }}>
            <div
              className="sheet-modal sheet-modal-lg"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxHeight: '92vh',
              }}
            >
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {categorySubView === 'list' ? (
                <>
                  {/* Fixed Header */}
                  <div className="sheet-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                        className="drawer-close-btn"
                        onClick={() => {
                          setShowCategoriesSheet(false);
                          setCategorySubView('list');
                        }}
                        style={{
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
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

                  {/* Scrollable Body */}
                  <div className="sheet-modal-body">
                    {/* All Category Chips Grid */}
                    <div className="category-chip-list" style={{ marginBottom: 16 }}>
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

                    {/* Add New Category Trigger Row */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setCategorySubView('add')}
                        style={{
                          width: '100%',
                          padding: '13px 16px',
                          borderRadius: 14,
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: 'var(--accent-soft)',
                            display: 'grid',
                            placeItems: 'center',
                            color: 'var(--accent)',
                            flexShrink: 0,
                          }}>
                            <Plus size={16} />
                          </div>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                              Add New Category
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                              Create custom category tag, icon & color
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={18} style={{ color: 'var(--text-3)' }} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Fixed Add Category Subview Header without splitting lines */}
                  <div className="sheet-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 'none', paddingBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setCategorySubView('list')}
                        style={{
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          width: 32,
                          height: 32,
                          display: 'grid',
                          placeItems: 'center',
                          color: 'var(--text-2)',
                          cursor: 'pointer',
                        }}
                        title="Back to categories"
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                          Add New Category
                        </h3>
                        <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '1px 0 0 0' }}>
                          Create custom category tag, icon & color
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="drawer-close-btn"
                      onClick={() => {
                        setShowCategoriesSheet(false);
                        setCategorySubView('list');
                      }}
                      style={{
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
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

                  {/* Scrollable Form Body without splitting lines */}
                  <div className="sheet-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, border: 'none' }}>
                    <div className="form-group" style={{ marginBottom: 0, border: 'none' }}>
                      <label className="form-label" style={{ fontSize: 11.5 }}>Category Name</label>
                      <input
                        ref={newCatInputRef}
                        className="form-input"
                        value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                        placeholder="e.g. Subscriptions, Fuel, Food..."
                        onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0, border: 'none' }}>
                      <label className="form-label" style={{ fontSize: 11.5 }}>Color Tag</label>
                      <ColorPickerSection color={newCatColor} onChangeColor={setNewCatColor} />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0, border: 'none' }}>
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
                  </div>

                  {/* Fixed Bottom Action Footer without dividing border */}
                  <div className="sheet-modal-footer" style={{ display: 'flex', gap: 10, borderTop: 'none', paddingTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setCategorySubView('list')}
                      style={{ flex: 1, padding: '10px 16px', borderRadius: 10 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleAddCategory}
                      style={{ flex: 2, padding: '10px 16px', gap: 6, justifyContent: 'center', borderRadius: 10 }}
                    >
                      <Plus size={18} /> Add Category
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}

        {/* Bottom Sheet Drawer Modal for Currency Selection */}
        {showCurrencySheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowCurrencySheet(false)}>
            <div
              className="sheet-modal sheet-modal-lg"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {/* Header */}
              <div className="sheet-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: 'var(--accent-soft)',
                    border: '1px solid var(--accent)33',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--accent)',
                    flexShrink: 0
                  }}>
                    <Coins size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16.5, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Select Currency
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '2px 0 0 0' }}>
                      Choose your primary app currency & symbol
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowCurrencySheet(false)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--text-2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-3)',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  ref={currencySearchInputRef}
                  type="text"
                  value={currencySearchQuery}
                  onChange={(e) => setCurrencySearchQuery(e.target.value)}
                  placeholder="Search currency by code, name, country or symbol..."
                  className="form-input"
                  style={{
                    paddingLeft: 36,
                    paddingRight: currencySearchQuery ? 36 : 12,
                    minHeight: 40,
                    height: 40,
                    borderRadius: 12,
                    fontSize: 13.5
                  }}
                />
                {currencySearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrencySearchQuery('');
                      currencySearchInputRef.current?.focus();
                    }}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'var(--surface3)',
                      border: 'none',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--text-2)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Quick Suggested / Popular Currency Chips */}
              {!currencySearchQuery && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'var(--text-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 6
                  }}>
                    Popular Currencies
                  </div>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6
                  }}>
                    {['INR', 'USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'JPY', 'SGD', 'SAR'].map(code => {
                      const c = CURRENCIES.find(item => item.code === code);
                      if (!c) return null;
                      const isSelected = settings.currency === code;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => {
                            updateSettings({ currency: code });
                            showToast(`Default currency set to ${c.name} (${c.code})`);
                            setShowCurrencySheet(false);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 10px',
                            borderRadius: 9,
                            fontSize: 12,
                            fontWeight: isSelected ? 700 : 600,
                            background: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                            border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                            color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{c.symbol}</span>
                          <span>{c.code}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Scrollable Currency List */}
              <div className="sheet-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
                {filteredCurrencies.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '36px 16px',
                    color: 'var(--text-3)',
                    fontSize: 13
                  }}>
                    <Coins size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-2)' }}>No currencies found</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>Try searching with a different name, country or code</p>
                  </div>
                ) : (
                  filteredCurrencies.map((c) => {
                    const isSelected = settings.currency === c.code;
                    return (
                      <div
                        key={c.code}
                        onClick={() => {
                          updateSettings({ currency: c.code });
                          showToast(`Default currency set to ${c.name} (${c.code})`);
                          setShowCurrencySheet(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: 12,
                          background: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: isSelected ? 'var(--accent)' : 'var(--surface)',
                            color: isSelected ? 'var(--accent-contrast, #fff)' : 'var(--accent)',
                            border: '1px solid var(--border)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 15,
                            fontWeight: 750,
                            flexShrink: 0
                          }}>
                            {c.symbol}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                                {c.code}
                              </span>
                              <span style={{ fontSize: 13, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                — {c.name}
                              </span>
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                              {c.country} • Symbol: <strong style={{ color: 'var(--text-2)' }}>{c.symbol}</strong>
                            </div>
                          </div>
                        </div>

                        <div style={{ flexShrink: 0 }}>
                          {isSelected ? (
                            <div style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: 'var(--accent)',
                              color: 'var(--accent-contrast, #fff)',
                              display: 'grid',
                              placeItems: 'center'
                            }}>
                              <Check size={14} strokeWidth={3} />
                            </div>
                          ) : (
                            <span style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: 'var(--text-3)',
                              background: 'var(--surface)',
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: '1px solid var(--border)'
                            }}>
                              {c.symbol}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
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

        {/* Section 2: Data & Storage */}
        <div className="settings-section-group">
          <div className="settings-section-label">Data & Storage</div>

          {/* Data Summary Card */}
          <div className="card settings-summary-card" onClick={() => setShowDataSheet(true)}>
            <div className="settings-card-inner">
              <div className="settings-card-left">
                <div className="settings-card-icon">
                  <Database size={19} />
                </div>
                <div className="settings-card-text">
                  <h2 className="settings-card-title">Data Management</h2>
                  <p className="settings-card-sub">
                    Export backup, import data, or reset storage
                  </p>
                </div>
              </div>

              <div className="settings-card-right">
                <span className="badge settings-card-badge">
                  Backup & Restore
                </span>
                <ChevronRight className="settings-card-arrow" size={18} />
              </div>
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
                  className="drawer-close-btn"
                  onClick={() => setShowDataSheet(false)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
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

                <button type="button" className="data-action-card" onClick={() => { setShowDataSheet(false); fileRef.current?.click(); }}>
                  <Upload size={24} />
                  <span className="data-action-label" style={{ fontWeight: 600 }}>Import</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Restore from backup</span>
                </button>
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
                  className="drawer-close-btn"
                  onClick={() => setShowFeedbackSheet(false)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
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
                    Include current app version (<strong style={{ color: 'var(--text)' }}>v{String(settings.installedVersion || jsonSettings.appVersion || CURRENT_APP_VERSION)}</strong>) & device details
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 10, color: '#ef4444', fontSize: 12.5 }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <X size={16} />
                      <span>Unable to create GitHub issue automatically</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.4 }}>
                      {errorMessage}
                    </div>
                    {feedbackTitle.trim() && (
                      <a
                        href={`https://github.com/prathambahekar/okane/issues/new?title=${encodeURIComponent(`[${feedbackType.toUpperCase()}] ${feedbackTitle.trim()}`)}&body=${encodeURIComponent(`${feedbackDescription.trim()}\n\n---\n**Metadata:**\n- Type: ${feedbackType}\n- Version: ${settings.installedVersion || jsonSettings.appVersion || CURRENT_APP_VERSION}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: 4, alignSelf: 'flex-start', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                      >
                        <ExternalLink size={14} /> Open Form on GitHub Web
                      </a>
                    )}
                  </div>
                )}
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Section 3: Features & Performance */}
        <div className="settings-section-group">
          <div className="settings-section-label">Features & Performance</div>

          {/* Advanced Features Card */}
          <div className="card settings-summary-card" onClick={() => setShowAdvancedSheet(true)}>
            <div className="settings-card-inner">
              <div className="settings-card-left">
                <div className="settings-card-icon">
                  <Sparkles size={19} />
                </div>
                <div className="settings-card-text">
                  <h2 className="settings-card-title">Advanced Features</h2>
                  <p className="settings-card-sub">
                    {(settings.enableAIAssistant ?? true) ? 'AI Assistant On' : 'AI Assistant Off'} • {(settings.enableAutopay ?? false) ? 'Autopay On' : 'Autopay Off'} • {(settings.enableSplitTrips ?? false) ? 'Trips & Splits On' : 'Trips & Splits Off'}
                  </p>
                </div>
              </div>

              <div className="settings-card-right">
                <span className="badge settings-card-badge">
                  {
                    [settings.enableAIAssistant ?? true, settings.enableReportBugCard ?? true, settings.enableAutopay ?? false, settings.enableSplitTrips ?? false].filter(Boolean).length === 0
                      ? 'Disabled'
                      : `${[settings.enableAIAssistant ?? true, settings.enableReportBugCard ?? true, settings.enableAutopay ?? false, settings.enableSplitTrips ?? false].filter(Boolean).length} Active`
                  }
                </span>
                <ChevronRight className="settings-card-arrow" size={18} />
              </div>
            </div>
          </div>

          {/* Performance & Animations Card (Developer Mode) */}
          {isDevMode && (settings.enablePerformanceCard ?? true) && (
            <div className="card settings-summary-card" onClick={() => setShowPerformanceSheet(true)}>
              <div className="settings-card-inner">
                <div className="settings-card-left">
                  <div className="settings-card-icon">
                    <Zap size={19} />
                  </div>
                  <div className="settings-card-text">
                    <h2 className="settings-card-title">Performance & Animations</h2>
                    <p className="settings-card-sub">
                      {(settings.enableAnimations ?? true) ? 'Animations On' : 'Animations Off (Fast)'} • {(settings.performanceMode ?? false) ? 'Ultra Performance On' : 'Standard Visuals'}
                    </p>
                  </div>
                </div>

                <div className="settings-card-right">
                  <span className="badge settings-card-badge">
                    {(settings.performanceMode ?? false) ? 'Ultra' : ((settings.enableAnimations ?? true) ? 'Smooth' : 'Instant')}
                  </span>
                  <ChevronRight className="settings-card-arrow" size={18} />
                </div>
              </div>
            </div>
          )}

          {/* Okane User Guide & Tour Card (Developer Mode) */}
          {isDevMode && (settings.enableUserGuide ?? false) && (
            <div className="card settings-summary-card" onClick={() => onStartExpenseTutorial ? onStartExpenseTutorial() : onOpenGuide?.()}>
              <div className="settings-card-inner">
                <div className="settings-card-left">
                  <div className="settings-card-icon">
                    <Compass size={19} />
                  </div>
                  <div className="settings-card-text">
                    <h2 className="settings-card-title">Okane User Guide & Tour</h2>
                    <p className="settings-card-sub">
                      Interactive walkthrough & feature guide
                    </p>
                  </div>
                </div>

                <div className="settings-card-right">
                  <span className="badge settings-card-badge">
                    Guide
                  </span>
                  <ChevronRight className="settings-card-arrow" size={18} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Sheet Drawer Modal for Advanced Features */}
        {showAdvancedSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowAdvancedSheet(false)}>
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
                      Advanced Features
                    </h3>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '1px 0 0 0' }}>
                      Toggle AI assistant, report bug card, autopay & trip bill splitting
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowAdvancedSheet(false)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
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

              {/* List of Advanced Features */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 1. AI Assistant (Max) */}
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 14,
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
                        background: (settings.enableAIAssistant ?? true) ? 'var(--accent-soft)' : 'var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Sparkles size={18} style={{ color: (settings.enableAIAssistant ?? true) ? 'var(--accent)' : 'var(--text-3)' }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>AI Assistant (Max)</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Voice & floating AI trigger
                        </div>
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
                    />
                  </div>
                </div>

                {/* 2. Report Bug & Feature Card */}
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: (settings.enableReportBugCard ?? true) ? 'var(--accent-soft)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <MessageSquarePlus size={18} style={{ color: (settings.enableReportBugCard ?? true) ? 'var(--accent)' : 'var(--text-3)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Report Bug & Feature Card</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                        Show feedback card in Settings
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={settings.enableReportBugCard ?? true}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      updateSettings({ enableReportBugCard: enabled });
                      showToast(enabled ? 'Report Bug Card enabled' : 'Report Bug Card disabled');
                    }}
                    color="primary"
                  />
                </div>

                {/* 2. Autopay & Subscriptions */}
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: (settings.enableAutopay ?? false) ? 'var(--accent-soft)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <RefreshCw size={18} style={{ color: (settings.enableAutopay ?? false) ? 'var(--accent)' : 'var(--text-3)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Autopay & Subscriptions</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                        Automated recurring bill logs & subscription reminders
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {(settings.enableAutopay ?? false) && onNavigate && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setShowAdvancedSheet(false); onNavigate('recurring'); }}
                        style={{ padding: '3px 10px', fontSize: 11.5, height: 28, gap: 4 }}
                      >
                        <RefreshCw size={13} /> Open
                      </button>
                    )}
                    <Switch
                      checked={settings.enableAutopay ?? false}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateSettings({ enableAutopay: enabled });
                        showToast(enabled ? 'Autopay enabled' : 'Autopay disabled');
                      }}
                      color="primary"
                    />
                  </div>
                </div>

                {/* 3. Trips & Group Splits */}
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: (settings.enableSplitTrips ?? false) ? 'var(--accent-soft)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <Plane size={18} style={{ color: (settings.enableSplitTrips ?? false) ? 'var(--accent)' : 'var(--text-3)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Trips & Bill Splits</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                        Group ledgers, trip budgets & expense splitting with friends
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {(settings.enableSplitTrips ?? false) && onNavigate && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setShowAdvancedSheet(false); onNavigate('split-trips'); }}
                        style={{ padding: '3px 10px', fontSize: 11.5, height: 28, gap: 4 }}
                      >
                        <Plane size={13} /> Open
                      </button>
                    )}
                    <Switch
                      checked={settings.enableSplitTrips ?? false}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateSettings({ enableSplitTrips: enabled });
                        showToast(enabled ? 'Trips & Splits enabled' : 'Trips & Splits disabled');
                      }}
                      color="primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Section 4: System & Info */}
        <div className="settings-section-group">
          <div className="settings-section-label">System & Info</div>

          {/* Security & Privacy Card */}
          <div className="card settings-summary-card" onClick={() => setShowSecuritySheet(true)}>
            <div className="settings-card-inner">
              <div className="settings-card-left">
                <div className="settings-card-icon">
                  <ShieldCheck size={19} />
                </div>
                <div className="settings-card-text">
                  <h2 className="settings-card-title">Security & Privacy</h2>
                  <p className="settings-card-sub">
                    {settings.hideAmounts ? 'Amounts Hidden · ' : ''}
                    {isLockEnabled
                      ? (isBiometricEnabled ? 'PIN & Native Biometric Lock active' : 'PIN Lock active (Biometrics off)')
                      : 'PIN & Native Biometric protection'}
                  </p>
                </div>
              </div>

              <div className="settings-card-right">
                <span className="badge settings-card-badge">
                  {isLockEnabled ? (isBiometricEnabled ? 'PIN + Biometric' : 'PIN Only') : 'Disabled'}
                </span>
                <ChevronRight className="settings-card-arrow" size={18} />
              </div>
            </div>
          </div>

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
                <span className="badge settings-card-badge">
                  {isDevMode ? 'Enabled' : 'Disabled'}
                </span>
                <ChevronRight className="settings-card-arrow" size={18} />
              </div>
            </div>
          </div>

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
                  v{String(settings.installedVersion || jsonSettings.appVersion || CURRENT_APP_VERSION)}
                </span>
                <ChevronRight className="settings-card-arrow" size={18} />
              </div>
            </div>
          </div>

          {/* Report Bug / Suggest a Feature Card */}
          {(settings.enableReportBugCard ?? true) && (
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
                  className="drawer-close-btn"
                  onClick={() => setShowDevSheet(false)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
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

                {/* 3. Performance & Animations Card Switch */}
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
                      background: (isDevMode && (settings.enablePerformanceCard ?? true)) ? 'var(--accent-soft)' : 'var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <Zap size={17} style={{ color: (isDevMode && (settings.enablePerformanceCard ?? true)) ? 'var(--accent)' : 'var(--text-3)' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>Performance & Animations Card</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Show performance & animations card in Settings
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {isDevMode && (settings.enablePerformanceCard ?? true) && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setShowDevSheet(false); setShowPerformanceSheet(true); }}
                        style={{ padding: '3px 10px', fontSize: 11.5, height: 28, gap: 4 }}
                      >
                        <Sliders size={13} /> Configure
                      </button>
                    )}
                    <Switch
                      disabled={!isDevMode}
                      checked={isDevMode && (settings.enablePerformanceCard ?? true)}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateSettings({ enablePerformanceCard: enabled });
                        showToast(enabled ? 'Performance Card enabled' : 'Performance Card disabled');
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
                      v{String(settings.installedVersion || jsonSettings.appVersion || CURRENT_APP_VERSION)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowVersionSheet(false)}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
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
                  padding: '14px 16px',
                  borderRadius: '16px',
                  background: 'var(--surface2)',
                  border: '1.5px solid rgba(59, 130, 246, 0.3)',
                  boxShadow: '0 4px 16px rgba(59, 130, 246, 0.1)',
                  marginBottom: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#3b82f6',
                        flexShrink: 0
                      }}>
                        <ArrowUpCircle size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                          v{availableUpdate.version} Available
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                          Build #{availableUpdate.buildNumber} • {availableUpdate.releaseDate}
                        </div>
                      </div>
                    </div>
                    {!isUpdating && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => installUpdate()}
                        style={{ gap: 6, padding: '7px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, flexShrink: 0 }}
                      >
                        <Download size={13} /> Download
                      </button>
                    )}
                  </div>
                  {isUpdating && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-2)' }}>
                        <span>{updateStatusMessage}</span>
                        <span>{updateProgress}%</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--surface3)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${updateProgress}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width 0.2s ease' }} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '14px 16px',
                  borderRadius: '16px',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 auto' }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'rgba(34, 197, 94, 0.12)',
                      border: '1px solid rgba(34, 197, 94, 0.25)',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#22c55e',
                      flexShrink: 0
                    }}>
                      <CheckCircle2 size={18} />
                    </div>
                    <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Up to date
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Checked {settings.lastUpdateCheck || String(jsonSettings.lastUpdated || 'Today')}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => checkForUpdates(true)}
                    disabled={isCheckingUpdate}
                    style={{
                      gap: 5,
                      fontSize: 11.5,
                      padding: '6px 12px',
                      borderRadius: 10,
                      fontWeight: 600,
                      flexShrink: 0,
                      background: 'var(--surface3)',
                      border: '1px solid var(--border)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <RefreshCw size={13} className={isCheckingUpdate ? 'spin' : ''} />
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
                  {displayReleaseHistory.length > 0 && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: 'var(--surface3)', color: 'var(--text-2)', fontWeight: 600 }}>
                      {displayReleaseHistory.length}
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
                className="drawer-close-btn"
                onClick={() => setExportModalOpen(false)}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
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
              maxWidth: '480px',
              maxHeight: '88vh',
              padding: '18px 20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              borderRadius: '24px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
            }}
          >
            <div className="modal-handle-bar">
              <div className="modal-handle" />
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text)' }}>
                      Release History
                    </h3>
                    {displayReleaseHistory.length > 0 && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 99,
                        background: 'var(--surface2)',
                        color: 'var(--text-2)',
                        border: '1px solid var(--border)'
                      }}>
                        {displayReleaseHistory.length} releases
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: 1 }}>
                    prathambahekar/okane
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                aria-label="Close release history"
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  width: '32px',
                  height: '32px',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* List */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              overflowY: 'auto',
              maxHeight: '68vh',
              paddingRight: '4px'
            }}>
              {displayReleaseHistory.length === 0 ? (
                <div style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--text-3)',
                  fontSize: '13px',
                  background: 'var(--surface2)',
                  borderRadius: '16px',
                  border: '1px dashed var(--border)'
                }}>
                  No release history loaded yet. Tap "Check Updates" in settings to fetch releases.
                </div>
              ) : (
                displayReleaseHistory.map((item, idx) => {
                  const currentVer = settings.installedVersion || jsonSettings.appVersion || CURRENT_APP_VERSION;
                  const normalizedItemVer = item.version.replace(/^v/, '').trim();
                  const normalizedCurrentVer = String(currentVer).replace(/^v/, '').trim();
                  const isCurrent = normalizedItemVer === normalizedCurrentVer;

                  return (
                    <div
                      key={item.version + '_' + idx}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '16px',
                        background: 'var(--surface2)',
                        border: isCurrent ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        boxShadow: isCurrent ? '0 4px 16px rgba(99, 102, 241, 0.12)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                            {item.name || `v${item.version}`}
                          </span>
                          {isCurrent && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 99,
                              background: 'rgba(34, 197, 94, 0.12)',
                              color: '#22c55e',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
                              Installed
                            </span>
                          )}
                          {item.isPrerelease && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 99,
                              background: 'rgba(245, 158, 11, 0.12)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245, 158, 11, 0.25)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <FlaskConical size={11} />
                              Pre-release
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                          {item.releaseDate}
                        </span>
                      </div>

                      <FormattedReleaseNotes notes={item.releaseNotes} />

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4, marginTop: 2 }}>
                        <a
                          href={item.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 11.5,
                            color: 'var(--accent)',
                            fontWeight: 600,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <span>View on GitHub</span>
                          <ExternalLink size={12} />
                        </a>
                        {item.downloadUrl && (
                          <a
                            href={item.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 11.5,
                              color: 'var(--text-2)',
                              fontWeight: 500,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              marginLeft: 'auto'
                            }}
                          >
                            <Download size={12} />
                            <span>Download</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bottom Sheet Drawer Modal for Security & Privacy */}
      {showSecuritySheet && createPortal(
        <div className="sheet-backdrop" onClick={() => { setShowSecuritySheet(false); setIsPinSetupActive(false); }}>
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
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                    Security & Privacy
                  </h3>
                  <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '1px 0 0 0' }}>
                    Native Android Biometric & PIN Protection
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => { setShowSecuritySheet(false); setIsPinSetupActive(false); }}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
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

            {/* Android/Mobile Indicator Tag */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 10,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              marginBottom: 14,
              fontSize: 12,
              color: 'var(--text-2)'
            }}>
              <Smartphone size={16} style={{ color: 'var(--accent)' }} />
              <span>Targeted for <strong>Android / Mobile Native</strong> (Supports Fingerprint, Face ID & PIN)</span>
            </div>

            {/* Main Controls List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* 0. Hide Amounts Switch */}
              <div style={{
                padding: '14px 16px',
                borderRadius: 14,
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
                    background: settings.hideAmounts ? 'var(--accent-soft)' : 'var(--surface3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {settings.hideAmounts ? (
                      <EyeOff size={18} style={{ color: 'var(--accent)' }} />
                    ) : (
                      <Eye size={18} style={{ color: 'var(--text-3)' }} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                      Hide Amounts
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      Mask financial amounts in the top dashboard overview card
                    </div>
                  </div>
                </div>

                <Switch
                  checked={Boolean(settings.hideAmounts)}
                  onChange={(e) => {
                    updateSettings({ hideAmounts: e.target.checked });
                  }}
                  color="primary"
                />
              </div>

              {/* 1. Master PIN Lock Switch */}
              <div style={{
                padding: '14px 16px',
                borderRadius: 14,
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
                    background: isLockEnabled ? 'var(--accent-soft)' : 'var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <KeyRound size={18} style={{ color: isLockEnabled ? 'var(--accent)' : 'var(--text-3)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                      PIN Passcode Lock
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      Require 4-digit PIN when opening Okane
                    </div>
                  </div>
                </div>

                <Switch
                  checked={isLockEnabled}
                  onChange={(e) => handleToggleSecurityLock(e.target.checked)}
                  color="primary"
                />
              </div>

              {/* 2. Biometric Unlock Switch (Only use PIN if toggled off) */}
              <div style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                opacity: isLockEnabled ? 1 : 0.65
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: isBiometricEnabled ? 'var(--accent-soft)' : 'var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <Fingerprint size={18} style={{ color: isBiometricEnabled ? 'var(--accent)' : 'var(--text-3)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                      Biometric Unlock
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      Prompt fingerprint or face scan before falling back to PIN
                    </div>
                  </div>
                </div>

                <Switch
                  checked={isBiometricEnabled}
                  onChange={(e) => handleToggleBiometricOnly(e.target.checked)}
                  color="primary"
                />
              </div>

              {/* 3. Auto-enter on Face Recognition Switch */}
              <div style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                opacity: isLockEnabled ? 1 : 0.65
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: (settings.autoUnlockOnFace ?? false) && isLockEnabled ? 'var(--accent-soft)' : 'var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <ScanFace size={18} style={{ color: (settings.autoUnlockOnFace ?? false) && isLockEnabled ? 'var(--accent)' : 'var(--text-3)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                      Auto-enter on Face Unlock
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      Skip confirmation button when face is recognized
                    </div>
                  </div>
                </div>

                <Switch
                  checked={Boolean(settings.autoUnlockOnFace ?? false)}
                  disabled={!isLockEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    updateSettings({ autoUnlockOnFace: enabled });
                    showToast(enabled ? 'Face auto-enter enabled' : 'Face auto-enter disabled');
                  }}
                  color="primary"
                />
              </div>

              {/* 3. Require Lock on App Resume Switch */}
              <div style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                opacity: isLockEnabled ? 1 : 0.65
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: (settings.requireBiometricOnResume ?? true) && isLockEnabled ? 'var(--accent-soft)' : 'var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <Lock size={18} style={{ color: (settings.requireBiometricOnResume ?? true) && isLockEnabled ? 'var(--accent)' : 'var(--text-3)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                      Lock on Background Resume
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      Re-lock when switching back to Okane from another app
                    </div>
                  </div>
                </div>

                <Switch
                  checked={settings.requireBiometricOnResume ?? true}
                  disabled={!isLockEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    updateSettings({ requireBiometricOnResume: enabled });
                    showToast(enabled ? 'Resume lock enabled' : 'Resume lock disabled');
                  }}
                  color="primary"
                />
              </div>

              {/* Set / Change Backup Security PIN */}
              <div style={{
                padding: '14px 16px',
                borderRadius: 14,
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
                    background: settings.securityPin ? 'var(--accent-soft)' : 'var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <KeyRound size={18} style={{ color: settings.securityPin ? 'var(--accent)' : 'var(--text-3)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                      Passcode Security PIN
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                      {settings.securityPin ? '4-Digit PIN Configured' : 'No custom PIN set'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsPinSetupActive(true)}
                  style={{ fontSize: 12, padding: '6px 14px', height: 34, fontWeight: 600, borderRadius: 10 }}
                >
                  {settings.securityPin ? 'Change PIN' : 'Set PIN'}
                </button>
              </div>

              {/* Test Security Lock Button */}
              {isLockEnabled && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowSecuritySheet(false);
                    onTestLock?.();
                  }}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    padding: '12px',
                    borderRadius: 12,
                    fontWeight: 600,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    border: '1px solid var(--accent-border-soft)',
                    color: 'var(--accent)',
                    background: 'var(--accent-soft)'
                  }}
                >
                  <ShieldCheck size={18} />
                  <span>Test Security Lock Screen</span>
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dedicated Clean PIN Setup & Change Drawer Menu */}
      <PinSetupDrawer
        key={isPinSetupActive ? 'active' : 'inactive'}
        isOpen={isPinSetupActive}
        onClose={() => setIsPinSetupActive(false)}
        hasExistingPin={Boolean(settings.securityPin)}
        currentPin={settings.securityPin || ''}
        onSavePin={(newPin) => {
          updateSettings({ securityPin: newPin, enableSecurityLock: true });
          showToast('4-Digit Passcode saved!');
        }}
      />

      {/* Permanently mounted hidden file input (outside of any conditional portal) */}
      <input
        ref={fileRef}
        type="file"
        accept=".db,.sql,.json,text/plain,application/json,application/sql,application/octet-stream,*/*"
        style={{
          position: 'fixed',
          top: -10000,
          left: -10000,
          opacity: 0,
          width: 1,
          height: 1,
          pointerEvents: 'none'
        }}
        onChange={handleImport}
      />

    </div>
  );
}
