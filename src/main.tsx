/* eslint-disable react-refresh/only-export-components */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';
import { ColorModeContext, buildTheme, getAccentColors, type AccentPreset } from './theme';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

function getInitialMode(): 'light' | 'dark' {
  const saved = localStorage.getItem('color-mode') as 'light' | 'dark' | null;
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialAccent(): AccentPreset {
  const saved = localStorage.getItem('accent-color') as AccentPreset | null;
  if (saved && ['blue', 'red', 'monochrome', 'emerald', 'violet', 'rose', 'amber', 'custom'].includes(saved)) {
    return saved;
  }
  return 'blue';
}

function getInitialCustomColor(): string {
  return localStorage.getItem('custom-accent-color') || '#6366f1';
}

function Root() {
  const [mode, setMode] = useState<'light' | 'dark'>(getInitialMode);
  const [accent, setAccentState] = useState<AccentPreset>(getInitialAccent);
  const [customColor, setCustomColorState] = useState<string>(getInitialCustomColor);

  useEffect(() => {
    document.documentElement.setAttribute('data-color-scheme', mode);
    localStorage.setItem('color-mode', mode);
  }, [mode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
    localStorage.setItem('accent-color', accent);

    const colors = getAccentColors(accent, mode, customColor);
    document.documentElement.style.setProperty('--accent', colors.main);
    document.documentElement.style.setProperty('--accent-soft', colors.soft);
    document.documentElement.style.setProperty('--accent-dark', colors.dark);
    document.documentElement.style.setProperty('--accent-contrast', colors.contrast || '#ffffff');
    document.documentElement.style.setProperty('--accent-gradient', colors.gradient);
    document.documentElement.style.setProperty('--accent-gradient-soft', colors.gradientSoft);
  }, [accent, mode, customColor]);

  const toggleMode = useCallback(() => {
    setMode(m => (m === 'light' ? 'dark' : 'light'));
  }, []);

  const setAccent = useCallback((newAccent: AccentPreset) => {
    setAccentState(newAccent);
  }, []);

  const setCustomColor = useCallback((hex: string) => {
    setCustomColorState(hex);
    localStorage.setItem('custom-accent-color', hex);
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
    <Root />
  </React.StrictMode>,
);
