import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useEffect, useRef, useState } from 'react';

export const BackPriority = {
  ROOT: 0,
  VIEW_HISTORY: 20,
  SUBVIEW: 40,
  DRAWER: 60,
  MODAL: 80,
  DIALOG: 100,
} as const;

export type BackPriority = (typeof BackPriority)[keyof typeof BackPriority];

export interface BackActionEntry {
  id: string;
  priority: number;
  action: () => boolean | void;
  name?: string;
  pushHistory?: boolean;
}

class BackHandlerManager {
  private stack: BackActionEntry[] = [];
  private isInitialized = false;
  private lastBackPressTime = 0;
  private exitToastCallback: ((msg: string) => void) | null = null;
  private isProcessingHistoryPop = false;

  constructor() {
    this.init();
  }

  public setExitToastCallback(cb: ((msg: string) => void) | null) {
    this.exitToastCallback = cb;
  }

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // 1. Capacitor Native Android Back Button Listener
    try {
      if (Capacitor.isPluginAvailable('App')) {
        CapacitorApp.addListener('backButton', async () => {
          this.triggerLightHaptic();
          const handled = this.triggerBack();
          if (!handled) {
            this.handleRootExit();
          }
        });
      }
    } catch (e) {
      console.warn('[BackHandler] Capacitor App listener error:', e);
    }

    // 2. Web & Mobile Browser / PWA History Popstate Listener
    window.addEventListener('popstate', () => {
      this.handlePopState();
    });

    // 3. Desktop Keyboard Escape Fallback
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const topModalOrDrawer = this.stack
          .filter(h => h.priority >= BackPriority.DRAWER)
          .sort((a, b) => b.priority - a.priority)[0];

        if (topModalOrDrawer) {
          // Check if not inside an active input with suggestions or custom behavior
          this.triggerBack();
        }
      }
    });

    // Ensure baseline history state exists on web
    if (!window.history.state || !window.history.state.okaneRoot) {
      window.history.replaceState({ okaneRoot: true }, '');
    }
  }

  private triggerLightHaptic() {
    try {
      if (Capacitor.isPluginAvailable('Haptics')) {
        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  public register(entry: BackActionEntry): () => void {
    // Remove if existing id already present
    this.unregister(entry.id);

    this.stack.push(entry);
    // Sort ascending by priority so that highest priority is at the end (LIFO)
    this.stack.sort((a, b) => a.priority - b.priority);

    // Push browser history state for browser back gesture if requested
    if (entry.pushHistory && typeof window !== 'undefined' && !this.isProcessingHistoryPop) {
      window.history.pushState({ okaneBackId: entry.id, priority: entry.priority }, '');
    }

    return () => this.unregister(entry.id);
  }

  public unregister(id: string) {
    const index = this.stack.findIndex(e => e.id === id);
    if (index !== -1) {
      const [removed] = this.stack.splice(index, 1);
      // If we pushed history for this entry and we're not inside popstate handling, clean up history
      if (removed.pushHistory && typeof window !== 'undefined' && !this.isProcessingHistoryPop) {
        if (window.history.state?.okaneBackId === id) {
          window.history.back();
        }
      }
    }
  }

  public triggerBack(): boolean {
    if (this.stack.length === 0) {
      return false;
    }

    // Get the highest priority item (last item in sorted stack)
    const topEntry = this.stack[this.stack.length - 1];
    if (!topEntry) return false;

    // Call the action
    const result = topEntry.action();

    // If the action returned false explicitly, it means it didn't consume the back press
    if (result === false) {
      return false;
    }

    return true;
  }

  private handlePopState() {
    this.isProcessingHistoryPop = true;
    try {
      const topModalOrDrawer = this.stack
        .filter(h => h.priority >= BackPriority.DRAWER)
        .sort((a, b) => b.priority - a.priority)[0];

      if (topModalOrDrawer) {
        // Modal was open, dismiss it
        this.triggerLightHaptic();
        topModalOrDrawer.action();
      } else {
        // Handle view navigation history
        const handled = this.triggerBack();
        if (!handled) {
          this.handleRootExit();
        }
      }
    } finally {
      this.isProcessingHistoryPop = false;
      // Re-ensure root state
      if (!window.history.state || !window.history.state.okaneRoot) {
        window.history.replaceState({ okaneRoot: true }, '');
      }
    }
  }

  private handleRootExit() {
    const now = Date.now();
    const timeDiff = now - this.lastBackPressTime;

    if (timeDiff < 2000) {
      // Exit app if on native Capacitor
      try {
        if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('App')) {
          CapacitorApp.exitApp();
        }
      } catch (e) {
        console.warn('[BackHandler] Exit app error:', e);
      }
    } else {
      this.lastBackPressTime = now;
      if (this.exitToastCallback) {
        this.exitToastCallback('Press back again to exit');
      }
    }
  }
}

export const backHandler = new BackHandlerManager();

/**
 * Hook to register a back button handler when a modal, drawer, or sheet is open.
 */
export function useBackButtonModal(
  isOpen: boolean,
  onClose: () => void,
  options?: {
    priority?: BackPriority | number;
    name?: string;
    pushHistory?: boolean;
    id?: string;
  }
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const [id] = useState(() => options?.id || `modal-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    if (!isOpen) return;

    const unregister = backHandler.register({
      id,
      priority: options?.priority ?? BackPriority.MODAL,
      name: options?.name,
      pushHistory: options?.pushHistory ?? false,
      action: () => {
        onCloseRef.current();
        return true;
      },
    });

    return () => {
      unregister();
    };
  }, [isOpen, options?.priority, options?.name, options?.pushHistory, id]);
}
