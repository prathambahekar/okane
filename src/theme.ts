import React from 'react';
import { createTheme } from '@mui/material/styles';

export type AccentPreset = 'monochrome';

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
    id: 'monochrome',
    name: 'Monochrome',
    swatchLight: '#18181b',
    swatchDark: '#f4f4f5',
    light: { main: '#18181b', soft: 'rgba(24, 24, 27, 0.08)', dark: '#09090b', contrast: '#ffffff' },
    dark: { main: '#f4f4f5', soft: 'rgba(244, 244, 245, 0.14)', dark: '#d4d4d8', contrast: '#09090b' },
  },
];



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

export function getAccentColors(accent?: AccentPreset | string, mode: 'light' | 'dark' = 'dark', customHex?: string) {
  void accent;
  void customHex;
  const preset = ACCENT_PRESETS[0];
  const pColors = preset[mode];
  const main = pColors.main;
  const dark = pColors.dark;
  const light = adjustHexBrightness(pColors.main, mode === 'dark' ? +20 : +14);
  const soft = pColors.soft;
  const contrast = pColors.contrast || getContrastTextColor(pColors.main);

  const gradient = `linear-gradient(135deg, ${light} 0%, ${main} 50%, ${dark} 100%)`;
  const gradientSoft = mode === 'dark'
    ? `linear-gradient(135deg, ${soft} 0%, rgba(24, 24, 27, 0) 100%)`
    : `linear-gradient(135deg, ${soft} 0%, rgba(255, 255, 255, 0) 100%)`;
  const surfaceGradient = mode === 'dark'
    ? `linear-gradient(135deg, ${soft} 0%, rgba(24, 24, 27, 0.85) 100%)`
    : `linear-gradient(135deg, ${soft} 0%, rgba(255, 255, 255, 0.92) 100%)`;
  const borderSoft = hexToRgba(main, mode === 'dark' ? 0.14 : 0.10);

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
  accent: 'monochrome',
  setAccent: () => {},
  customColor: '#6366f1',
  setCustomColor: () => {},
});

export const useColorMode = () => React.useContext(ColorModeContext);

export function buildTheme(mode: 'light' | 'dark', accent: AccentPreset = 'monochrome', customHex?: string) {
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
      background: mode === 'dark' ? {
        default: '#0a0a0c', // Deep OLED neutral #0a0a0c
        paper: '#141416',   // Card Surface #141416
      } : {
        default: '#f8f9fa',
        paper: '#ffffff',
      },
      text: mode === 'dark' ? {
        primary: '#ffffff',   // text-white
        secondary: '#a1a1aa', // text-neutral-400
      } : {
        primary: '#171717',
        secondary: '#52525b',
      },
      divider: mode === 'dark' ? 'rgba(38, 38, 38, 0.8)' : '#e5e7eb',
    },
    typography: {
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
    shape: {
      borderRadius: 20,
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            borderBottom: 'none',
            border: 'none',
            ...(mode === 'dark' && {
              backgroundColor: '#0a0a0c',
            }),
          },
        },
      },
      MuiBottomNavigation: {
        styleOverrides: {
          root: {
            borderTop: 'none',
            border: 'none',
            boxShadow: 'none',
            ...(mode === 'dark' && {
              backgroundColor: '#0a0a0c',
            }),
          },
        },
      },
      MuiBottomNavigationAction: {
        defaultProps: {
          disableRipple: true,
        },
        styleOverrides: {
          root: {
            backgroundColor: 'transparent',
            WebkitTapHighlightColor: 'transparent',
            '&:hover': {
              backgroundColor: 'transparent',
            },
            '&:active': {
              backgroundColor: 'transparent',
            },
            '&.Mui-selected': {
              backgroundColor: 'transparent',
            },
            '&.Mui-focusVisible': {
              backgroundColor: 'transparent',
              outline: 'none',
            },
            '& .MuiTouchRipple-root': {
              display: 'none',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            ...(mode === 'dark' && {
              backgroundColor: '#141416',
              borderColor: 'rgba(38, 38, 38, 0.8)',
            }),
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 28,
            ...(mode === 'dark' && {
              backgroundColor: '#121212',
              border: '1px solid rgba(38, 38, 38, 0.8)',
              boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.8)',
            }),
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            border: 'none',
            ...(mode === 'dark' && {
              backgroundColor: '#121212',
              borderTop: '1px solid rgba(38, 38, 38, 0.8)',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.8)',
            }),
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 9999,
            textTransform: 'none',
          },
          containedPrimary: {
            ...(mode === 'dark' ? {
              background: '#ffffff',
              color: '#000000',
              fontWeight: 700,
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
              borderRadius: 9999,
              '&:hover': {
                background: '#f0f0f2',
                transform: 'translateY(-1px)',
              },
            } : {
              background: '#09090b',
              color: '#ffffff',
              fontWeight: 700,
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
              borderRadius: 9999,
              '&:hover': {
                background: '#27272a',
                transform: 'translateY(-1px)',
              },
            }),
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:active': {
              transform: 'translateY(0)',
            },
          },
          outlinedPrimary: {
            borderColor: safeMain,
            color: safeMain,
            borderRadius: 9999,
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
      MuiDivider: {
        styleOverrides: {
          root: {
            display: 'none',
            border: 'none',
          },
        },
      },
    },
  });
}

