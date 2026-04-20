import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "./hooks/useTheme.tsx";
import { setupPWA } from "./pwa";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

// Register service worker (no-op in Lovable preview / iframe)
setupPWA();
