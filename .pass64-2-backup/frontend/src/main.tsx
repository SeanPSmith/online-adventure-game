import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { router } from "./router";
import { AuthProvider } from "./state/AuthContext";
import { ModalProvider } from "./state/ModalContext";
import { GameSocketProvider } from "./state/GameSocketContext";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/accessibility.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root.");
}

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <GameSocketProvider>
        <ModalProvider>
          <RouterProvider router={router} />
        </ModalProvider>
      </GameSocketProvider>
    </AuthProvider>
  </StrictMode>,
);
