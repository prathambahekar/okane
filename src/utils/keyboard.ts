import { Capacitor } from '@capacitor/core';
import { Keyboard as CapKeyboard } from '@capacitor/keyboard';

/**
 * Returns whether the user has enabled auto-opening the soft keyboard on mobile.
 * Defaults to true.
 */
export function isAutoOpenKeyboardEnabled(): boolean {
  try {
    const pref = localStorage.getItem('auto_open_keyboard');
    return pref !== null ? pref === 'true' : true;
  } catch {
    return true;
  }
}

/**
 * Programmatically focuses an element and prompts the soft keyboard on mobile devices.
 */
export function showSoftKeyboard(
  target?: HTMLElement | null,
  options?: { placeCursorAtEnd?: boolean; scroll?: boolean; force?: boolean }
) {
  const isEnabled = isAutoOpenKeyboardEnabled();
  if (!isEnabled && !options?.force) {
    return;
  }

  if (target) {
    try {
      target.focus({ preventScroll: !options?.scroll });
    } catch {
      try {
        target.focus();
      } catch {
        // ignore
      }
    }

    if (
      options?.placeCursorAtEnd !== false &&
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    ) {
      const nonSelectableTypes = [
        'number',
        'date',
        'time',
        'datetime-local',
        'month',
        'week',
        'file',
        'color',
        'range',
        'checkbox',
        'radio',
        'button',
        'submit',
      ];
      const inputType = (target as HTMLInputElement).type?.toLowerCase();
      if (!nonSelectableTypes.includes(inputType)) {
        try {
          const len = (target.value || '').length;
          target.setSelectionRange(len, len);
        } catch {
          // ignore
        }
      }
    }

    if (options?.scroll !== false) {
      try {
        setTimeout(() => {
          if (document.activeElement === target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          }
        }, 80);
      } catch {
        // ignore
      }
    }
  }

  // If on native platform or plugin available, summon soft keyboard
  if (Capacitor.isNativePlatform() || Capacitor.isPluginAvailable('Keyboard')) {
    try {
      CapKeyboard.show().catch(() => {});
    } catch {
      // ignore
    }
  }
}

/**
 * Dismisses the soft keyboard on mobile devices.
 */
export function hideSoftKeyboard() {
  if (Capacitor.isNativePlatform() || Capacitor.isPluginAvailable('Keyboard')) {
    try {
      CapKeyboard.hide().catch(() => {});
    } catch {
      // ignore
    }
  }
}
