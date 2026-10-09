import { Navigate, createBrowserRouter } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { PublicLayout } from "./layouts/PublicLayout";
import { GameLayout } from "./layouts/GameLayout";
import { AccountLayout } from "./layouts/AccountLayout";
import { RequireAuth } from "./components/auth/RequireAuth";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RouteErrorPage } from "./pages/RouteErrorPage";

// PASS 49: Keep the application shells and authentication gate available at
// startup. Load individual pages only when the matching route is visited.
// React Router's native route.lazy handles navigation and deep-link imports;
// unlike React.lazy, these routes don't need a separate Suspense wrapper.
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { index: true, lazy: async () => ({ Component: (await import("./pages/public/PublicHomePage")).PublicHomePage }) },
          { path: "login", lazy: async () => ({ Component: (await import("./pages/auth/LoginPage")).LoginPage }) },
          { path: "register", lazy: async () => ({ Component: (await import("./pages/auth/RegisterPage")).RegisterPage }) },
          { path: "forgot-password", lazy: async () => ({ Component: (await import("./pages/auth/ForgotPasswordPage")).ForgotPasswordPage }) },
          { path: "privacy", lazy: async () => ({ Component: (await import("./pages/legal/PrivacyPage")).PrivacyPage }) },
          { path: "terms", lazy: async () => ({ Component: (await import("./pages/legal/TermsPage")).TermsPage }) },
          { path: "rulebook", lazy: async () => ({ Component: (await import("./pages/game/RulebookPage")).RulebookPage }) },
          { path: "join/:roomCode", lazy: async () => ({ Component: (await import("./pages/public/JoinInvitePage")).JoinInvitePage }) },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: "game",
            element: <GameLayout />,
            children: [
              { index: true, lazy: async () => ({ Component: (await import("./pages/game/GameHomePage")).GameHomePage }) },
              { path: "adventure/:roomId", lazy: async () => ({ Component: (await import("./pages/game/AdventurePage")).AdventurePage }) },
              { path: "heroes", lazy: async () => ({ Component: (await import("./pages/heroes/HeroManagerPage")).HeroManagerPage }) },
              { path: "heroes/new", lazy: async () => ({ Component: (await import("./pages/heroes/HeroCreatePage")).HeroCreatePage }) },
              { path: "heroes/:heroId", lazy: async () => ({ Component: (await import("./pages/heroes/HeroSheetPage")).HeroSheetPage }) },
              { path: "adventures", lazy: async () => ({ Component: (await import("./pages/game/MyAdventuresPage")).MyAdventuresPage }) },
              { path: "history", lazy: async () => ({ Component: (await import("./pages/game/HistoryPage")).HistoryPage }) },
              { path: "rulebook", lazy: async () => ({ Component: (await import("./pages/game/RulebookPage")).RulebookPage }) },
              { path: "arcade", lazy: async () => ({ Component: (await import("./pages/game/ArcadeLabPage")).ArcadeLabPage }) },
            ],
          },
          {
            element: <AccountLayout />,
            children: [
              { path: "account", lazy: async () => ({ Component: (await import("./pages/account/AccountPage")).AccountPage }) },
              { path: "settings", element: <Navigate to="/account?tab=preferences" replace /> },
              { path: "author", lazy: async () => ({ Component: (await import("./pages/author/AuthorPage")).AuthorPage }) },
              { path: "admin", lazy: async () => ({ Component: (await import("./pages/admin/AdminPage")).AdminPage }) },
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
