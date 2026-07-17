import { createTheme } from '@mui/material/styles';

/**
 * MUI Theme Configuration
 *
 * === THEME MODE ===
 * Change `palette.mode` to switch between 'light' (default) and 'dark'.
 * Or use `colorSchemes` for automatic OS-preference-based switching:
 *
 *   const theme = createTheme({
 *     colorSchemes: { dark: true },
 *   });
 *
 * === COLOR CUSTOMIZATION ===
 * Override primary/secondary palettes by changing the `main` values below.
 * You can use any valid CSS color or import from '@mui/material/colors'.
 *
 * Available palette colors: primary, secondary, error, warning, info, success
 *
 * Example with MUI color imports:
 *   import { indigo, amber } from '@mui/material/colors';
 *   primary: { main: indigo[500] },
 *   secondary: { main: amber[500] },
 */
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#9c27b0',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

export default theme;
