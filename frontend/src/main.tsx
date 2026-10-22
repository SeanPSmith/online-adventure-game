import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { router } from "./router";
import { AuthProvider } from "./state/AuthContext";
import { AppearanceProvider } from "./features/appearance/AppearanceContext";
import { ModalProvider } from "./state/ModalContext";
import { GameSocketProvider } from "./state/GameSocketContext";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/accessibility.css";
import "./styles/quillairoBrand.css";
import "./styles/inkboundSystemPass660.css";
import "./styles/inkboundLegibilityPass661.css";
import "./styles/inkboundStoryParityPass662.css";
import "./styles/inkboundWaitingPass663.css";
import "./styles/inkboundGameplayPass667.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root.");
}

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <AppearanceProvider>
      <GameSocketProvider>
        <ModalProvider>
          <RouterProvider router={router} />
        </ModalProvider>
      </GameSocketProvider>
      </AppearanceProvider>
    </AuthProvider>
  </StrictMode>,
);
