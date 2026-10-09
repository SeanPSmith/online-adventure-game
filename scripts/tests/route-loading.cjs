"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "../..");
const routerFile = path.join(root, "frontend/src/router.tsx");
const router = fs.readFileSync(routerFile, "utf8");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("every dynamic route import has a real page and named component export", () => {
  const matches = [...router.matchAll(/\(await import\("(\.\/pages\/[^\"]+)"\)\)\.([A-Za-z]\w*)/g)];
  assert.ok(matches.length >= 20, `expected 20 or more lazy pages; found ${matches.length}`);
  for (const [, modulePath, component] of matches) {
    const resolved = path.resolve(path.dirname(routerFile), `${modulePath}.tsx`);
    assert.ok(fs.existsSync(resolved), `missing lazy route module: ${modulePath}`);
    const source = fs.readFileSync(resolved, "utf8");
    assert.match(source, new RegExp(`export (?:function|const|class) ${component}\\b`), `${modulePath} should export ${component}`);
  }
});

test("heavy and account-specific screens are split from the app entry chunk", () => {
  for (const page of ["AdventurePage", "HeroManagerPage", "HeroCreatePage", "HeroSheetPage", "MyAdventuresPage", "ArcadeLabPage", "AuthorPage", "AdminPage", "AccountPage"]) {
    assert.match(router, new RegExp(`\\(await import\\("\\./pages/[^\"]+/${page}"\\)\\)\\.${page}`));
    assert.doesNotMatch(router, new RegExp(`^import \\{\\s*${page}\\s*\\}`, "m"), `${page} must not load eagerly`);
  }
});

test("public deep links, protected routes and legacy settings redirect remain", () => {
  for (const route of ["login", "register", "forgot-password", "join/:roomCode", "privacy", "terms", "rulebook", "adventure/:roomId", "heroes/:heroId", "arcade", "adventures", "history", "admin", "author"]) {
    assert.ok(router.includes(`path: "${route}"`), `missing route ${route}`);
  }
  assert.match(router, /element: <RequireAuth \/>/);
  assert.match(router, /<Navigate to="\/account\?tab=preferences" replace \/>/);
  assert.match(router, /errorElement: <RouteErrorPage \/>/);
});

test("slow navigation and failed chunk imports have accessible recovery", () => {
  const shell = read("frontend/src/layouts/RootLayout.tsx");
  const error = read("frontend/src/pages/RouteErrorPage.tsx");
  const css = read("frontend/src/styles/components.css");
  assert.match(shell, /useNavigation/);
  assert.match(shell, /role="status"/);
  assert.match(error, /CHUNK_LOAD_FAILURE/);
  assert.match(error, /window\.location\.reload\(\)/);
  assert.match(error, /RETURN TO KNOWN REALITY/);
  assert.match(css, /\.route-transition-status/);
});
