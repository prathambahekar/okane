import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useColorMode } from '../theme';
import Switch from '@mui/material/Switch';
import { Plus, X, RotateCcw, Tag, Upload, FlaskConical, Trash2, ChevronRight, ChevronDown, Edit2, Palette, ExternalLink, ArrowUpRight, Sparkles, FileCode, Check, Database, Terminal, Download, RefreshCw, ArrowUpCircle, CheckCircle2, History, GitCommit, Plane, Send, Info, MessageSquarePlus, Bug, Lightbulb, GitPullRequest, Sliders, Moon, Sun, ShieldCheck, Fingerprint, Lock, KeyRound, Smartphone, EyeOff, Eye, ArrowLeft, Search, ScanFace, Keyboard as KeyboardIcon, Coins, Wallet, Layout } from 'lucide-react';
import { useStore } from '../store';
import { CURRENCIES, DEFAULT_CATEGORIES, FRIEND_PALETTE, generateSQLDumpString, downloadFile, importSQLDumpString, seedSampleData, resetAndSeedSampleData } from '../db';
import type { Category, AppDB, ViewName } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from 'capacitor-native-biometric';
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

import CategoryIcon, { AVAILABLE_ICONS } from '../components/CategoryIcon';
import PinSetupDrawer from '../components/PinSetupDrawer';
import { CURRENT_APP_VERSION, getEffectiveAppVersion } from '../utils/updateManager';
import { showSoftKeyboard } from '../utils/keyboard';
import { useBackButtonModal } from '../utils/backHandler';

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
    <div
      className="category-color-picker"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
        alignItems: 'center',
        padding: '6px 4px',
        width: '100%',
      }}
    >
      {FRIEND_PALETTE.map(c => (
        <button
          key={c}
          type="button"
          className={`color-swatch-btn ${color === c ? 'selected' : ''}`}
          style={{
            width: 28,
            height: 28,
            minWidth: 28,
            minHeight: 28,
            background: c,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            borderRadius: '50%',
            padding: 0,
            boxSizing: 'border-box',
          }}
          onClick={() => onChangeColor(c)}
          aria-label={`Select color ${c}`}
        >
          {color === c && (
            <Check size={13} strokeWidth={2.5} style={{ color: '#ffffff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
          )}
        </button>
      ))}
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <button
          type="button"
          className={`color-swatch-btn ${isCustom ? 'selected' : ''}`}
          onClick={handleCustomClick}
          style={{
            width: 28,
            height: 28,
            minWidth: 28,
            minHeight: 28,
            borderRadius: '50%',
            background: isCustom ? color : 'var(--surface2, #2a2a32)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: isCustom ? 'none' : '1.5px solid var(--border2, rgba(255,255,255,0.35))',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            flexShrink: 0,
            padding: 0,
            boxSizing: 'border-box',
          }}
          title="Choose Custom Color"
        >
          {isCustom ? (
            <Check size={13} strokeWidth={2.5} style={{ color: '#ffffff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
          ) : (
            <Palette size={14} style={{ color: 'var(--text)' }} />
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
    | { type: 'numbered'; num: string; text: string }
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
        const numMatch = precedingText.match(/^(\d+[.)])\s*(.+)/);
        if (numMatch) {
          items.push({ type: 'numbered', num: numMatch[1], text: numMatch[2] });
        } else if (precedingText.startsWith('- ') || precedingText.startsWith('* ')) {
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
      } else {
        const numMatch = rest.match(/^(\d+[.)])\s*(.+)/);
        if (numMatch) {
          items.push({ type: 'numbered', num: numMatch[1], text: numMatch[2] });
        } else if (rest.startsWith('- ') || rest.startsWith('* ')) {
          items.push({ type: 'bullet', text: rest.substring(2).trim() });
        } else {
          items.push({ type: 'text', text: rest });
        }
      }
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', marginBottom: '8px' }}>
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

        if (item.type === 'numbered') {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
              <span style={{
                fontSize: '12px',
                fontWeight: 650,
                color: 'var(--text-3)',
                minWidth: '18px',
                flexShrink: 0,
                fontVariantNumeric: 'tabular-nums'
              }}>
                {item.num}
              </span>
              <span style={{ color: 'var(--text-2)' }}>{item.text}</span>
            </div>
          );
        }

        if (item.type === 'bullet') {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5 }}>
              <span style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'var(--accent)',
                marginTop: 7,
                flexShrink: 0
              }} />
              <span>{item.text}</span>
            </div>
          );
        }

        return (
          <p key={idx} style={{ fontSize: '13px', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
            {item.text}
          </p>
        );
      })}
    </div>
  );
}

export default function Settings({
  onNavigate,
  initialArg,
  onClearViewArg,
  onTestLock,
  searchQuery,
  onSearchChange,
  mobileSearchOpen,
}: {
  onNavigate?: (v: ViewName, arg?: string) => void;
  initialArg?: string;
  onClearViewArg?: () => void;
  onTestLock?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  mobileSearchOpen?: boolean;
  onToggleMobileSearch?: () => void;
}) {
  const {
    db, updateSettings, updateCategory, resetDB, restoreDB, showToast,
    availableUpdate, releaseHistory, isCheckingUpdate, isUpdating, updateProgress, updateStatusMessage,
    checkForUpdates, installUpdate
  } = useStore();
  const { settings } = db;
  const fileRef = useRef<HTMLInputElement>(null);
  const [showReset, setShowReset] = useState(false);
  const [showDummyModal, setShowDummyModal] = useState(false);

  const handleAppendDummyData = () => {
    try {
      const seeded = seedSampleData(db);
      restoreDB(seeded);
      setShowDummyModal(false);
      showToast('Dummy data added successfully! Added sample expenses, contacts, and due notifications.');
    } catch (err) {
      console.error('Failed to add dummy data:', err);
      showToast('Failed to add dummy data.');
    }
  };

  const handleResetAndDummyData = () => {
    try {
      resetDB();
      const fresh = resetAndSeedSampleData();
      restoreDB(fresh);
      setShowDummyModal(false);
      showToast('Database reset and seeded with fresh sample data!');
    } catch (err) {
      console.error('Failed to reset and add dummy data:', err);
      showToast('Failed to populate dummy data.');
    }
  };
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(FRIEND_PALETTE[0]);
  const [newCatIcon, setNewCatIcon] = useState('other');

  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#F97362');
  const [editIcon, setEditIcon] = useState('other');

  const { mode, toggleMode } = useColorMode();
  const isDark = mode === 'dark';
  const [appearanceSubView, setAppearanceSubView] = useState<'main' | 'more'>('main');
  const [categorySubView, setCategorySubView] = useState<'list' | 'add' | 'edit' | 'select-icon'>('list');
  const [iconPickerTarget, setIconPickerTarget] = useState<'add' | 'edit'>('add');
  const [iconSearchQuery, setIconSearchQuery] = useState('');
  const [securitySubView, setSecuritySubView] = useState<'main' | 'passcode'>('main');
  const isDevMode = settings.devMode ?? false;
  const displayReleaseHistory = useMemo(() => {
    if (isDevMode) return releaseHistory;
    return releaseHistory.filter(item => !item.isPrerelease);
  }, [releaseHistory, isDevMode]);
  const [showDevSheet, setShowDevSheet] = useState(false);
  const [showAppearanceSheet, setShowAppearanceSheet] = useState(false);
  const [showAdvancedSheet, setShowAdvancedSheet] = useState(false);
  const [showCategoriesSheet, setShowCategoriesSheet] = useState(false);
  const [showPreferencesSheet, setShowPreferencesSheet] = useState(false);
  const [showCurrencySheet, setShowCurrencySheet] = useState(false);
  const [currencySearchQuery, setCurrencySearchQuery] = useState('');
  const currencySearchInputRef = useRef<HTMLInputElement>(null);
  const newCatInputRef = useRef<HTMLInputElement>(null);
  const editCatInputRef = useRef<HTMLInputElement>(null);

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
    if (categorySubView === 'edit' && showCategoriesSheet) {
      const timer = setTimeout(() => {
        if (editCatInputRef.current && (settings.autoOpenKeyboard ?? false)) {
          showSoftKeyboard(editCatInputRef.current, { placeCursorAtEnd: true, scroll: true });
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

  // Back button gesture and popstate handling for all sub-settings drawers
  useBackButtonModal(showAppearanceSheet, () => {
    if (appearanceSubView === 'more') {
      setAppearanceSubView('main');
    } else {
      setShowAppearanceSheet(false);
    }
  }, { name: 'settings-appearance' });

  useBackButtonModal(showPreferencesSheet, () => setShowPreferencesSheet(false), { name: 'settings-preferences' });
  useBackButtonModal(showCategoriesSheet, () => {
    if (categorySubView === 'select-icon') {
      setCategorySubView(iconPickerTarget);
    } else if (categorySubView !== 'list') {
      setCategorySubView('list');
    } else {
      setShowCategoriesSheet(false);
    }
  }, { name: 'settings-categories' });
  useBackButtonModal(showCurrencySheet, () => setShowCurrencySheet(false), { name: 'settings-currency' });
  useBackButtonModal(showDataSheet, () => setShowDataSheet(false), { name: 'settings-data' });
  useBackButtonModal(showVersionSheet, () => setShowVersionSheet(false), { name: 'settings-version' });
  useBackButtonModal(showFeedbackSheet, () => setShowFeedbackSheet(false), { name: 'settings-feedback' });
  useBackButtonModal(showSecuritySheet, () => {
    if (securitySubView === 'passcode') {
      setSecuritySubView('main');
    } else {
      setShowSecuritySheet(false);
      setIsPinSetupActive(false);
    }
  }, { name: 'settings-security' });
  useBackButtonModal(showAdvancedSheet, () => setShowAdvancedSheet(false), { name: 'settings-advanced' });
  useBackButtonModal(showDevSheet, () => setShowDevSheet(false), { name: 'settings-dev' });

  const isLockEnabled = Boolean(settings.enableSecurityLock && settings.securityPin);
  const isBiometricEnabled = Boolean(settings.enableBiometricLock && settings.securityPin && isLockEnabled);

  const handleToggleSecurityLock = (enabled: boolean) => {
    if (enabled) {
      if (!settings.securityPin) {
        setIsPinSetupActive(true);
        return;
      }
      updateSettings({ enableSecurityLock: true });
      showToast('PIN Security Lock enabled!');
    } else {
      updateSettings({ enableSecurityLock: false, enableBiometricLock: false, autoUnlockOnFace: false });
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
      const openDrawerById = (id: string) => {
        const sheetMap: Record<string, () => void> = {
          'appearance': () => setShowAppearanceSheet(true),
          'preferences': () => setShowPreferencesSheet(true),
          'categories': () => setShowCategoriesSheet(true),
          'category': () => setShowCategoriesSheet(true),
          'data-backup': () => setShowDataSheet(true),
          'data': () => setShowDataSheet(true),
          'backup': () => setShowDataSheet(true),
          'advanced-features': () => setShowAdvancedSheet(true),
          'advanced': () => setShowAdvancedSheet(true),
          'security': () => setShowSecuritySheet(true),
          'security-privacy': () => setShowSecuritySheet(true),
          'app-info': () => setShowVersionSheet(true),
          'version': () => setShowVersionSheet(true),
          'feedback': () => setShowFeedbackSheet(true),
          'bug-report': () => setShowFeedbackSheet(true),
          'dev-mode': () => setShowDevSheet(true),
          'dev': () => setShowDevSheet(true),
          'dummy-data': () => setShowDummyModal(true),
          'dummy': () => setShowDummyModal(true),
          'currency': () => setShowCurrencySheet(true),
        };

        if (sheetMap[id]) {
          sheetMap[id]();
          return true;
        }

        const el = document.getElementById(`setting-${id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        }
        return false;
      };

      openDrawerById(initialArg);
      onClearViewArg?.();
    }, 50);
    return () => clearTimeout(timer);
  }, [initialArg, onNavigate, onClearViewArg]);

  useEffect(() => {
    const handleOpenDrawerEvent = (e: Event) => {
      const customEv = e as CustomEvent<{ id: string }>;
      const targetId = customEv?.detail?.id;
      if (!targetId) return;

      const sheetMap: Record<string, () => void> = {
        'appearance': () => setShowAppearanceSheet(true),
        'preferences': () => setShowPreferencesSheet(true),
        'categories': () => setShowCategoriesSheet(true),
        'category': () => setShowCategoriesSheet(true),
        'data-backup': () => setShowDataSheet(true),
        'data': () => setShowDataSheet(true),
        'backup': () => setShowDataSheet(true),
        'advanced-features': () => setShowAdvancedSheet(true),
        'advanced': () => setShowAdvancedSheet(true),
        'security': () => setShowSecuritySheet(true),
        'security-privacy': () => setShowSecuritySheet(true),
        'app-info': () => setShowVersionSheet(true),
        'version': () => setShowVersionSheet(true),
        'feedback': () => setShowFeedbackSheet(true),
        'bug-report': () => setShowFeedbackSheet(true),
        'dev-mode': () => setShowDevSheet(true),
        'dev': () => setShowDevSheet(true),
        'dummy-data': () => setShowDummyModal(true),
        'dummy': () => setShowDummyModal(true),
        'currency': () => setShowCurrencySheet(true),
      };

      if (sheetMap[targetId]) {
        sheetMap[targetId]();
      } else {
        const el = document.getElementById(`setting-${targetId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    window.addEventListener('open-setting-drawer', handleOpenDrawerEvent);
    return () => window.removeEventListener('open-setting-drawer', handleOpenDrawerEvent);
  }, [onNavigate]);

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

  const currentAppVersion = useMemo(() => {
    return getEffectiveAppVersion(
      settings.installedVersion,
      typeof jsonSettings.appVersion === 'string' ? jsonSettings.appVersion : undefined
    );
  }, [settings.installedVersion, jsonSettings.appVersion]);

  // Feedback & Bug Report state
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature'>('bug');
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackDescription, setFeedbackDescription] = useState('');
  const [includeVersionInfo, setIncludeVersionInfo] = useState(true);
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
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

    const appVersion = currentAppVersion;
    const platformName = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'Web Browser';
    const token = localStorage.getItem('okane_github_token')?.trim() || '';

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
    setCategorySubView('edit');
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
    setCategorySubView('list');
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
      content: generateSQLDumpString(db),
      contentType: 'text/plain;charset=utf-8',
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

  const handleImportClick = () => {
    setShowDataSheet(false);
    if (fileRef.current) {
      fileRef.current.value = '';
      fileRef.current.click();
    }
  };

  const handleSaveToStorage = async () => {
    const { content, contentType, fileName } = getExportContent();
    try {
      let savedToDevice = false;
      let savedFolderLocation = 'Downloads/Okane';

      // Native Mobile (Capacitor)
      if (Capacitor.isNativePlatform()) {
        try {
          await Filesystem.requestPermissions();
        } catch {
          // ignore permission errors if already granted or unsupported
        }

        // Method A: Try ExternalStorage Download/Okane (Standard Android Downloads folder)
        if (Capacitor.getPlatform() === 'android') {
          try {
            // First ensure Okane folder exists
            try {
              await Filesystem.mkdir({
                path: 'Download/Okane',
                directory: Directory.ExternalStorage,
                recursive: true,
              });
            } catch { /* directory may already exist */ }

            await Filesystem.writeFile({
              path: `Download/Okane/${fileName}`,
              data: content,
              directory: Directory.ExternalStorage,
              encoding: Encoding.UTF8,
              recursive: true,
            });
            savedToDevice = true;
            savedFolderLocation = 'Downloads/Okane';
          } catch (e) {
            console.warn('Direct Download/Okane write failed, trying Documents/Okane:', e);
          }
        }

        // Method B: Try Documents/Okane directory
        if (!savedToDevice) {
          try {
            try {
              await Filesystem.mkdir({
                path: 'Okane',
                directory: Directory.Documents,
                recursive: true,
              });
            } catch { /* directory may already exist */ }

            await Filesystem.writeFile({
              path: `Okane/${fileName}`,
              data: content,
              directory: Directory.Documents,
              encoding: Encoding.UTF8,
              recursive: true,
            });
            savedToDevice = true;
            savedFolderLocation = 'Documents/Okane';
          } catch (e) {
            console.warn('Documents/Okane write failed, trying direct Documents:', e);
          }
        }

        // Method C: Root of Documents or Data directory
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
            savedFolderLocation = 'Documents';
          } catch (e) {
            console.warn('Documents root write failed:', e);
          }
        }
      }

      // Desktop File System Access API (lets user pick/save directly into their desired folder, defaulting to an Okane backup filename)
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window && !Capacitor.isNativePlatform()) {
        try {
          const fileHandle = await (window as unknown as {
            showSaveFilePicker: (options?: {
              suggestedName?: string;
              types?: Array<{
                description: string;
                accept: Record<string, string[]>;
              }>;
            }) => Promise<{
              createWritable: () => Promise<{
                write: (data: string | Blob) => Promise<void>;
                close: () => Promise<void>;
              }>;
              name?: string;
            }>;
          }).showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: 'Okane Database Backup (.db)',
                accept: { 'text/plain': ['.db', '.sql'] },
              },
            ],
          });

          if (fileHandle) {
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            setExportModalOpen(false);
            showToast(`Backup saved to ${fileHandle.name || fileName}!`);
            return;
          }
        } catch (pickerErr) {
          // If the user cancelled the dialog, just exit cleanly
          if ((pickerErr as Error).name === 'AbortError') {
            setExportModalOpen(false);
            return;
          }
          console.warn('showSaveFilePicker failed or was rejected, falling back to browser download:', pickerErr);
        }
      }

      // Universal browser blob download (triggers browser download manager on Web/PWA/Android Chrome)
      const downloaded = downloadFile(content, fileName, contentType);
      setExportModalOpen(false);

      if (savedToDevice) {
        showToast(`Backup saved to ${savedFolderLocation}/${fileName}!`);
      } else if (downloaded) {
        showToast(`Saved ${fileName} to Downloads/Okane!`);
      } else {
        showToast('Backup exported successfully.');
      }
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
      downloadFile(content, fileName, contentType);
      setExportModalOpen(false);
      showToast(`Backup saved to Downloads (${fileName})!`);
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
      text.includes('INSERT OR REPLACE') ||
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

  const effectiveSearch = (searchQuery ?? '').trim().toLowerCase();
  const matches = (keywords: string[]) => !effectiveSearch || keywords.some(k => k.toLowerCase().includes(effectiveSearch));

  const showAppearance = matches(['appearance', 'customization', 'theme', 'dark mode', 'light mode', 'accent', 'monochrome', 'navigation']);
  const showPreferences = matches(['preferences', 'currency', 'inr', 'usd', 'default category', 'wallet', 'haptic', 'vibrate', 'keyboard', 'auto open keyboard', 'input', 'soft keyboard']);
  const showCategories = matches(['categories', 'tags', 'labels', 'colors']);
  const showGeneralSection = showAppearance || showPreferences || showCategories;

  const showData = matches(['data', 'data management', 'storage', 'backup', 'restore', 'export', 'import', 'reset', 'clear', 'json', 'csv', 'dummy', 'sample', 'seed', 'demo']);
  const showDataSection = showData;

  const showSecurity = matches(['security', 'privacy', 'pin', 'biometric', 'fingerprint', 'lock', 'face id']);
  const showAdvanced = matches(['advanced', 'features', 'ai assistant', 'gemini', 'autopay', 'recurring', 'trips', 'splits', 'dummy', 'sample']);
  const showAppInfo = matches(['app info', 'version', 'updates', 'release notes', 'guide', 'tutorial', 'license', 'about', 'report bug', 'feature request', 'feedback', 'support', 'contact']);
  const showDev = matches(['developer', 'dev', 'experimental', 'sql', 'database']);
  const showSystemSection = showSecurity || showAdvanced || showAppInfo || showDev;

  return (
    <div className="view-container settings-page-container">
      {/* Desktop Header for Settings (different for desktop & mobile) */}
      <div className="settings-desktop-header">
        <div className="settings-desktop-header-left">
          <h1 className="settings-desktop-title">Settings</h1>
        </div>

        <div className="settings-desktop-search-wrap">
          <Search size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input
            type="text"
            className="settings-desktop-search-input"
            placeholder="Search settings, preferences, or notes..."
            value={searchQuery ?? ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange?.('')}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="settings-desktop-header-spacer desktop-only" />
      </div>

      {/* Mobile search bar if toggled */}
      {mobileSearchOpen && (
        <div className="settings-search-container mobile-only" style={{ marginBottom: 16 }}>
          <div className="settings-search-input-wrap">
            <Search size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <input
              type="text"
              className="settings-search-input"
              placeholder="Search settings, preferences, or notes..."
              value={searchQuery ?? ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange?.('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* When no section matches search */}
      {!showGeneralSection && !showDataSection && !showSystemSection ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-3)' }}>
          <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text)' }}>No matching settings</p>
          <p style={{ fontSize: 'var(--fs-sm)', margin: '0 0 16px 0' }}>No settings matched "{searchQuery}"</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onSearchChange?.('')}
            style={{ borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-sm)', padding: '7px 20px' }}
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="settings-cards-list">
          {/* Section 1: General & Customization */}
          {showGeneralSection && (
            <div className="settings-section-group">
              <div className="settings-section-label">General & Customization</div>

              <div className="settings-section-grid">
                {/* Appearance Summary Card */}
                {showAppearance && (
                  <div className="card settings-summary-card" onClick={() => setShowAppearanceSheet(true)}>
                    <div className="settings-card-inner">
                      <div className="settings-card-left">
                        <div className="settings-card-icon">
                          <Palette size={19} />
                        </div>
                        <div className="settings-card-text">
                          <h2 className="settings-card-title">Appearance & Customization</h2>
                          <p className="settings-card-sub">
                            Theme & layout
                          </p>
                        </div>
                      </div>

                      <div className="settings-card-right">
                        <ChevronRight className="settings-card-arrow" size={18} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Preferences Summary Card */}
                {showPreferences && (
                  <div className="card settings-summary-card" onClick={() => setShowPreferencesSheet(true)}>
                    <div className="settings-card-inner">
                      <div className="settings-card-left">
                        <div className="settings-card-icon">
                          <Sliders size={19} />
                        </div>
                        <div className="settings-card-text">
                          <h2 className="settings-card-title">Preferences</h2>
                          <p className="settings-card-sub">
                            Currency, category & wallet
                          </p>
                        </div>
                      </div>

                      <div className="settings-card-right">
                        <ChevronRight className="settings-card-arrow" size={18} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Categories Summary Card */}
                {showCategories && (
                  <div className="card settings-summary-card" onClick={() => setShowCategoriesSheet(true)}>
                    <div className="settings-card-inner">
                      <div className="settings-card-left">
                        <div className="settings-card-icon">
                          <Tag size={19} />
                        </div>
                        <div className="settings-card-text">
                          <h2 className="settings-card-title">Categories</h2>
                          <p className="settings-card-sub">
                            {settings.categories.length} category tags
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
            </div>
          )}

        {/* Bottom Sheet Drawer Modal for Appearance & Theme */}
        {showAppearanceSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => {
            setShowAppearanceSheet(false);
            setAppearanceSubView('main');
          }}>
            <div className="sheet-modal" onClick={(e) => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {appearanceSubView === 'main' ? (
                <>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="drawer-header-icon">
                        <Palette size={20} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                          Appearance & Theme
                        </h3>
                        <p className="drawer-header-sub">
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
                      title="Close"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  {/* Theme Mode Toggle Row */}
                  <div className="drawer-setting-card" style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div className="drawer-card-icon">
                        {isDark ? <Moon size={18} /> : <Sun size={18} />}
                      </div>
                      <div className="drawer-card-info">
                        <div className="drawer-card-title">Dark Theme Mode</div>
                        <div className="drawer-card-sub">Switch between dark and light background</div>
                      </div>
                    </div>
                    <Switch
                      className="custom-toggle-switch"
                      checked={isDark}
                      onChange={() => {
                        const nextMode = isDark ? 'light' : 'dark';
                        toggleMode();
                        updateSettings({ colorMode: nextMode });
                      }}
                      color="primary"
                    />
                  </div>

                  {/* More Appearance Drawer Trigger */}
                  <div style={{ marginTop: 0 }}>
                    <button
                      type="button"
                      onClick={() => setAppearanceSubView('more')}
                      className="drawer-setting-card"
                      style={{
                        width: '100%',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div className="drawer-card-icon">
                          <Palette size={18} />
                        </div>
                        <div className="drawer-card-info">
                          <div className="drawer-card-title">More Appearance</div>
                          <div className="drawer-card-sub">Hide scrollbars & display options</div>
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
                        className="drawer-back-btn"
                        onClick={() => setAppearanceSubView('main')}
                        title="Back to appearance"
                      >
                        <ArrowLeft size={17} />
                      </button>
                      <div>
                        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                          More Appearance
                        </h3>
                        <p className="drawer-header-sub">
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
                      title="Close"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  {/* Hide Scrollbars Toggle Row */}
                  <div className="drawer-setting-card" style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div className="drawer-card-icon">
                        {(settings.hideScrollbar ?? true) ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </div>
                      <div className="drawer-card-info">
                        <div className="drawer-card-title">Hide Scrollbars</div>
                        <div className="drawer-card-sub">Hide scrollbar tracks</div>
                      </div>
                    </div>
                    <Switch
                      className="custom-toggle-switch"
                      checked={settings.hideScrollbar ?? true}
                      onChange={(e) => {
                        const hide = e.target.checked;
                        updateSettings({ hideScrollbar: hide });
                        showToast(hide ? 'Scrollbars hidden' : 'Scrollbars visible');
                      }}
                      color="primary"
                    />
                  </div>

                  {/* Hide Nav Bar Text Toggle Row (Mobile Only) */}
                  <div className="drawer-setting-card mobile-only-setting" style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div className="drawer-card-icon">
                        <Smartphone size={18} />
                      </div>
                      <div className="drawer-card-info">
                        <div className="drawer-card-title">Hide Nav Bar Text</div>
                        <div className="drawer-card-sub">Hide bottom nav labels</div>
                      </div>
                    </div>
                    <Switch
                      className="custom-toggle-switch"
                      checked={settings.hideNavLabels ?? true}
                      onChange={(e) => {
                        const hide = e.target.checked;
                        updateSettings({ hideNavLabels: hide });
                        localStorage.setItem('hide_nav_labels', String(hide));
                        showToast(hide ? 'Nav bar text hidden' : 'Nav bar text visible');
                      }}
                      color="primary"
                    />
                  </div>

                  {/* Search Location Choice Row (Mobile Only) */}
                  <div className="drawer-setting-card mobile-only-setting" style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 auto' }}>
                      <div className="drawer-card-icon">
                        <Search size={18} />
                      </div>
                      <div className="drawer-card-info">
                        <div className="drawer-card-title">Search Placement</div>
                        <div className="drawer-card-sub">Floating button or top bar</div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: 3,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          updateSettings({ searchLocation: 'floating' });
                          localStorage.setItem('search_location', 'floating');
                          showToast('Search position set to Floating');
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          background: (settings.searchLocation ?? 'topbar') === 'floating' ? 'var(--accent)' : 'transparent',
                          color: (settings.searchLocation ?? 'topbar') === 'floating' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                          fontSize: 'var(--fs-xs)',
                          fontWeight: (settings.searchLocation ?? 'topbar') === 'floating' ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Floating
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateSettings({ searchLocation: 'topbar' });
                          localStorage.setItem('search_location', 'topbar');
                          showToast('Search position set to Top Bar');
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          background: (settings.searchLocation ?? 'topbar') === 'topbar' ? 'var(--accent)' : 'transparent',
                          color: (settings.searchLocation ?? 'topbar') === 'topbar' ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                          fontSize: 'var(--fs-xs)',
                          fontWeight: (settings.searchLocation ?? 'topbar') === 'topbar' ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Top Bar
                      </button>
                    </div>
                  </div>

                  {/* Floating Sidebar Toggle Row (Desktop Only) */}
                  <div className="drawer-setting-card desktop-only-setting" style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div className="drawer-card-icon">
                        <Layout size={18} />
                      </div>
                      <div className="drawer-card-info">
                        <div className="drawer-card-title">Floating Sidebar (Desktop)</div>
                        <div className="drawer-card-sub">Detached floating layout</div>
                      </div>
                    </div>
                    <Switch
                      className="custom-toggle-switch"
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

        {/* Bottom Sheet Drawer Modal for Preferences */}
        {showPreferencesSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowPreferencesSheet(false)}>
            <div className="sheet-modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '88vh', overflowY: 'auto' }}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="drawer-header-icon">
                    <Sliders size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      App Preferences
                    </h3>
                    <p className="drawer-header-sub">
                      Currency, category & input defaults
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowPreferencesSheet(false)}
                  title="Close"
                >
                  <X size={17} />
                </button>
              </div>

              {/* Section 1: Financial & Transaction Defaults */}
              <div style={{
                fontSize: 'var(--fs-caption)',
                fontWeight: 700,
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 8,
                marginTop: 2,
              }}>
                Transaction & Financial Defaults
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(() => {
                  const currentCurrency = CURRENCIES.find(c => c.code === settings.currency) || CURRENCIES[0];
                  const currentCategory = settings.categories.find(c => c.name === settings.defaultCategory) || settings.categories[0];
                  const currentWallet = db.wallets.find(w => w.id === settings.defaultWalletId) || db.wallets[0];

                  return (
                    <>
                      {/* 1. Currency Preference Card */}
                      <div
                        onClick={() => setShowCurrencySheet(true)}
                        className="drawer-setting-card"
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div className="drawer-card-icon" style={{ fontWeight: 700, fontSize: 'var(--fs-lg)' }}>
                            {currentCurrency.symbol}
                          </div>
                          <div className="drawer-card-info">
                            <div className="drawer-card-title">
                              Default Currency
                            </div>
                            <div className="drawer-card-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Primary display currency
                            </div>
                          </div>
                        </div>

                        <div className="drawer-select-pill">
                          <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{currentCurrency.symbol}</span>
                          <span style={{ color: 'var(--text)', letterSpacing: '0.01em', fontWeight: 600 }}>{currentCurrency.code}</span>
                          <ChevronDown size={13} style={{ color: 'var(--text-3)', marginLeft: 1 }} />
                        </div>
                      </div>

                      {/* 2. Default Category Preference Card */}
                      <div
                        className="drawer-setting-card"
                        style={{ position: 'relative', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div className="drawer-card-icon">
                            <Tag size={18} />
                          </div>
                          <div className="drawer-card-info">
                            <div className="drawer-card-title">
                              Default Category
                            </div>
                            <div className="drawer-card-sub">
                              Auto-assigned for expenses
                            </div>
                          </div>
                        </div>

                        <div className="drawer-select-pill" style={{ maxWidth: 140 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)', fontWeight: 600 }}>
                            {currentCategory?.name || 'Select'}
                          </span>
                          <ChevronDown size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
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
                          {settings.categories.map((c, cIdx) => (
                            <option key={`${c.name}-${cIdx}`} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 3. Default Wallet Preference Card */}
                      <div
                        className="drawer-setting-card"
                        style={{ position: 'relative', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div className="drawer-card-icon">
                            <Wallet size={18} />
                          </div>
                          <div className="drawer-card-info">
                            <div className="drawer-card-title">
                              Default Wallet
                            </div>
                            <div className="drawer-card-sub">
                              Primary transaction account
                            </div>
                          </div>
                        </div>

                        <div className="drawer-select-pill" style={{ maxWidth: 140 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)', fontWeight: 600 }}>
                            {currentWallet?.name || 'Cash'}
                          </span>
                          <ChevronDown size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
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
                  fontSize: 'var(--fs-caption)',
                  fontWeight: 700,
                  color: 'var(--text-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 0,
                  marginTop: 6,
                }}>
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
                  className="drawer-setting-card"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <div className="drawer-card-icon">
                      <KeyboardIcon size={18} />
                    </div>
                    <div className="drawer-card-info">
                      <div className="drawer-card-title">
                        Auto Open Keyboard
                      </div>
                      <div className="drawer-card-sub">
                        Auto-focus input fields
                      </div>
                    </div>
                  </div>
                  <Switch
                    className="custom-toggle-switch"
                    checked={settings.autoOpenKeyboard ?? false}
                    onChange={(e) => {
                      const val = e.target.checked;
                      localStorage.setItem('auto_open_keyboard', String(val));
                      updateSettings({ autoOpenKeyboard: val });
                      showToast(val ? 'Auto open keyboard enabled' : 'Auto open keyboard disabled');
                    }}
                    onClick={(e) => e.stopPropagation()}
                    color="primary"
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
              className="sheet-modal categories-sheet-modal"
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
                  <div className="sheet-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div className="drawer-header-icon" style={{ flexShrink: 0 }}>
                        <Tag size={19} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Manage Category Tags
                        </h3>
                        <p className="drawer-header-sub" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {settings.categories.length} category tags configured
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="drawer-reset-btn"
                        onClick={() => {
                          updateSettings({ categories: [...DEFAULT_CATEGORIES] });
                          showToast('Reset categories to default');
                        }}
                        title="Reset to default categories"
                        aria-label="Reset categories"
                      >
                        <RotateCcw size={14} />
                        <span className="drawer-reset-text">Reset</span>
                      </button>
                      <button
                        type="button"
                        className="drawer-close-btn"
                        onClick={() => {
                          setShowCategoriesSheet(false);
                          setCategorySubView('list');
                        }}
                        title="Close"
                      >
                        <X size={17} />
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Body */}
                  <div className="sheet-modal-body">
                    {/* All Category Chips Grid */}
                    <div className="category-chip-list" style={{ marginBottom: 16 }}>
                      {settings.categories.map((c: Category, cIdx: number) => {
                        const bgTint = c.color.startsWith('#') && c.color.length === 7 ? `${c.color}1c` : 'var(--accent-soft)';
                        const borderTint = c.color.startsWith('#') && c.color.length === 7 ? `${c.color}35` : 'var(--border)';
                        return (
                          <div key={`${c.name}-${cIdx}`} className="category-chip">
                            <div className="category-chip-content">
                              <span
                                className="category-chip-icon-badge"
                                style={{
                                  background: bgTint,
                                  border: `1px solid ${borderTint}`,
                                  color: c.color,
                                }}
                              >
                                <CategoryIcon category={c.name} icon={c.icon} size={14} style={{ color: c.color }} />
                              </span>
                              <span className="category-chip-name">{c.name}</span>
                            </div>
                            <div className="category-chip-actions">
                              <button
                                type="button"
                                className="category-chip-edit"
                                title={`Edit ${c.name}`}
                                onClick={() => startEditCategory(c)}
                              >
                                <Edit2 size={12} strokeWidth={2.2} />
                              </button>
                              <button
                                type="button"
                                className="category-chip-delete"
                                title={`Remove ${c.name}`}
                                onClick={() => handleDeleteCategory(c.name)}
                              >
                                <X size={13} strokeWidth={2.2} />
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
                        className="drawer-setting-card"
                        style={{
                          width: '100%',
                          minHeight: 50,
                          padding: '10px 14px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--accent-soft)',
                              border: '1px solid var(--accent-border-soft)',
                              color: 'var(--accent)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Plus size={18} strokeWidth={2.4} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 650, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                              Add New Category
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={17} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                      </button>
                    </div>
                  </div>
                </>
              ) : categorySubView === 'edit' ? (
                <>
                  {/* Fixed Edit Category Subview Header */}
                  <div className="sheet-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 'none', paddingBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        className="drawer-back-btn"
                        onClick={() => {
                          setCategorySubView('list');
                          setEditingCat(null);
                        }}
                        title="Back to categories"
                      >
                        <ArrowLeft size={17} />
                      </button>
                      <div>
                        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                          Edit Category
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="drawer-close-btn"
                      onClick={() => {
                        setShowCategoriesSheet(false);
                        setCategorySubView('list');
                        setEditingCat(null);
                      }}
                      title="Close"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  {/* Scrollable Form Body */}
                  <div className="sheet-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, border: 'none' }}>
                    <div className="form-group" style={{ marginBottom: 0, border: 'none' }}>
                      <label className="form-label" style={{ fontSize: 'var(--fs-caption)' }}>Category Name *</label>
                      <input
                        ref={editCatInputRef}
                        className="form-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Category name..."
                        onKeyDown={e => e.key === 'Enter' && handleSaveEditCategory()}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0, border: 'none' }}>
                      <label className="form-label" style={{ fontSize: 'var(--fs-caption)' }}>Color Tag</label>
                      <ColorPickerSection color={editColor} onChangeColor={setEditColor} />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0, border: 'none' }}>
                      <label className="form-label" style={{ fontSize: 'var(--fs-caption)' }}>Category Icon</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIconPickerTarget('edit');
                          setIconSearchQuery('');
                          setCategorySubView('select-icon');
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          textAlign: 'left',
                        }}
                        className="drawer-setting-card"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 'var(--radius-sm)',
                              background: (editColor.startsWith('#') && editColor.length === 7 ? `${editColor}20` : 'var(--accent-soft)'),
                              border: `1px solid ${(editColor.startsWith('#') && editColor.length === 7 ? `${editColor}40` : 'var(--border)')}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: editColor,
                              flexShrink: 0,
                            }}
                          >
                            <CategoryIcon category="" icon={editIcon} size={18} style={{ color: editColor }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {AVAILABLE_ICONS.find(i => i.id === editIcon)?.label.split('/')[0].trim() || 'Select Icon'}
                            </div>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 1 }}>
                              Tap to choose icon
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', flexShrink: 0 }}>
                          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--accent)' }}>Select</span>
                          <ChevronRight size={16} />
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Fixed Bottom Action Footer */}
                  <div className="sheet-modal-footer" style={{ display: 'flex', gap: 10, borderTop: 'none', paddingTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => setEditName('')}
                      style={{
                        flex: 1,
                        height: 44,
                        padding: '0 16px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title="Clear category name"
                    >
                      <RotateCcw size={15} />
                      <span>Clear</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEditCategory}
                      disabled={!editName.trim()}
                      style={{
                        flex: 1.6,
                        height: 44,
                        padding: '0 18px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--text)',
                        color: 'var(--surface)',
                        border: 'none',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: !editName.trim() ? 'not-allowed' : 'pointer',
                        opacity: !editName.trim() ? 0.5 : 1,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Check size={16} strokeWidth={2.5} />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </>
              ) : categorySubView === 'select-icon' ? (
                <>
                  {/* Fixed Select Icon Subview Header */}
                  <div className="sheet-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 'none', paddingBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        className="drawer-back-btn"
                        onClick={() => setCategorySubView(iconPickerTarget)}
                        title="Back"
                      >
                        <ArrowLeft size={17} />
                      </button>
                      <div>
                        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                          Select Category Icon
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="drawer-close-btn"
                      onClick={() => {
                        setShowCategoriesSheet(false);
                        setCategorySubView('list');
                      }}
                      title="Close"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  {/* Scrollable Icon Picker Body */}
                  <div className="sheet-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, border: 'none', maxHeight: 'calc(80vh - 110px)', overflowY: 'auto' }}>
                    {/* Search Input */}
                    <div style={{ position: 'relative' }}>
                      <Search
                        size={16}
                        style={{
                          position: 'absolute',
                          left: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-3)',
                          pointerEvents: 'none',
                        }}
                      />
                      <input
                        type="text"
                        value={iconSearchQuery}
                        onChange={e => setIconSearchQuery(e.target.value)}
                        placeholder="Search icons (food, travel, tech, bill...)"
                        className="form-input"
                        style={{
                          paddingLeft: 36,
                          paddingRight: iconSearchQuery ? 36 : 12,
                          height: 38,
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--fs-sm)',
                          width: '100%',
                        }}
                      />
                      {iconSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setIconSearchQuery('')}
                          style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'var(--surface3)',
                            border: 'none',
                            borderRadius: 'var(--radius-full)',
                            width: 20,
                            height: 20,
                            display: 'grid',
                            placeItems: 'center',
                            color: 'var(--text-2)',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Grid of Icons */}
                    {(() => {
                      const filteredIcons = AVAILABLE_ICONS.filter(item => {
                        if (!iconSearchQuery.trim()) return true;
                        const q = iconSearchQuery.toLowerCase().trim();
                        return item.id.toLowerCase().includes(q) || item.label.toLowerCase().includes(q);
                      });

                      if (filteredIcons.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-3)' }}>
                            <Search size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-2)' }}>
                              No icons found
                            </div>
                            <div style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>
                              Try searching for food, travel, tech, gaming, or bills
                            </div>
                            <button
                              type="button"
                              onClick={() => setIconSearchQuery('')}
                              style={{
                                marginTop: 12,
                                padding: '6px 14px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--surface3)',
                                border: 'none',
                                color: 'var(--text)',
                                fontSize: 'var(--fs-xs)',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Clear Search
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
                            gap: 10,
                            padding: '4px 2px 14px',
                          }}
                        >
                          {filteredIcons.map(({ id, label, Icon }) => {
                            const currentSelectedIcon = iconPickerTarget === 'add' ? newCatIcon : editIcon;
                            const currentColor = iconPickerTarget === 'add' ? newCatColor : editColor;
                            const isSelected = currentSelectedIcon === id;
                            const bgTint = isSelected
                              ? (currentColor.startsWith('#') && currentColor.length === 7 ? `${currentColor}22` : 'var(--accent-soft)')
                              : 'var(--surface2)';
                            const borderTint = isSelected ? currentColor : 'var(--border)';

                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => {
                                  if (iconPickerTarget === 'add') {
                                    setNewCatIcon(id);
                                  } else {
                                    setEditIcon(id);
                                  }
                                  setCategorySubView(iconPickerTarget);
                                }}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  padding: '12px 6px',
                                  borderRadius: 'var(--radius-md)',
                                  background: bgTint,
                                  border: isSelected ? `2px solid ${borderTint}` : `1px solid ${borderTint}`,
                                  color: isSelected ? currentColor : 'var(--text-2)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                                  boxShadow: isSelected ? `0 2px 10px ${currentColor}30` : 'none',
                                  transform: isSelected ? 'scale(1.04)' : 'none',
                                  outline: 'none',
                                  boxSizing: 'border-box',
                                }}
                                title={label}
                              >
                                <Icon size={22} style={{ color: isSelected ? currentColor : 'var(--text)' }} />
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: isSelected ? 700 : 500,
                                    color: isSelected ? currentColor : 'var(--text-3)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '100%',
                                    padding: '0 2px',
                                  }}
                                >
                                  {label.split('/')[0].trim()}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Fixed Bottom Action Footer */}
                  <div className="sheet-modal-footer" style={{ display: 'flex', gap: 10, borderTop: 'none', paddingTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => setCategorySubView(iconPickerTarget)}
                      style={{
                        width: '100%',
                        height: 44,
                        padding: '0 18px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--text)',
                        color: 'var(--surface)',
                        border: 'none',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Check size={16} strokeWidth={2.5} />
                      <span>Done</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Fixed Add Category Subview Header without splitting lines */}
                  <div className="sheet-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 'none', paddingBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        className="drawer-back-btn"
                        onClick={() => setCategorySubView('list')}
                        title="Back to categories"
                      >
                        <ArrowLeft size={17} />
                      </button>
                      <div>
                        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                          Add New Category
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="drawer-close-btn"
                      onClick={() => {
                        setShowCategoriesSheet(false);
                        setCategorySubView('list');
                      }}
                      title="Close"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  {/* Scrollable Form Body without splitting lines */}
                  <div className="sheet-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, border: 'none' }}>
                    <div className="form-group" style={{ marginBottom: 0, border: 'none' }}>
                      <label className="form-label" style={{ fontSize: 'var(--fs-caption)' }}>Category Name</label>
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
                      <label className="form-label" style={{ fontSize: 'var(--fs-caption)' }}>Color Tag</label>
                      <ColorPickerSection color={newCatColor} onChangeColor={setNewCatColor} />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0, border: 'none' }}>
                      <label className="form-label" style={{ fontSize: 'var(--fs-caption)' }}>Category Icon</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIconPickerTarget('add');
                          setIconSearchQuery('');
                          setCategorySubView('select-icon');
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          textAlign: 'left',
                        }}
                        className="drawer-setting-card"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 'var(--radius-sm)',
                              background: (newCatColor.startsWith('#') && newCatColor.length === 7 ? `${newCatColor}20` : 'var(--accent-soft)'),
                              border: `1px solid ${(newCatColor.startsWith('#') && newCatColor.length === 7 ? `${newCatColor}40` : 'var(--border)')}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: newCatColor,
                              flexShrink: 0,
                            }}
                          >
                            <CategoryIcon category="" icon={newCatIcon} size={18} style={{ color: newCatColor }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {AVAILABLE_ICONS.find(i => i.id === newCatIcon)?.label.split('/')[0].trim() || 'Select Icon'}
                            </div>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 1 }}>
                              Tap to choose icon
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', flexShrink: 0 }}>
                          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--accent)' }}>Select</span>
                          <ChevronRight size={16} />
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Fixed Bottom Action Footer without dividing border */}
                  <div className="sheet-modal-footer" style={{ display: 'flex', gap: 10, borderTop: 'none', paddingTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCatName('');
                        setNewCatColor(FRIEND_PALETTE[0]);
                        setNewCatIcon('other');
                      }}
                      style={{
                        flex: 1,
                        height: 44,
                        padding: '0 16px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <RotateCcw size={15} />
                      <span>Clear</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      style={{
                        flex: 1.6,
                        height: 44,
                        padding: '0 18px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--text)',
                        color: 'var(--surface)',
                        border: 'none',
                        fontSize: 'var(--fs-sm)',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Plus size={16} strokeWidth={2.5} />
                      <span>Add Category</span>
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
              className="sheet-modal"
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
                  <div className="drawer-header-icon">
                    <Coins size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Select Currency
                    </h3>
                    <p className="drawer-header-sub">
                      Choose your primary app currency & symbol
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowCurrencySheet(false)}
                  title="Close"
                >
                  <X size={17} />
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
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--fs-sm)'
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
                      borderRadius: 'var(--radius-full)',
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
                    fontSize: 'var(--fs-caption)',
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
                    {['INR', 'USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'JPY', 'SGD', 'SAR'].map((code, idx) => {
                      const c = CURRENCIES.find(item => item.code === code);
                      if (!c) return null;
                      const isSelected = settings.currency === code;
                      return (
                        <button
                          key={`${code}-${idx}`}
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
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--fs-xs)',
                            fontWeight: isSelected ? 700 : 500,
                            background: isSelected ? 'var(--accent)' : 'var(--surface2)',
                            border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                            color: isSelected ? 'var(--accent-contrast, #ffffff)' : 'var(--text-2)',
                            cursor: 'pointer',
                            boxShadow: isSelected ? '0 2px 6px rgba(0, 0, 0, 0.15)' : 'none',
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
              <div className="sheet-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                {filteredCurrencies.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '36px 16px',
                    color: 'var(--text-3)',
                    fontSize: 'var(--fs-sm)'
                  }}>
                    <Coins size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-2)' }}>No currencies found</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: 'var(--fs-xs)' }}>Try searching with a different name, country or code</p>
                  </div>
                ) : (
                  filteredCurrencies.map((c, idx) => {
                    const isSelected = settings.currency === c.code;
                    return (
                      <div
                        key={`${c.code}-${idx}`}
                        onClick={() => {
                          updateSettings({ currency: c.code });
                          showToast(`Default currency set to ${c.name} (${c.code})`);
                          setShowCurrencySheet(false);
                        }}
                        className="drawer-setting-card"
                        style={{
                          border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                          background: isSelected ? 'var(--accent-soft)' : 'var(--surface2)',
                          boxShadow: isSelected ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div
                            className="drawer-card-icon"
                            style={{
                              background: isSelected ? 'var(--accent)' : undefined,
                              color: isSelected ? 'var(--accent-contrast, #fff)' : 'var(--accent)',
                              border: isSelected ? 'none' : undefined,
                              fontSize: 'var(--fs-md)',
                              fontWeight: 750,
                            }}
                          >
                            {c.symbol}
                          </div>
                          <div className="drawer-card-info">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="drawer-card-title">
                                {c.code}
                              </span>
                              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                — {c.name}
                              </span>
                            </div>
                            <div className="drawer-card-sub" style={{ marginTop: 2 }}>
                              {c.country} • Symbol: <strong style={{ color: 'var(--text-2)' }}>{c.symbol}</strong>
                            </div>
                          </div>
                        </div>

                        <div style={{ flexShrink: 0 }}>
                          {isSelected ? (
                            <div style={{
                              width: 24,
                              height: 24,
                              borderRadius: 'var(--radius-full)',
                              background: 'var(--accent)',
                              color: 'var(--accent-contrast, #fff)',
                              display: 'grid',
                              placeItems: 'center'
                            }}>
                              <Check size={14} strokeWidth={3} />
                            </div>
                          ) : (
                            <span style={{
                              fontSize: 'var(--fs-xs)',
                              fontWeight: 600,
                              color: 'var(--text-3)',
                              background: 'var(--surface)',
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-xs)',
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

        {/* Section 2: Data & Storage */}
        {showDataSection && (
          <div className="settings-section-group">
            <div className="settings-section-label">Data & Storage</div>

            <div className="settings-section-grid">
              {/* Data Summary Card */}
              {showData && (
                <div className="card settings-summary-card" onClick={() => setShowDataSheet(true)}>
                  <div className="settings-card-inner">
                    <div className="settings-card-left">
                      <div className="settings-card-icon">
                        <Database size={19} />
                      </div>
                      <div className="settings-card-text">
                        <h2 className="settings-card-title">Data Management</h2>
                        <p className="settings-card-sub">
                          Backup & restore
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
          </div>
        )}

        {/* Bottom Sheet Drawer Modal for Data */}
        {showDataSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowDataSheet(false)}>
            <div className="sheet-modal" onClick={(e) => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="drawer-header-icon">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16.5, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Data
                    </h3>
                    <p className="drawer-header-sub">
                      Export, import, or manage local storage
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowDataSheet(false)}
                  title="Close"
                >
                  <X size={17} />
                </button>
              </div>

              {/* Action Buttons Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: (settings.enableDummyData ?? false) ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
                <button type="button" className="data-action-card" onClick={() => { setShowDataSheet(false); handleExportClick(); }}>
                  <div className="data-action-icon-wrap">
                    <Download size={25} strokeWidth={2.1} />
                  </div>
                  <span className="data-action-label">Export</span>
                  <span className="data-action-sub">Save backup</span>
                </button>

                <button type="button" className="data-action-card" onClick={handleImportClick}>
                  <div className="data-action-icon-wrap">
                    <Upload size={25} strokeWidth={2.1} />
                  </div>
                  <span className="data-action-label">Import</span>
                  <span className="data-action-sub">Restore file</span>
                </button>

                {(settings.enableDummyData ?? false) && (
                  <button type="button" className="data-action-card" onClick={() => { setShowDataSheet(false); setShowDummyModal(true); }}>
                    <div className="data-action-icon-wrap">
                      <Sparkles size={25} strokeWidth={2.1} />
                    </div>
                    <span className="data-action-label">Dummy Data</span>
                    <span className="data-action-sub">Add records</span>
                  </button>
                )}
              </div>

              <div className="data-reset-row" onClick={() => { setShowDataSheet(false); setShowReset(true); }} role="button" tabIndex={0}>
                <div className="data-reset-left">
                  <div className="data-reset-icon-wrap">
                    <Trash2 size={15} />
                  </div>
                  <div className="data-reset-title">Reset all data</div>
                </div>
                <ChevronRight size={15} className="data-reset-arrow" />
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Bottom Sheet Drawer Modal for Report Bug / Suggest Feature */}
        {showFeedbackSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowFeedbackSheet(false)}>
            <div className="sheet-modal feedback-modal-sheet" onClick={(e) => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)',
                    flexShrink: 0
                  }}>
                    <MessageSquarePlus size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 750, margin: 0, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                      Report Bug / Feature Request
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>
                      Create an issue on prathambahekar/okane
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowFeedbackSheet(false)}
                  title="Close"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9999,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--text-2)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={17} />
                </button>
              </div>

              <form onSubmit={handleSendFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Type Selection */}
                <div>
                  <label style={{ marginBottom: 6, display: 'block', fontSize: 12, fontWeight: 650, color: 'var(--text-2)' }}>
                    Feedback Type
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setFeedbackType('bug')}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 14,
                        border: feedbackType === 'bug' ? '1px solid var(--text)' : '1px solid var(--border)',
                        background: feedbackType === 'bug' ? 'var(--text)' : 'var(--surface2)',
                        color: feedbackType === 'bug' ? 'var(--bg)' : 'var(--text-2)',
                        fontWeight: feedbackType === 'bug' ? 700 : 500,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Bug size={16} style={{ color: feedbackType === 'bug' ? 'var(--bg)' : 'var(--text-2)' }} />
                      <span>Bug / Issue</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFeedbackType('feature')}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 14,
                        border: feedbackType === 'feature' ? '1px solid var(--text)' : '1px solid var(--border)',
                        background: feedbackType === 'feature' ? 'var(--text)' : 'var(--surface2)',
                        color: feedbackType === 'feature' ? 'var(--bg)' : 'var(--text-2)',
                        fontWeight: feedbackType === 'feature' ? 700 : 500,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Lightbulb size={16} style={{ color: feedbackType === 'feature' ? 'var(--bg)' : 'var(--text-2)' }} />
                      <span>Suggest Feature</span>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label style={{ marginBottom: 5, display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 650, color: 'var(--text-2)' }}>
                    Title
                  </label>
                  <input
                    type="text"
                    className="feedback-form-input"
                    value={feedbackTitle}
                    onChange={(e) => setFeedbackTitle(e.target.value)}
                    placeholder={feedbackType === 'bug' ? "e.g., Error when settling friend balance" : "e.g., Add custom tags for expense search"}
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={{ marginBottom: 5, display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 650, color: 'var(--text-2)' }}>
                    Description
                  </label>
                  <textarea
                    className="feedback-form-input feedback-form-textarea"
                    rows={3}
                    value={feedbackDescription}
                    onChange={(e) => setFeedbackDescription(e.target.value)}
                    placeholder={feedbackType === 'bug' ? "Describe what happened, expected behavior, or steps to reproduce..." : "Describe the feature idea and how it would improve the app..."}
                    required
                  />
                </div>

                {/* App Version Switch Toggle Card */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  background: 'var(--surface2)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 650, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Include app & device specs
                    </span>
                    <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', fontWeight: 500 }}>
                      App version (<strong style={{ color: 'var(--text-2)', fontWeight: 600 }}>v{currentAppVersion}</strong>) & system details
                    </span>
                  </div>
                  <Switch
                    className="custom-toggle-switch"
                    checked={includeVersionInfo}
                    onChange={(e) => setIncludeVersionInfo(e.target.checked)}
                    color="primary"
                  />
                </div>

                {/* Success Notification */}
                {feedbackStatus === 'success' && createdIssueInfo && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: 'var(--radius-lg)', color: '#22c55e', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={18} />
                      <span>Issue #{createdIssueInfo.number} created!</span>
                    </div>
                    <a
                      href={createdIssueInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#22c55e', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)' }}
                    >
                      <span>View Issue</span>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                )}

                {/* Error Notification */}
                {feedbackStatus === 'error' && errorMessage && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-lg)', color: '#ef4444', fontSize: 'var(--fs-sm)' }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <X size={16} />
                      <span>Unable to create GitHub issue automatically</span>
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', opacity: 0.9, lineHeight: 1.4 }}>
                      {errorMessage}
                    </div>
                    {feedbackTitle.trim() && (
                      <a
                        href={`https://github.com/prathambahekar/okane/issues/new?title=${encodeURIComponent(`[${feedbackType.toUpperCase()}] ${feedbackTitle.trim()}`)}&body=${encodeURIComponent(`${feedbackDescription.trim()}\n\n---\n**Metadata:**\n- Type: ${feedbackType}\n- Version: ${currentAppVersion}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: 4, alignSelf: 'flex-start', fontSize: 'var(--fs-xs)', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', borderRadius: 'var(--radius-full)' }}
                      >
                        <ExternalLink size={14} /> Open Form on GitHub Web
                      </a>
                    )}
                  </div>
                )}

                {/* Bottom 2 Rounded Pill Action Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: 10, marginTop: 4, paddingBottom: 2 }}>
                  <button
                    type="button"
                    className="feedback-pill-btn feedback-pill-btn-clear"
                    onClick={() => {
                      setFeedbackTitle('');
                      setFeedbackDescription('');
                      setFeedbackStatus('idle');
                      setErrorMessage('');
                    }}
                    title="Clear form"
                  >
                    <RotateCcw size={15} />
                    <span>Clear</span>
                  </button>

                  <button
                    type="submit"
                    className="feedback-pill-btn feedback-pill-btn-submit"
                    disabled={isSubmittingFeedback || !feedbackTitle.trim() || !feedbackDescription.trim()}
                  >
                    {isSubmittingFeedback ? (
                      <>
                        <RefreshCw size={15} className="spin" />
                        <span>Submitting...</span>
                      </>
                    ) : feedbackType === 'bug' ? (
                      <>
                        <GitPullRequest size={16} />
                        <span>Submit Issue</span>
                      </>
                    ) : (
                      <>
                        <Lightbulb size={16} />
                        <span>Submit Feature</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Section 3 cards are integrated into System & Info */}

        {/* Bottom Sheet Drawer Modal for Advanced Features */}
        {showAdvancedSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowAdvancedSheet(false)}>
            <div className="sheet-modal" onClick={(e) => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {/* Header */}
              <div className="sheet-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="drawer-header-icon">
                    <Sliders size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Advanced Features
                    </h3>
                    <p className="drawer-header-sub">
                      Additional tools & utilities
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowAdvancedSheet(false)}
                  title="Close"
                >
                  <X size={17} />
                </button>
              </div>

              {/* List of Advanced Features - Scrollable */}
              <div
                className="sheet-modal-body"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  overflowY: 'auto',
                  maxHeight: 'calc(80vh - 80px)',
                  paddingRight: 2,
                  paddingBottom: 16,
                  overscrollBehavior: 'contain',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {/* 1. AI Assistant (Max) */}
                <div className="drawer-setting-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div className="drawer-card-icon">
                      <Sparkles size={18} />
                    </div>
                    <div className="drawer-card-info">
                      <div className="drawer-card-title">AI Assistant (Max)</div>
                      <div className="drawer-card-sub">Voice & floating trigger</div>
                    </div>
                  </div>

                  <Switch
                    className="custom-toggle-switch"
                    checked={settings.enableAIAssistant ?? true}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      updateSettings({ enableAIAssistant: enabled });
                      showToast(enabled ? 'AI Assistant enabled' : 'AI Assistant disabled');
                    }}
                  />
                </div>

                {/* 2. Autopay & Subscriptions */}
                <div className="drawer-setting-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div className="drawer-card-icon">
                      <RefreshCw size={18} />
                    </div>
                    <div className="drawer-card-info">
                      <div className="drawer-card-title">Autopay & Subs</div>
                      <div className="drawer-card-sub">Recurring bills & logs</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {(settings.enableAutopay ?? true) && onNavigate && (
                      <button
                        type="button"
                        className="drawer-action-icon-btn"
                        onClick={() => { setShowAdvancedSheet(false); onNavigate('recurring'); }}
                        title="Open Autopay & Subscriptions"
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    )}
                    <Switch
                      className="custom-toggle-switch"
                      checked={settings.enableAutopay ?? true}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateSettings({ enableAutopay: enabled });
                        showToast(enabled ? 'Autopay enabled' : 'Autopay disabled');
                      }}
                    />
                  </div>
                </div>

                {/* 4. Trips & Group Splits */}
                <div className="drawer-setting-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div className="drawer-card-icon">
                      <Plane size={18} />
                    </div>
                    <div className="drawer-card-info">
                      <div className="drawer-card-title">Trips & Splits</div>
                      <div className="drawer-card-sub">Group ledgers & splits</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {(settings.enableSplitTrips ?? true) && onNavigate && (
                      <button
                        type="button"
                        className="drawer-action-icon-btn"
                        onClick={() => { setShowAdvancedSheet(false); onNavigate('split-trips'); }}
                        title="Open Trips & Splits"
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    )}
                    <Switch
                      className="custom-toggle-switch"
                      checked={settings.enableSplitTrips ?? true}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateSettings({ enableSplitTrips: enabled });
                        showToast(enabled ? 'Trips & Splits enabled' : 'Trips & Splits disabled');
                      }}
                    />
                  </div>
                </div>


              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Section 3: System & Info */}
        {showSystemSection && (
          <div className="settings-section-group">
            <div className="settings-section-label">System & Info</div>

            <div className="settings-section-grid">
              {/* Security & Privacy Card */}
              {showSecurity && (
                <div className="card settings-summary-card" onClick={() => setShowSecuritySheet(true)}>
                  <div className="settings-card-inner">
                    <div className="settings-card-left">
                      <div className="settings-card-icon">
                        <ShieldCheck size={19} />
                      </div>
                      <div className="settings-card-text">
                        <h2 className="settings-card-title">Security & Privacy</h2>
                        <p className="settings-card-sub">
                          {isLockEnabled ? 'PIN & biometric active' : 'PIN & biometric lock'}
                        </p>
                      </div>
                    </div>

                    <div className="settings-card-right">
                      <ChevronRight className="settings-card-arrow" size={18} />
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Features Card */}
              {showAdvanced && (
                <div className="card settings-summary-card" onClick={() => setShowAdvancedSheet(true)}>
                  <div className="settings-card-inner">
                    <div className="settings-card-left">
                      <div className="settings-card-icon">
                        <Sparkles size={19} />
                      </div>
                      <div className="settings-card-text">
                        <h2 className="settings-card-title">Advanced Features</h2>
                        <p className="settings-card-sub">
                          AI assistant & splits
                        </p>
                      </div>
                    </div>

                    <div className="settings-card-right">
                      <ChevronRight className="settings-card-arrow" size={18} />
                    </div>
                  </div>
                </div>
              )}

              {/* Developer Mode Card */}
              {showDev && (
                <div className="card settings-summary-card" onClick={() => setShowDevSheet(true)}>
                  <div className="settings-card-inner">
                    <div className="settings-card-left">
                      <div
                        className="settings-card-icon"
                        style={{
                          background: isDevMode ? 'var(--accent)' : undefined,
                          color: isDevMode ? 'var(--accent-contrast, #fff)' : undefined,
                        }}
                      >
                        <FlaskConical size={19} />
                      </div>
                      <div className="settings-card-text">
                        <h2 className="settings-card-title">Developer Mode</h2>
                        <p className="settings-card-sub">
                          Experimental features
                        </p>
                      </div>
                    </div>

                    <div className="settings-card-right" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Switch
                        className="custom-toggle-switch"
                        checked={isDevMode}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          updateSettings({ devMode: checked });
                          showToast(checked ? 'Developer Mode enabled!' : 'Developer Mode disabled');
                        }}
                      />
                      <ChevronRight
                        className="settings-card-arrow"
                        size={18}
                        onClick={() => setShowDevSheet(true)}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Sample Demo Data Card (Developer Mode) */}
              {isDevMode && (settings.enableDummyData ?? false) && (
                <div className="card settings-summary-card" onClick={() => setShowDummyModal(true)}>
                  <div className="settings-card-inner">
                    <div className="settings-card-left">
                      <div className="settings-card-icon">
                        <Sparkles size={19} />
                      </div>
                      <div className="settings-card-text">
                        <h2 className="settings-card-title">Sample Demo Data</h2>
                        <p className="settings-card-sub">
                          Populate sample records
                        </p>
                      </div>
                    </div>

                    <div className="settings-card-right">
                      <ChevronRight className="settings-card-arrow" size={18} />
                    </div>
                  </div>
                </div>
              )}

              {/* App Version Summary Card */}
              {showAppInfo && (
                <div className="card settings-summary-card" onClick={() => setShowVersionSheet(true)}>
                  <div className="settings-card-inner">
                    <div className="settings-card-left">
                      <div className="settings-card-icon">
                        <Info size={19} />
                      </div>
                      <div className="settings-card-text">
                        <h2 className="settings-card-title">App Info</h2>
                        <p className="settings-card-sub">
                          Version & updates
                        </p>
                      </div>
                    </div>

                    <div className="settings-card-right">
                      <span className="settings-version-pill">
                        v{currentAppVersion}
                      </span>
                      <ChevronRight className="settings-card-arrow" size={18} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      )}

        {/* Bottom Sheet Drawer Modal for Experimental Features */}
        {showDevSheet && createPortal(
          <div className="sheet-backdrop" onClick={() => setShowDevSheet(false)}>
            <div className="sheet-modal" onClick={(e) => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="drawer-header-icon">
                    <FlaskConical size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16.5, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Experimental Features
                    </h3>
                    <p className="drawer-header-sub">
                      Toggle & test developer features
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setShowDevSheet(false)}
                  title="Close"
                >
                  <X size={17} />
                </button>
              </div>

              {/* Master Developer Mode Toggle Row */}
              <div className="drawer-setting-card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div className="drawer-card-icon" style={{
                    background: isDevMode ? 'var(--accent)' : undefined,
                    color: isDevMode ? 'var(--accent-contrast, #fff)' : 'var(--accent)'
                  }}>
                    <FlaskConical size={18} />
                  </div>
                  <div className="drawer-card-info">
                    <div className="drawer-card-title">Enable Developer Mode</div>
                    <div className="drawer-card-sub">Master switch for experimental tools</div>
                  </div>
                </div>
                <Switch
                  className="custom-toggle-switch"
                  checked={isDevMode}
                  onChange={e => {
                    const checked = e.target.checked;
                    updateSettings({ devMode: checked });
                    showToast(checked ? 'Developer Mode enabled!' : 'Developer Mode disabled.');
                  }}
                />
              </div>

              {/* Single Column Clean List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: isDevMode ? 1 : 0.5, pointerEvents: isDevMode ? 'auto' : 'none', transition: 'all 0.2s ease' }}>
                {/* 1. SQL Console */}
                <div className="drawer-setting-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div className="drawer-card-icon">
                      <Terminal size={17} />
                    </div>
                    <div className="drawer-card-info">
                      <div className="drawer-card-title">SQL Dev Console</div>
                      <div className="drawer-card-sub">Execute raw AlaSQL queries</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {isDevMode && (settings.enableDevSQLConsole ?? true) && onNavigate && (
                      <button
                        type="button"
                        className="drawer-action-icon-btn"
                        onClick={() => { setShowDevSheet(false); onNavigate('dev-sql'); }}
                        title="Open SQL Dev Console"
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    )}
                    <Switch
                      className="custom-toggle-switch"
                      disabled={!isDevMode}
                      checked={isDevMode && (settings.enableDevSQLConsole ?? true)}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateSettings({ enableDevSQLConsole: enabled });
                        showToast(enabled ? 'SQL Dev Console enabled' : 'SQL Dev Console disabled');
                      }}
                    />
                  </div>
                </div>

                {/* 4. Sample Demo Data */}
                <div className="drawer-setting-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div className="drawer-card-icon">
                      <Sparkles size={17} />
                    </div>
                    <div className="drawer-card-info">
                      <div className="drawer-card-title">Sample Demo Data</div>
                      <div className="drawer-card-sub">Load sample records</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {isDevMode && (settings.enableDummyData ?? false) && (
                      <button
                        type="button"
                        className="drawer-action-icon-btn"
                        onClick={() => { setShowDevSheet(false); setShowDummyModal(true); }}
                        title="Open Sample Data"
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    )}
                    <Switch
                      className="custom-toggle-switch"
                      disabled={!isDevMode}
                      checked={isDevMode && (settings.enableDummyData ?? false)}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateSettings({ enableDummyData: enabled });
                        showToast(enabled ? 'Sample Demo Data enabled' : 'Sample Demo Data disabled');
                      }}
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
            <div className="sheet-modal app-version-sheet" onClick={(e) => e.stopPropagation()}>
              {/* Drag Handle */}
              <div className="sheet-drag-handle" style={{ marginBottom: 18 }} />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)',
                    flexShrink: 0
                  }}>
                    <Info size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 750, margin: 0, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                        Okane Info
                      </h3>
                      <span style={{
                        fontSize: 'var(--fs-caption)',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        border: '1px solid var(--accent-border-soft)'
                      }}>
                        v{currentAppVersion}
                      </span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-3)', fontWeight: 500 }}>
                      System info & updates
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <a
                    href="https://github.com/prathambahekar/okane"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on GitHub"
                    aria-label="View on GitHub"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--text-2)',
                      cursor: 'pointer',
                      textDecoration: 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <GitPullRequest size={17} />
                  </a>

                  <button
                    type="button"
                    className="drawer-close-btn"
                    onClick={() => setShowVersionSheet(false)}
                    title="Close"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--text-2)',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              {/* Software Update Status Panel */}
              {availableUpdate ? (
                <div className="drawer-setting-card" style={{
                  marginBottom: 14,
                  padding: '14px 16px',
                  borderColor: 'rgba(59, 130, 246, 0.35)',
                  background: 'var(--surface2)',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="drawer-card-icon" style={{
                        width: 38,
                        height: 38,
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        color: '#3b82f6'
                      }}>
                        <ArrowUpCircle size={20} />
                      </div>
                      <div className="drawer-card-info">
                        <div className="drawer-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>v{availableUpdate.version} Available</span>
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 'var(--radius-full)', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 700 }}>
                            NEW
                          </span>
                        </div>
                        <div className="drawer-card-sub" style={{ fontSize: 'var(--fs-xs)' }}>
                          Build #{availableUpdate.buildNumber} • {availableUpdate.releaseDate}
                        </div>
                      </div>
                    </div>
                    {!isUpdating && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => installUpdate()}
                        style={{ gap: 6, padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', fontWeight: 650, flexShrink: 0 }}
                        title="Download Update"
                      >
                        <Download size={14} />
                        <span className="hide-mobile">Download</span>
                      </button>
                    )}
                  </div>
                  {isUpdating && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 600, marginBottom: 5, color: 'var(--text-2)' }}>
                        <span>{updateStatusMessage}</span>
                        <span>{updateProgress}%</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${updateProgress}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width 0.2s ease' }} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="drawer-setting-card" style={{ marginBottom: 14, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 auto' }}>
                    <div className="drawer-card-icon" style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: 'rgba(34, 197, 94, 0.12)',
                      border: '1px solid rgba(34, 197, 94, 0.25)',
                      color: '#22c55e'
                    }}>
                      <CheckCircle2 size={20} />
                    </div>
                    <div className="drawer-card-info">
                      <div className="drawer-card-title" style={{ fontSize: 14, fontWeight: 700 }}>
                        App is up to date
                      </div>
                      <div className="drawer-card-sub" style={{ fontSize: 12, marginTop: 2 }}>
                        Checked {settings.lastUpdateCheck || String(jsonSettings.lastUpdated || 'Today')}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => checkForUpdates(true)}
                    disabled={isCheckingUpdate}
                    title="Check for software updates"
                    style={{
                      gap: 6,
                      fontSize: 12,
                      padding: '8px 14px',
                      borderRadius: 10,
                      fontWeight: 650,
                      flexShrink: 0,
                      background: 'var(--surface3)',
                      border: '1px solid var(--border)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <RefreshCw size={14} className={isCheckingUpdate ? 'spin' : ''} />
                    <span className="hide-mobile">{isCheckingUpdate ? 'Checking...' : 'Check Updates'}</span>
                  </button>
                </div>
              )}

              {/* Action Toolbar - Feedback at left, Version History at right */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'stretch',
                gap: 8,
                marginBottom: 4,
              }}>
                {/* 1. Feedback Shortcut Button (Left) */}
                <button
                  type="button"
                  className="app-version-action-btn"
                  onClick={() => { setShowVersionSheet(false); setShowFeedbackSheet(true); }}
                  title="Report Issue or Suggest Feature"
                  aria-label="Feedback and Bug Report"
                >
                  <MessageSquarePlus size={16} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
                  <span>Feedback</span>
                </button>

                {/* 2. Developer JSON Viewer Action Button (Dev Mode) */}
                {isDevMode && (
                  <button
                    type="button"
                    className="app-version-action-btn"
                    onClick={() => setShowJsonView(!showJsonView)}
                    title="Inspect Settings JSON Manifest"
                    aria-label="Toggle Settings JSON"
                    style={{
                      background: showJsonView ? 'var(--surface3)' : 'var(--surface2)',
                      borderColor: showJsonView ? 'var(--accent)' : 'var(--border)'
                    }}
                  >
                    <FileCode size={16} style={{ color: showJsonView ? 'var(--accent)' : 'var(--text-2)', flexShrink: 0 }} />
                    <span className="hide-mobile">{showJsonView ? 'Hide JSON' : 'settings.json'}</span>
                  </button>
                )}

                {/* 3. Version History Action Button (Right) */}
                <button
                  type="button"
                  className="app-version-action-btn"
                  onClick={() => { setShowVersionSheet(false); setHistoryModalOpen(true); }}
                  title="View Version Release History"
                  aria-label="Version Release History"
                >
                  <History size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span>Version History</span>
                  {displayReleaseHistory.length > 0 && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 99,
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      border: '1px solid var(--accent-border-soft)'
                    }}>
                      {displayReleaseHistory.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Developer JSON Inspector (if enabled) */}
              {isDevMode && showJsonView && (
                <div style={{ marginTop: 12, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 650, color: 'var(--text-3)' }}>public/settings.json</span>
                    <a href="/settings.json" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                      Open Raw File ↗
                    </a>
                  </div>
                  <pre style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    background: 'var(--surface2)',
                    padding: 12,
                    borderRadius: 12,
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

      {showReset && (
        <ConfirmDialog
          title="Reset All Data"
          message="Permanently erases all expenses, friends, wallets, and settlements."
          confirmLabel="Reset Everything"
          onConfirm={handleReset}
          onClose={() => setShowReset(false)}
        />
      )}

      {/* Dummy Data Dialog Modal */}
      {showDummyModal && createPortal(
        <div
          className="modal-backdrop"
          style={{ zIndex: 100095 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDummyModal(false);
          }}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '420px',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'var(--surface)',
              borderRadius: 16,
              border: '1px solid var(--border)',
            }}
          >
            <div className="modal-header" style={{ padding: 0, borderBottom: 'none', background: 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    border: '1px solid var(--border2)',
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={20} />
                </div>
                <div>
                  <span className="modal-title" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                    Add Dummy Data
                  </span>
                  <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '2px 0 0 0' }}>
                    Populate sample data for testing & preview
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowDummyModal(false)}
                style={{ borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.55 }}>
              This will add realistic sample records to your app:
              <ul style={{ margin: '8px 0 0 18px', padding: 0, fontSize: 12.5, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>14+ categorized expenses across multiple wallets & dates</li>
                <li>Friends with split obligations (&apos;Owes You&apos; &amp; &apos;You Owe&apos;)</li>
                <li>Vendor contact (Tiffin service) with dedicated vendor badge</li>
                <li>Sample recurring payment subscription</li>
              </ul>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 4 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAppendDummyData}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  fontWeight: 650,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Sparkles size={16} />
                Append Sample Records
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetAndDummyData}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  fontWeight: 600,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: 'var(--text-2)',
                }}
              >
                <RotateCcw size={15} />
                Reset &amp; Load Fresh Sample Data
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowDummyModal(false)}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  fontWeight: 500,
                  borderRadius: 10,
                  fontSize: 13,
                  color: 'var(--text-3)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Export Options Modal */}
      {exportModalOpen && createPortal(
        <div
          className="sheet-backdrop"
          onClick={() => setExportModalOpen(false)}
        >
          <div
            className="sheet-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="sheet-drag-handle" />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="drawer-header-icon">
                  <Download size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16.5, fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                    Export Backup
                  </h3>
                  <p className="drawer-header-sub">
                    Save or share your backup file (.db)
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setExportModalOpen(false)}
                title="Close"
              >
                <X size={17} />
              </button>
            </div>

            {/* Export Method Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
              {/* Option 1: Save to Storage */}
              <div
                className="drawer-setting-card"
                onClick={handleSaveToStorage}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div className="drawer-card-icon">
                    <Download size={19} />
                  </div>
                  <div className="drawer-card-info">
                    <div className="drawer-card-title">
                      Export to Storage
                    </div>
                    <div className="drawer-card-sub">
                      Save to local storage
                    </div>
                  </div>
                </div>
                <ChevronRight size={17} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              </div>

              {/* Option 2: Share to Apps */}
              <div
                className="drawer-setting-card"
                onClick={handleShareToApps}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div className="drawer-card-icon">
                    <Send size={18} />
                  </div>
                  <div className="drawer-card-info">
                    <div className="drawer-card-title">
                      Share to Apps
                    </div>
                    <div className="drawer-card-sub">
                      Share with other apps
                    </div>
                  </div>
                </div>
                <ChevronRight size={17} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              </div>
            </div>
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
              padding: '20px 22px 24px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                  flexShrink: 0
                }}>
                  <GitCommit size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '17.5px', fontWeight: 750, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                      Release History
                    </h3>
                    {displayReleaseHistory.length > 0 && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 9999,
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        border: '1px solid var(--accent-border-soft)'
                      }}>
                        {displayReleaseHistory.length} releases
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-3)', marginTop: 2, fontWeight: 500 }}>
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
                  borderRadius: 9999,
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
              gap: '12px',
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
                  const currentVer = currentAppVersion;
                  const normalizedItemVer = item.version.replace(/^v/, '').trim();
                  const normalizedCurrentVer = String(currentVer).replace(/^v/, '').trim();
                  const isCurrent = normalizedItemVer === normalizedCurrentVer;

                  return (
                    <div
                      key={item.version + '_' + idx}
                      style={{
                        padding: '16px 18px',
                        borderRadius: '18px',
                        background: 'var(--surface2)',
                        border: isCurrent ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        boxShadow: isCurrent ? '0 4px 16px var(--accent-soft)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 750, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                            {item.name || `v${item.version}`}
                          </span>
                          {isCurrent && (
                            <span style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 9999,
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
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 9999,
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
                        <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                          {item.releaseDate}
                        </span>
                      </div>

                      <FormattedReleaseNotes notes={item.releaseNotes} />

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                        <a
                          href={item.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 12,
                            color: 'var(--accent)',
                            fontWeight: 650,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 10px',
                            borderRadius: 9999,
                            background: 'var(--accent-soft)',
                            border: '1px solid var(--accent-border-soft)'
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
                              fontSize: 12,
                              color: 'var(--text)',
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '4px 12px',
                              borderRadius: 9999,
                              background: 'var(--surface3)',
                              border: '1px solid var(--border)',
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
        <div className="sheet-backdrop" onClick={() => { setShowSecuritySheet(false); setIsPinSetupActive(false); setSecuritySubView('main'); }}>
          <div className="sheet-modal" onClick={(e) => e.stopPropagation()}>
            {/* Drag Handle */}
            <div className="sheet-drag-handle" />

            {/* Header */}
            <div className="sheet-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              {securitySubView === 'passcode' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    className="drawer-action-icon-btn"
                    onClick={() => setSecuritySubView('main')}
                    title="Back to Security & Privacy"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                  >
                    <ArrowLeft size={17} />
                  </button>
                  <div>
                    <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Passcode Settings
                    </h3>
                    <p className="drawer-header-sub">
                      PIN & Biometric Lock Controls
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="drawer-header-icon">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                      Security & Privacy
                    </h3>
                    <p className="drawer-header-sub">
                      Biometric & PIN Lock
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => { setShowSecuritySheet(false); setIsPinSetupActive(false); setSecuritySubView('main'); }}
                title="Close"
              >
                <X size={17} />
              </button>
            </div>

            {/* Main Controls List - Scrollable */}
            <div
              className="sheet-modal-body"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                overflowY: 'auto',
                maxHeight: 'calc(80vh - 80px)',
                paddingRight: 2,
                paddingBottom: 16,
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {securitySubView === 'main' ? (
                <>
                  {/* 0. Hide Amounts Switch */}
                  <div className="drawer-setting-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div className="drawer-card-icon">
                        {settings.hideAmounts ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </div>
                      <div className="drawer-card-info">
                        <div className="drawer-card-title">
                          Hide Amounts
                        </div>
                        <div className="drawer-card-sub">
                          Mask dashboard balances
                        </div>
                      </div>
                    </div>

                    <Switch
                      className="custom-toggle-switch"
                      checked={Boolean(settings.hideAmounts)}
                      onChange={(e) => {
                        updateSettings({ hideAmounts: e.target.checked });
                      }}
                      color="primary"
                    />
                  </div>

                  {/* 1. Passcode Lock Switch / Sub-view Navigation */}
                  <div
                    className="drawer-setting-card"
                    style={{ cursor: isLockEnabled ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (isLockEnabled) {
                        setSecuritySubView('passcode');
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div className="drawer-card-icon">
                        <KeyRound size={18} />
                      </div>
                      <div className="drawer-card-info">
                        <div className="drawer-card-title">
                          Passcode Lock
                        </div>
                        <div className="drawer-card-sub">
                          {isLockEnabled ? '4-Digit PIN active (Tap for settings)' : 'Disabled'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                      <Switch
                        className="custom-toggle-switch"
                        checked={isLockEnabled}
                        onChange={(e) => {
                          handleToggleSecurityLock(e.target.checked);
                          if (!e.target.checked) {
                            setSecuritySubView('main');
                          }
                        }}
                        color="primary"
                      />
                      {isLockEnabled && (
                        <button
                          type="button"
                          className="drawer-action-icon-btn"
                          onClick={() => setSecuritySubView('passcode')}
                          title="Open Passcode Settings"
                        >
                          <ChevronRight size={17} />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Sub-view: Passcode Lock Options */}

                  {/* 1. Master Passcode Lock Toggle */}
                  <div className="drawer-setting-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div className="drawer-card-icon">
                        <KeyRound size={18} />
                      </div>
                      <div className="drawer-card-info">
                        <div className="drawer-card-title">
                          Passcode Lock
                        </div>
                        <div className="drawer-card-sub">
                          Require 4-digit PIN
                        </div>
                      </div>
                    </div>

                    <Switch
                      className="custom-toggle-switch"
                      checked={isLockEnabled}
                      onChange={(e) => {
                        handleToggleSecurityLock(e.target.checked);
                        if (!e.target.checked) {
                          setSecuritySubView('main');
                        }
                      }}
                      color="primary"
                    />
                  </div>

                  {/* 2. Biometric Unlock Switch */}
                  <div className="drawer-setting-card" style={{ opacity: isLockEnabled ? 1 : 0.65 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div className="drawer-card-icon">
                        <Fingerprint size={18} />
                      </div>
                      <div className="drawer-card-info">
                        <div className="drawer-card-title">
                          Biometric Unlock
                        </div>
                        <div className="drawer-card-sub">
                          Fingerprint & Face ID
                        </div>
                      </div>
                    </div>

                    <Switch
                      className="custom-toggle-switch"
                      checked={isBiometricEnabled}
                      disabled={!isLockEnabled}
                      onChange={(e) => handleToggleBiometricOnly(e.target.checked)}
                      color="primary"
                    />
                  </div>

                  {/* 3. Auto Face Unlock Switch */}
                  <div className="drawer-setting-card" style={{ opacity: isLockEnabled ? 1 : 0.65 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div className="drawer-card-icon">
                        <ScanFace size={18} />
                      </div>
                      <div className="drawer-card-info">
                        <div className="drawer-card-title">
                          Auto Face Unlock
                        </div>
                        <div className="drawer-card-sub">
                          Instant unlock
                        </div>
                      </div>
                    </div>

                    <Switch
                      className="custom-toggle-switch"
                      checked={Boolean(settings.autoUnlockOnFace && isLockEnabled)}
                      disabled={!isLockEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        updateSettings({ autoUnlockOnFace: enabled });
                        showToast(enabled ? 'Face auto-enter enabled' : 'Face auto-enter disabled');
                      }}
                      color="primary"
                    />
                  </div>

                  {/* 4. Resume Lock Switch */}
                  <div className="drawer-setting-card" style={{ opacity: isLockEnabled ? 1 : 0.65 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div className="drawer-card-icon">
                        <Lock size={18} />
                      </div>
                      <div className="drawer-card-info">
                        <div className="drawer-card-title">
                          Resume Lock
                        </div>
                        <div className="drawer-card-sub">
                          Re-lock on app switch
                        </div>
                      </div>
                    </div>

                    <Switch
                      className="custom-toggle-switch"
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

                  {/* 5. Passcode PIN Config Card */}
                  <div className="drawer-setting-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div className="drawer-card-icon">
                        <KeyRound size={18} />
                      </div>
                      <div className="drawer-card-info">
                        <div className="drawer-card-title">
                          Passcode PIN
                        </div>
                        <div className="drawer-card-sub">
                          {settings.securityPin ? 'Configured' : 'Not set'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="drawer-action-icon-btn"
                      onClick={() => setIsPinSetupActive(true)}
                      title={settings.securityPin ? 'Change PIN' : 'Set PIN'}
                    >
                      <Edit2 size={15} />
                    </button>
                  </div>

                  {/* Test Security Lock Button - Shown ONLY when Developer Mode is ON */}
                  {isLockEnabled && isDevMode && (
                    <button
                      type="button"
                      className="drawer-test-lock-btn"
                      onClick={() => {
                        setShowSecuritySheet(false);
                        onTestLock?.();
                      }}
                    >
                      <ShieldCheck size={16} />
                      <span>Test Lock Screen</span>
                    </button>
                  )}
                </>
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

      {/* Permanently mounted hidden file input without restrictive accept to enable full Android system file picker */}
      <input
        ref={fileRef}
        type="file"
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
