import { Navigate, createBrowserRouter } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { RouteSkeleton } from "./components/skeleton/RouteSkeleton";
import { PublicLayout } from "./layouts/PublicLayout";
import { GameLayout } from "./layouts/GameLayout";
import { AccountLayout } from "./layouts/AccountLayout";
import { RequireAuth } from "./components/auth/RequireAuth";
import { DevLabGate } from "./components/auth/DevLabGate";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RouteErrorPage } from "./pages/RouteErrorPage";

// PASS 49: Keep the application shells and authentication gate available at
// startup. Load individual pages only when the matching route is visited.
// React Router's native route.lazy handles navigation and deep-link imports;
// unlike React.lazy, these routes don't need a separate Suspense wrapper.
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    hydrateFallbackElement: <RouteSkeleton />,
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
          // Temporary compatibility links for existing previews. All experiments now
          // live behind the admin-gated /dev workshop; no old URL loads a lab.
          { path: "game/visual-playground", element: <Navigate to="/dev/visual-playground" replace /> },
          { path: "game/ink-lab", element: <Navigate to="/dev/ink-lab" replace /> },
          { path: "game/inkspace-story", element: <Navigate to="/dev/inkspace-story" replace /> },
          { path: "game/inkspace-reader", element: <Navigate to="/dev/inkspace-reader" replace /> },
          { path: "game/tabletop-kit", element: <Navigate to="/dev/tabletop-kit" replace /> },
          { path: "game/space-lab", element: <Navigate to="/dev/space-lab" replace /> },
          {
            // No unprotected production-visible lab routes. The gate requires
            // authenticated administrator permission before rendering any preview.
            element: <DevLabGate />,
            children: [
              { path: "dev", lazy: async () => ({ Component: (await import("./pages/game/DevWorkshopPage")).DevWorkshopPage }) },
              { path: "dev/visual-playground", lazy: async () => ({ Component: (await import("./pages/game/VisualBookPlaygroundPage")).VisualBookPlaygroundPage }) },
              { path: "dev/ink-lab", lazy: async () => ({ Component: (await import("./pages/game/VisualBookPlaygroundPage")).InkBookPlaygroundPage }) },
              { path: "dev/inkspace-story", lazy: async () => ({ Component: (await import("./pages/game/VisualBookPlaygroundPage")).InkspaceStoryPlaygroundPage }) },
              { path: "dev/inkspace-reader", lazy: async () => ({ Component: (await import("./pages/game/VisualBookPlaygroundPage")).InkspaceReaderPlaygroundPage }) },
              { path: "dev/tabletop-kit", lazy: async () => ({ Component: (await import("./pages/game/VisualBookPlaygroundPage")).TabletopInteractionPlaygroundPage }) },
              { path: "dev/inkbound", lazy: async () => ({ Component: (await import("./pages/game/InkboundFoundationPage")).InkboundFoundationPage }) },
              { path: "dev/space-lab", lazy: async () => ({ Component: (await import("./pages/game/VisualBookPlaygroundPage")).SpaceBookPlaygroundPage }) },
              { element: <GameLayout />, children: [
                { path: "dev/home-lab", lazy: async () => ({ Component: (await import("./pages/game/GameHomePage")).LivingBookHomeLabPage }) },
              ] },
            ],
          },
          {
            path: "game",
            element: <GameLayout />,
            children: [
              { index: true, lazy: async () => ({ Component: (await import("./pages/game/GameHomePage")).GameHomePage }) },
              { path: "home-lab", element: <Navigate to="/dev/home-lab" replace /> },
              { path: "adventure/:roomId", lazy: async () => ({ Component: (await import("./pages/game/AdventurePage")).AdventurePage }) },
              { path: "heroes", lazy: async () => ({ Component: (await import("./pages/heroes/HeroManagerPage")).HeroManagerPage }) },
              { path: "graveyard", lazy: async () => ({ Component: (await import("./pages/heroes/GraveyardPage")).GraveyardPage }) },
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
              { path: "account/author", lazy: async () => ({ Component: (await import("./pages/author/AuthorPage")).AuthorPage }) },
              { path: "admin", lazy: async () => ({ Component: (await import("./pages/admin/AdminPage")).AdminPage }) },
            ],
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
