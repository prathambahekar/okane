import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Database,
  Download,
  Upload,
  Sparkles,
  Trash2,
  X,
  LogOut,
  UploadCloud,
  DownloadCloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  HardDrive,
  Cloud,
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { useStore } from '../store';
import { generateSQLDumpString, downloadFile, importSQLDumpString } from '../db';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import ConfirmDialog from './ConfirmDialog';
import type { AppDB } from '../types';

interface DataManagementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDummyModal?: () => void;
}

export default function DataManagementDrawer({
  isOpen,
  onClose,
  onOpenDummyModal,
}: DataManagementDrawerProps) {
  const { user, isSyncing, lastSyncTime, signInWithGoogle, signOut, syncToCloud, pullFromCloud } = useFirebase();
  const { db, restoreDB, resetDB, showToast } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  if (!isOpen) return null;

  // Local File Backup
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

  const handleSaveToStorage = async () => {
    const { content, contentType, fileName } = getExportContent();
    try {
      if (Capacitor.isNativePlatform()) {
        try {
          await Filesystem.requestPermissions();
        } catch {
          // ignore
        }
        await Filesystem.writeFile({
          path: `Download/Okane/${fileName}`,
          data: content,
          directory: Directory.ExternalStorage,
          encoding: Encoding.UTF8,
          recursive: true,
        }).catch(async () => {
          await Filesystem.writeFile({
            path: `Okane/${fileName}`,
            data: content,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
            recursive: true,
          });
        });
        showToast('Saved backup to device storage');
      } else {
        downloadFile(content, fileName, contentType);
        showToast('Backup downloaded');
      }
    } catch {
      downloadFile(content, fileName, contentType);
      showToast('Backup downloaded');
    }
    setExportModalOpen(false);
  };

  const handleShareFile = async () => {
    const { content, fileName } = getExportContent();
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await Filesystem.writeFile({
          path: fileName,
          data: content,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: 'Okane Backup',
          text: `Okane Ledger Backup (${new Date().toLocaleDateString()})`,
          url: res.uri,
          dialogTitle: 'Share Okane Backup',
        });
      } else if (navigator.share && navigator.canShare) {
        const file = new File([content], fileName, { type: 'text/plain' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Okane Backup',
            text: 'Okane Ledger Backup',
            files: [file],
          });
        } else {
          downloadFile(content, fileName, 'text/plain;charset=utf-8');
        }
      } else {
        downloadFile(content, fileName, 'text/plain;charset=utf-8');
      }
    } catch (e) {
      console.warn('Share error:', e);
    }
    setExportModalOpen(false);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        if (!text) throw new Error('File is empty');
        const restored = importSQLDumpString(text);
        restoreDB(restored);
        showToast('Backup restored successfully!');
      } catch (err) {
        showToast('Import failed: ' + (err instanceof Error ? err.message : 'Invalid file'));
      }
    };
    reader.readAsText(file);
  };

  // Cloud Actions
  const handleSignIn = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const loggedUser = await signInWithGoogle();
      if (loggedUser) {
        showToast(`Signed in as ${loggedUser.displayName || loggedUser.email}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in cancelled';
      setErrorMsg(message);
    }
  };

  const handleSignOut = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await signOut();
      showToast('Signed out');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign out failed');
    }
  };

  const handleUploadCloud = async () => {
    setErrorMsg(null);
    setStatusMsg('Backing up...');
    try {
      await syncToCloud(db);
      setStatusMsg('Backup complete');
      showToast(`Saved to Cloud (${db.expenses.length} expenses)`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setErrorMsg(msg);
      setStatusMsg(null);
    }
  };

  const handleRestoreFromCloud = async () => {
    setShowRestoreConfirm(false);
    setErrorMsg(null);
    setStatusMsg('Restoring...');
    try {
      const cloudData = await pullFromCloud();
      if (cloudData && (cloudData.expenses || cloudData.wallets || cloudData.friends)) {
        const restoredDB: AppDB = {
          version: cloudData.version || db.version || 3,
          expenses: Array.isArray(cloudData.expenses) ? cloudData.expenses : [],
          friends: Array.isArray(cloudData.friends) ? cloudData.friends : [],
          wallets: Array.isArray(cloudData.wallets) && cloudData.wallets.length > 0 ? cloudData.wallets : db.wallets,
          settlements: Array.isArray(cloudData.settlements) ? cloudData.settlements : [],
          recurringRules: Array.isArray(cloudData.recurringRules) ? cloudData.recurringRules : [],
          settings: {
            ...db.settings,
            ...(cloudData.settings || {}),
          },
          activeTrip: cloudData.activeTrip ?? db.activeTrip,
          tripHistory: Array.isArray(cloudData.tripHistory) ? cloudData.tripHistory : db.tripHistory,
          presetGroups: Array.isArray(cloudData.presetGroups) ? cloudData.presetGroups : db.presetGroups,
        };
        restoreDB(restoredDB);
        const count = restoredDB.expenses.length;
        setStatusMsg(`Restored ${count} records!`);
        showToast(`Restored ${count} expenses from Cloud`);
        setTimeout(() => setStatusMsg(null), 3500);
      } else {
        setStatusMsg('No cloud backup found');
        showToast('No cloud backup found');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Restore failed';
      setErrorMsg(msg);
      setStatusMsg(null);
    }
  };

  const formattedSyncTime = lastSyncTime
    ? lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 420,
          margin: '0 auto',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '18px 18px calc(20px + env(safe-area-inset-bottom, 0px)) 18px',
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".db,.sql,.txt,.json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />

        {/* Drag Handle */}
        <div className="sheet-drag-handle" />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="drawer-header-icon">
              <Database size={19} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: 'var(--fs-lg)',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--text)',
                  letterSpacing: '-0.02em',
                }}
              >
                Data & Storage
              </h3>
              <p className="drawer-header-sub" style={{ margin: '1px 0 0', fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>
                Local storage & cloud sync
              </p>
            </div>
          </div>

          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            title="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* Status Alert Banner */}
        {errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--debit-bg)',
              color: 'var(--debit)',
              fontSize: 'var(--fs-xs)',
              fontWeight: 500,
              marginBottom: 12,
            }}
          >
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <div style={{ wordBreak: 'break-word' }}>{errorMsg}</div>
          </div>
        )}

        {statusMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--credit-bg)',
              color: 'var(--credit)',
              fontSize: 'var(--fs-xs)',
              fontWeight: 500,
              marginBottom: 12,
            }}
          >
            <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
            <div>{statusMsg}</div>
          </div>
        )}

        {/* Section 1: Local Storage */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 'var(--fs-caption)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-3)',
              marginBottom: 8,
              paddingLeft: 2,
            }}
          >
            <HardDrive size={12} />
            <span>Local Storage</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: (db.settings?.enableDummyData ?? false) ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
              gap: 8,
            }}
          >
            <button
              type="button"
              className="data-action-card"
              onClick={handleExportClick}
            >
              <div className="data-action-icon-wrap">
                <Download size={20} strokeWidth={2.2} />
              </div>
              <span className="data-action-label">Export</span>
              <span className="data-action-sub">Save .db</span>
            </button>

            <button
              type="button"
              className="data-action-card"
              onClick={() => {
                if (fileRef.current) {
                  fileRef.current.value = '';
                  fileRef.current.click();
                }
              }}
            >
              <div className="data-action-icon-wrap">
                <Upload size={20} strokeWidth={2.2} />
              </div>
              <span className="data-action-label">Import</span>
              <span className="data-action-sub">Restore .db</span>
            </button>

            {(db.settings?.enableDummyData ?? false) && (
              <button
                type="button"
                className="data-action-card"
                onClick={() => {
                  onClose();
                  onOpenDummyModal?.();
                }}
              >
                <div className="data-action-icon-wrap">
                  <Sparkles size={20} strokeWidth={2.2} />
                </div>
                <span className="data-action-label">Dummy Data</span>
                <span className="data-action-sub">Sample records</span>
              </button>
            )}
          </div>
        </div>

        {/* Section 2: Cloud Sync */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 'var(--fs-caption)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-3)',
              marginBottom: 8,
              paddingLeft: 2,
            }}
          >
            <Cloud size={12} />
            <span>Cloud Sync</span>
          </div>

          {user ? (
            <div
              style={{
                background: 'var(--surface2)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* User Profile Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 'var(--radius-full)',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--accent)',
                        color: 'var(--accent-contrast)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 'var(--fs-xs)',
                        flexShrink: 0,
                      }}
                    >
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 650,
                        fontSize: 'var(--fs-sm)',
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.displayName || 'Google Account'}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--fs-caption)',
                        color: 'var(--text-3)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.email}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Sign out"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-2)',
                    fontSize: 'var(--fs-caption)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <LogOut size={12} />
                  <span>Sign out</span>
                </button>
              </div>

              {/* Cloud Sync Actions - Minimal & Clean */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleUploadCloud}
                  disabled={isSyncing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    height: 38,
                    padding: '0 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 650,
                    cursor: isSyncing ? 'not-allowed' : 'pointer',
                    opacity: isSyncing ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                    boxShadow: 'var(--shadow)',
                  }}
                >
                  {isSyncing ? (
                    <RefreshCw size={14} className="spin" />
                  ) : (
                    <UploadCloud size={15} strokeWidth={2.2} style={{ color: 'var(--text-2)' }} />
                  )}
                  <span>Backup</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowRestoreConfirm(true)}
                  disabled={isSyncing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    height: 38,
                    padding: '0 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 650,
                    cursor: isSyncing ? 'not-allowed' : 'pointer',
                    opacity: isSyncing ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                    boxShadow: 'var(--shadow)',
                  }}
                >
                  {isSyncing ? (
                    <RefreshCw size={14} className="spin" />
                  ) : (
                    <DownloadCloud size={15} strokeWidth={2.2} style={{ color: 'var(--text-2)' }} />
                  )}
                  <span>Restore</span>
                </button>
              </div>

              {/* Status Note */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 'var(--fs-caption)',
                  color: 'var(--text-3)',
                  paddingTop: 2,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ShieldCheck size={13} color="var(--credit)" />
                  <span>Cloud Active</span>
                </div>
                <div>{formattedSyncTime ? `Synced at ${formattedSyncTime}` : 'Ready to sync'}</div>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--surface2)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text)',
                    flexShrink: 0,
                  }}
                >
                  <Cloud size={20} strokeWidth={2} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 650, color: 'var(--text)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Cloud Backup
                  </div>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Sync across devices
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSyncing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  fontWeight: 650,
                  fontSize: 'var(--fs-xs)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: 'var(--shadow)',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
              >
                {isSyncing ? (
                  <RefreshCw size={13} className="spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                )}
                <span>Sign In</span>
              </button>
            </div>
          )}
        </div>

        {/* Section 3: Reset Local Data */}
        <div
          className="data-reset-row"
          onClick={() => setShowResetConfirm(true)}
          role="button"
          tabIndex={0}
        >
          <div className="data-reset-left">
            <div className="data-reset-icon-wrap">
              <Trash2 size={14} />
            </div>
            <div className="data-reset-title">Reset all local data</div>
          </div>
        </div>

        {/* Confirm Reset Dialog */}
        {showResetConfirm && (
          <ConfirmDialog
            title="Reset All Data?"
            message="This will delete all expenses, wallets, friends, and settlements on this device. This cannot be undone."
            confirmLabel="Reset Everything"
            danger={true}
            onConfirm={() => {
              resetDB();
              showToast('All local data cleared');
            }}
            onClose={() => setShowResetConfirm(false)}
          />
        )}

        {/* Confirm Restore from Cloud Dialog */}
        {showRestoreConfirm && (
          <ConfirmDialog
            title="Restore from Cloud?"
            message="This will update your local records with all data stored in your cloud backup."
            confirmLabel="Restore"
            danger={false}
            onConfirm={handleRestoreFromCloud}
            onClose={() => setShowRestoreConfirm(false)}
          />
        )}

        {/* Mobile Export Share / Save Modal */}
        {exportModalOpen && createPortal(
          <div className="sheet-backdrop" onClick={() => setExportModalOpen(false)}>
            <div className="sheet-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380, margin: '0 auto' }}>
              <div className="sheet-drag-handle" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h4 style={{ margin: 0, fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)' }}>
                  Export Backup File
                </h4>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => setExportModalOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="data-action-card"
                  onClick={handleSaveToStorage}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 'auto' }}
                >
                  <Download size={18} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 650, fontSize: 'var(--fs-sm)' }}>Download Backup</div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>Save .db to Downloads</div>
                  </div>
                </button>

                <button
                  type="button"
                  className="data-action-card"
                  onClick={handleShareFile}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 'auto' }}
                >
                  <UploadCloud size={18} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 650, fontSize: 'var(--fs-sm)' }}>Share Backup</div>
                    <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)' }}>Send via Apps or Drive</div>
                  </div>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>,
    document.body
  );
}
