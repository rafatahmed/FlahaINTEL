import { createTheme } from "@mui/material/styles";

export const brandColors = {
  deepNavy: "#0B1D2A",
  leafGreen: "#2E7D32",
  freshGreen: "#7CB342",
  lightGreen: "#CDE6C0",
  slateGray: "#6B7280",
} as const;

export const flahaIntelTheme = createTheme({
  palette: {
    primary: {
      main: brandColors.leafGreen,
      dark: "#1B5E20",
      light: brandColors.freshGreen,
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: brandColors.deepNavy,
      contrastText: "#FFFFFF",
    },
    text: {
      primary: brandColors.deepNavy,
      secondary: brandColors.slateGray,
    },
    background: {
      default: "#F7F9F7",
      paper: "#FFFFFF",
    },
  },
  typography: {
    fontFamily: 'Poppins, Inter, "Segoe UI", Arial, sans-serif',
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: "none" },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundColor: brandColors.deepNavy, boxShadow: "none" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderColor: "rgba(11, 29, 42, 0.14)" },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: 3 },
      },
    },
  },
});
