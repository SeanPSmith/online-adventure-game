import { Navigate, createBrowserRouter } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { PublicLayout } from "./layouts/PublicLayout";
import { GameLayout } from "./layouts/GameLayout";
import { AccountLayout } from "./layouts/AccountLayout";
import { RequireAuth } from "./components/auth/RequireAuth";

import { PublicHomePage } from "./pages/public/PublicHomePage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { PrivacyPage } from "./pages/legal/PrivacyPage";
import { TermsPage } from "./pages/legal/TermsPage";
import { JoinInvitePage } from "./pages/public/JoinInvitePage";

import { GameHomePage } from "./pages/game/GameHomePage";
import { AdventurePage } from "./pages/game/AdventurePage";
import { HeroManagerPage } from "./pages/heroes/HeroManagerPage";
import { HeroCreatePage } from "./pages/heroes/HeroCreatePage";
import { HeroSheetPage } from "./pages/heroes/HeroSheetPage";
import { HistoryPage } from "./pages/game/HistoryPage";
import { RulebookPage } from "./pages/game/RulebookPage";
import { ArcadeLabPage } from "./pages/game/ArcadeLabPage";

import { AccountPage } from "./pages/account/AccountPage";
import { AuthorPage } from "./pages/author/AuthorPage";
import { AdminPage } from "./pages/admin/AdminPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RouteErrorPage } from "./pages/RouteErrorPage";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, element: <PublicHomePage /> },
          { path: "login", element: <LoginPage /> },
          { path: "register", element: <RegisterPage /> },
          { path: "forgot-password", element: <ForgotPasswordPage /> },
          { path: "privacy", element: <PrivacyPage /> },
          { path: "terms", element: <TermsPage /> },
          { path: "rulebook", element: <RulebookPage /> },
          { path: "join/:roomCode", element: <JoinInvitePage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: "game",
            element: <GameLayout />,
            children: [
              { index: true, element: <GameHomePage /> },
              { path: "adventure/:roomId", element: <AdventurePage /> },
              { path: "heroes", element: <HeroManagerPage /> },
              { path: "heroes/new", element: <HeroCreatePage /> },
              { path: "heroes/:heroId", element: <HeroSheetPage /> },
              { path: "history", element: <HistoryPage /> },
              { path: "rulebook", element: <RulebookPage /> },
              { path: "arcade", element: <ArcadeLabPage /> },
            ],
          },
          {
            element: <AccountLayout />,
            children: [
              { path: "account", element: <AccountPage /> },
              { path: "settings", element: <Navigate to="/account?tab=preferences" replace /> },
              { path: "author", element: <AuthorPage /> },
              { path: "admin", element: <AdminPage /> },
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
