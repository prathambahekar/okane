import React from 'react';
import { createTheme } from '@mui/material/styles';

export const ColorModeContext = React.createContext<{
  mode: 'light' | 'dark';
  toggleMode: () => void;
}>({ mode: 'light', toggleMode: () => {} });

export const useColorMode = () => React.useContext(ColorModeContext);

export function buildTheme(mode: 'light' | 'dark') {
  return createTheme({ palette: { mode } });
}
