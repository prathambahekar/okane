import React from 'react';
import { createTheme } from '@mui/material/styles';

export type AccentPreset = 'blue' | 'red' | 'monochrome' | 'emerald' | 'violet' | 'rose' | 'amber' | 'custom';

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
    id: 'violet',
    name: 'Royal Violet',
    swatchLight: '#6366f1',
    swatchDark: '#818cf8',
    light: { main: '#6366f1', soft: 'rgba(99, 102, 241, 0.12)', dark: '#4f46e5', contrast: '#ffffff' },
    dark: { main: '#818cf8', soft: 'rgba(129, 140, 248, 0.18)', dark: '#6366f1', contrast: '#ffffff' },
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
    id: 'amber',
    name: 'Warm Amber',
    swatchLight: '#d97706',
    swatchDark: '#fbbf24',
    light: { main: '#d97706', soft: 'rgba(217, 119, 6, 0.12)', dark: '#b45309', contrast: '#ffffff' },
    dark: { main: '#fbbf24', soft: 'rgba(251, 191, 36, 0.18)', dark: '#d97706', contrast: '#ffffff' },
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

export function getAccentColors(accent: AccentPreset, mode: 'light' | 'dark', customHex?: string) {
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
    const soft = hexToRgba(hex, mode === 'dark' ? 0.18 : 0.12);
    return {
      main: hex,
      soft,
      dark: hex,
      contrast: '#ffffff',
      gradient: `linear-gradient(135deg, ${hex} 0%, ${hex} 100%)`,
      gradientSoft: `linear-gradient(135deg, ${soft} 0%, rgba(0, 0, 0, 0.02) 100%)`,
    };
  }
  const preset = ACCENT_PRESETS.find(p => p.id === accent) || ACCENT_PRESETS[0];
  const pColors = preset[mode];
  return {
    ...pColors,
    gradient: `linear-gradient(135deg, ${pColors.main} 0%, ${pColors.dark} 100%)`,
    gradientSoft: `linear-gradient(135deg, ${pColors.soft} 0%, rgba(0, 0, 0, 0.02) 100%)`,
  };
}

export const ColorModeContext = React.createContext<{
  mode: 'light' | 'dark';
  toggleMode: () => void;
  accent: AccentPreset;
  setAccent: (accent: AccentPreset) => void;
  customColor: string;
  setCustomColor: (hex: string) => void;
}>({
  mode: 'light',
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

