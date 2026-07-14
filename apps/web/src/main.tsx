import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import App from "./App";
import { flahaIntelTheme } from "./theme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={flahaIntelTheme}>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
