import React from 'react';
import { createTheme } from '@mui/material/styles';

export type AccentPreset = 'blue' | 'red' | 'monochrome' | 'emerald' | 'indigo' | 'rose' | 'teal' | 'sunset' | 'custom';

export interface AccentDefinition {
  id: AccentPreset;
  name: string;
  swatchLight: string;
  swatchDark: string;
  light: { main: string; soft: string; dark: string; contrast: string };
  dark: { main: string; soft: string; dark: string; contrast: string };
}

export const ACCENT_PRESETS: AccentDefinition[] = [
  {
    id: 'blue',
    name: 'Classic Blue',
    swatchLight: '#1976d2',
    swatchDark: '#42a5f5',
    light: { main: '#1976d2', soft: 'rgba(25, 118, 210, 0.12)', dark: '#1565c0', contrast: '#ffffff' },
    dark: { main: '#42a5f5', soft: 'rgba(66, 165, 245, 0.16)', dark: '#1976d2', contrast: '#ffffff' },
  },
  {
    id: 'red',
    name: 'Crimson Red',
    swatchLight: '#dc2626',
    swatchDark: '#ef4444',
    light: { main: '#dc2626', soft: 'rgba(220, 38, 38, 0.12)', dark: '#b91c1c', contrast: '#ffffff' },
    dark: { main: '#ef4444', soft: 'rgba(239, 68, 68, 0.18)', dark: '#dc2626', contrast: '#ffffff' },
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    swatchLight: '#111111',
    swatchDark: '#ffffff',
    light: { main: '#111111', soft: 'rgba(17, 17, 17, 0.10)', dark: '#000000', contrast: '#ffffff' },
    dark: { main: '#ffffff', soft: 'rgba(255, 255, 255, 0.16)', dark: '#e0e0e0', contrast: '#000000' },
  },
  {
    id: 'emerald',
    name: 'Emerald Green',
    swatchLight: '#059669',
    swatchDark: '#34d399',
    light: { main: '#059669', soft: 'rgba(5, 150, 105, 0.12)', dark: '#047857', contrast: '#ffffff' },
    dark: { main: '#34d399', soft: 'rgba(52, 211, 153, 0.18)', dark: '#059669', contrast: '#ffffff' },
  },
  {
    id: 'indigo',
    name: 'Midnight Indigo',
    swatchLight: '#4f46e5',
    swatchDark: '#818cf8',
    light: { main: '#4f46e5', soft: 'rgba(79, 70, 229, 0.12)', dark: '#4338ca', contrast: '#ffffff' },
    dark: { main: '#818cf8', soft: 'rgba(129, 140, 248, 0.18)', dark: '#4f46e5', contrast: '#ffffff' },
  },
  {
    id: 'teal',
    name: 'Ocean Teal',
    swatchLight: '#0d9488',
    swatchDark: '#2dd4bf',
    light: { main: '#0d9488', soft: 'rgba(13, 148, 136, 0.12)', dark: '#0f766e', contrast: '#ffffff' },
    dark: { main: '#2dd4bf', soft: 'rgba(45, 212, 191, 0.18)', dark: '#0d9488', contrast: '#ffffff' },
  },
  {
    id: 'rose',
    name: 'Rose Pink',
    swatchLight: '#e11d48',
    swatchDark: '#fb7185',
    light: { main: '#e11d48', soft: 'rgba(225, 29, 72, 0.12)', dark: '#be123c', contrast: '#ffffff' },
    dark: { main: '#fb7185', soft: 'rgba(251, 113, 133, 0.18)', dark: '#e11d48', contrast: '#ffffff' },
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    swatchLight: '#ea580c',
    swatchDark: '#fb923c',
    light: { main: '#ea580c', soft: 'rgba(234, 88, 12, 0.12)', dark: '#c2410c', contrast: '#ffffff' },
    dark: { main: '#fb923c', soft: 'rgba(251, 146, 60, 0.18)', dark: '#ea580c', contrast: '#ffffff' },
  },
];

function isValidHex(hex?: string): boolean {
  if (!hex) return false;
  return /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(hex.trim());
}

function hexToRgba(hex: string, alpha: number): string {
  let clean = hex.trim().replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return `rgba(99, 102, 241, ${alpha})`;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function adjustHexBrightness(hex: string, percent: number): string {
  let clean = hex.trim().replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00FF) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000FF) + Math.round(255 * (percent / 100));
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function getContrastTextColor(hex: string): string {
  let clean = hex.trim().replace('#', '');
  if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
  if (clean.length !== 6) return '#ffffff';
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 180 ? '#111111' : '#ffffff';
}

export function getAccentColors(accent: AccentPreset, mode: 'light' | 'dark', customHex?: string) {
  let main: string;
  let dark: string;
  let light: string;
  let soft: string;
  let contrast: string;

  if (accent === 'custom') {
    const fallback = mode === 'dark' ? '#818cf8' : '#6366f1';
    let hex = customHex ? customHex.trim() : '';
    if (!hex.startsWith('#') && hex.length > 0) {
      hex = `#${hex}`;
    }
    if (!isValidHex(hex)) {
      hex = fallback;
    }
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    main = hex;
    dark = adjustHexBrightness(hex, mode === 'dark' ? -15 : -22);
    light = adjustHexBrightness(hex, mode === 'dark' ? +22 : +15);
    soft = hexToRgba(hex, mode === 'dark' ? 0.18 : 0.12);
    contrast = getContrastTextColor(hex);
  } else {
    const preset = ACCENT_PRESETS.find(p => p.id === accent) || ACCENT_PRESETS[0];
    const pColors = preset[mode];
    main = pColors.main;
    dark = pColors.dark;
    light = adjustHexBrightness(pColors.main, mode === 'dark' ? +20 : +14);
    soft = pColors.soft;
    contrast = pColors.contrast || getContrastTextColor(pColors.main);
  }

  const gradient = `linear-gradient(135deg, ${light} 0%, ${main} 50%, ${dark} 100%)`;
  const gradientSoft = mode === 'dark'
    ? `linear-gradient(135deg, ${soft} 0%, rgba(24, 24, 27, 0) 100%)`
    : `linear-gradient(135deg, ${soft} 0%, rgba(255, 255, 255, 0) 100%)`;
  const surfaceGradient = mode === 'dark'
    ? `linear-gradient(135deg, ${soft} 0%, rgba(24, 24, 27, 0.85) 100%)`
    : `linear-gradient(135deg, ${soft} 0%, rgba(255, 255, 255, 0.92) 100%)`;
  const borderSoft = hexToRgba(main, mode === 'dark' ? 0.32 : 0.22);

  return {
    main,
    dark,
    light,
    soft,
    contrast,
    gradient,
    gradientSoft,
    surfaceGradient,
    borderSoft,
  };
}

export const ColorModeContext = React.createContext<{
  mode: 'light' | 'dark';
  setMode: (mode: 'light' | 'dark') => void;
  toggleMode: () => void;
  accent: AccentPreset;
  setAccent: (accent: AccentPreset) => void;
  customColor: string;
  setCustomColor: (hex: string) => void;
}>({
  mode: 'light',
  setMode: () => {},
  toggleMode: () => {},
  accent: 'blue',
  setAccent: () => {},
  customColor: '#6366f1',
  setCustomColor: () => {},
});

export const useColorMode = () => React.useContext(ColorModeContext);

export function buildTheme(mode: 'light' | 'dark', accent: AccentPreset = 'blue', customHex?: string) {
  const colors = getAccentColors(accent, mode, customHex);
  const fallbackMain = mode === 'dark' ? '#42a5f5' : '#1976d2';
  const safeMain = (colors.main && colors.main.length > 0) ? colors.main : fallbackMain;
  const safeDark = (colors.dark && colors.dark.length > 0) ? colors.dark : fallbackMain;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: safeMain,
        dark: safeDark,
        contrastText: colors.contrast || '#ffffff',
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          containedPrimary: {
            background: colors.gradient,
            color: colors.contrast || '#ffffff',
            boxShadow: `0 3px 10px ${colors.soft}`,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              background: colors.gradient,
              filter: 'brightness(1.08)',
              boxShadow: `0 5px 16px ${colors.soft}`,
              transform: 'translateY(-1px)',
            },
            '&:active': {
              transform: 'translateY(0)',
            },
          },
          outlinedPrimary: {
            borderColor: safeMain,
            color: safeMain,
            '&:hover': {
              borderColor: safeDark,
              backgroundColor: colors.soft,
            },
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          primary: {
            background: colors.gradient,
            color: colors.contrast || '#ffffff',
            boxShadow: `0 4px 16px ${colors.soft}`,
            transition: 'all 0.2s ease',
            '&:hover': {
              background: colors.gradient,
              filter: 'brightness(1.08)',
              transform: 'scale(1.05)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          colorPrimary: {
            background: colors.gradient,
            color: colors.contrast || '#ffffff',
            fontWeight: 600,
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          barColorPrimary: {
            background: colors.gradient,
          },
        },
      },
    },
  });
}

