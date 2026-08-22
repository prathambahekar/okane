/* eslint-disable react-refresh/only-export-components */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { ColorModeContext, buildTheme, getAccentColors, type AccentPreset } from './theme';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

function getInitialMode(): 'light' | 'dark' {
  const saved = localStorage.getItem('color-mode') as 'light' | 'dark' | null;
  if (saved === 'light' || saved === 'dark') return saved;
  return 'dark';
}

function getInitialAccent(): AccentPreset {
  const saved = localStorage.getItem('accent-color') as AccentPreset | null;
  if (saved && ['blue', 'red', 'monochrome', 'emerald', 'indigo', 'rose', 'teal', 'sunset', 'custom'].includes(saved)) {
    return saved;
  }
  return 'blue';
}

function getInitialCustomColor(): string {
  return localStorage.getItem('custom-accent-color') || '#6366f1';
}

// Apply immediate theme attributes and variables before React renders to prevent any layout/border flicker
(function applyImmediateTheme() {
  try {
    const initMode = getInitialMode();
    const initAccent = getInitialAccent();
    const initCustom = getInitialCustomColor();

    document.documentElement.setAttribute('data-color-scheme', initMode);
    document.documentElement.setAttribute('data-accent', initAccent);

    const colors = getAccentColors(initAccent, initMode, initCustom);
    const style = document.documentElement.style;
    style.setProperty('--accent', colors.main);
    style.setProperty('--accent-soft', colors.soft);
    style.setProperty('--accent-dark', colors.dark);
    style.setProperty('--accent-light', colors.light);
    style.setProperty('--accent-contrast', colors.contrast || '#ffffff');
    style.setProperty('--accent-gradient', colors.gradient);
    style.setProperty('--accent-gradient-soft', colors.gradientSoft);
    style.setProperty('--accent-surface-gradient', colors.surfaceGradient);
    style.setProperty('--accent-border-soft', colors.borderSoft);
  } catch (e) {
    console.error('Error applying initial theme:', e);
  }
})();

function Root() {
  const [mode, setMode] = useState<'light' | 'dark'>(getInitialMode);
  const [accent, setAccentState] = useState<AccentPreset>(getInitialAccent);
  const [customColor, setCustomColorState] = useState<string>(getInitialCustomColor);

  // Remove preload class after layout and paint settle to enable smooth transitions without initial flicker
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const rafId = requestAnimationFrame(() => {
      timeoutId = setTimeout(() => {
        document.documentElement.classList.remove('app-preload');
      }, 50);
    });
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-color-scheme', mode);
    try {
      localStorage.setItem('color-mode', mode);
    } catch (e) {
      console.warn('Storage unavailable:', e);
    }
  }, [mode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
    try {
      localStorage.setItem('accent-color', accent);
    } catch (e) {
      console.warn('Storage unavailable:', e);
    }

    const colors = getAccentColors(accent, mode, customColor);
    const style = document.documentElement.style;
    style.setProperty('--accent', colors.main);
    style.setProperty('--accent-soft', colors.soft);
    style.setProperty('--accent-dark', colors.dark);
    style.setProperty('--accent-light', colors.light);
    style.setProperty('--accent-contrast', colors.contrast || '#ffffff');
    style.setProperty('--accent-gradient', colors.gradient);
    style.setProperty('--accent-gradient-soft', colors.gradientSoft);
    style.setProperty('--accent-surface-gradient', colors.surfaceGradient);
    style.setProperty('--accent-border-soft', colors.borderSoft);
  }, [accent, mode, customColor]);

  const toggleMode = useCallback(() => {
    setMode(m => (m === 'light' ? 'dark' : 'light'));
  }, []);

  const setAccent = useCallback((newAccent: AccentPreset) => {
    setAccentState(newAccent);
  }, []);

  const setCustomColor = useCallback((hex: string) => {
    setCustomColorState(hex);
    try {
      localStorage.setItem('custom-accent-color', hex);
    } catch (e) {
      console.warn('Storage unavailable:', e);
    }
  }, []);

  const theme = useMemo(() => buildTheme(mode, accent, customColor), [mode, accent, customColor]);

  return (
    <ColorModeContext.Provider value={{ mode, setMode, toggleMode, accent, setAccent, customColor, setCustomColor }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
);
