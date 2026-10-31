"""Pass 66.68: the Living Book / tabletop / admin-lab experiments are gone, the live game is not.

Structural checks only; they never exercise or alter gameplay, dice, HP/XP, the turn
state machine, sockets, narration or persistence.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "frontend/src"
GAME = SRC / "pages/game"

RETIRED_FILES = [
    # Living Book reader and floating tabletop instruments
    "pages/game/InkspaceLiveRoom.tsx", "pages/game/LiveTabletopInstruments.tsx",
    "pages/game/TabletopInstruments.tsx", "pages/game/InkspaceReaderLab.tsx",
    "pages/game/inkspaceReaderPagination.ts", "pages/game/inkMaskAssets.ts",
    # Admin /dev workshop and its experiment pages
    "pages/game/DevWorkshopPage.tsx", "pages/game/VisualBookPlaygroundPage.tsx",
    "pages/game/InkLabBook.tsx", "pages/game/InkspaceStoryPage.tsx",
    "pages/game/inkspaceStorySamples.ts", "pages/game/SpaceLab.tsx",
    "pages/game/InkboundFoundationPage.tsx", "pages/game/InkboundHeroFolio.tsx",
    "pages/game/InkboundJourneyGallery.tsx", "pages/game/InkboundOutcomePreview.tsx",
    "components/auth/DevLabGate.tsx", "features/cosmetics/environmentCatalog.ts",
    # Stylesheets owned exclusively by the retired experiments
    "pages/game/inkspaceLiveRoom.css", "pages/game/liveTabletopInstruments.css",
    "pages/game/tabletopInstruments.css", "pages/game/visualBookPlayground.css",
    "pages/game/inkspaceReaderLab.css", "pages/game/spaceLab.css",
    "pages/game/inkLabBook.css", "pages/game/inkspaceStory.css",
    "pages/game/inkboundJourney.css", "pages/game/inkboundFolio.css",
    "pages/game/inkboundEditorial.css", "pages/game/inkboundSketchbook.css",
]

# Unreferenced for reasons unrelated to this pass; tracked so a later pass decides deliberately.
KNOWN_UNREFERENCED = {"vite-env.d.ts", "features/onboarding/FirstRunGuide.tsx"}


def read(relative: str) -> str:
    return (SRC / relative).read_text(encoding="utf-8")


def test_retired_experiment_files_are_gone():
    present = [name for name in RETIRED_FILES if (SRC / name).exists()]
    assert not present, present


def test_adventure_page_has_no_living_book_or_classic_branch():
    page = read("pages/game/AdventurePage.tsx")
    for retired in ("InkspaceLiveRoom", "bookRequested", "bookReady", "changeBookView",
                    "OPEN LIVING BOOK", "USE STANDARD READER", 'set("reader", "book")', "bookNotes"):
        assert retired not in page, retired
    # Pass 66.73 removed the Classic fallback as well; see test_pass66_73_classic_reader_removal.py.
    assert "classicRequested" not in page and "USE CLASSIC READER" not in page


def test_live_gameplay_wiring_is_untouched():
    page = read("pages/game/AdventurePage.tsx")
    for contract in (
        "<InkboundLiveRoom", "<InkboundLobby", "useTurnTheater(", "<TurnTheater",
        "useSceneArtwork(", "live.submitChoice(selectedChoiceId)", "live.sendChat(message)",
        "resolutionHost={inkboundReady ? resolutionHost : null}",
        "notes={fieldNotes}", "onNotesChange={setFieldNotes}",
        "hero={partyHeroes.find((p) => p.character_id === characterId) ?? hero ?? null}",
    ):
        assert contract in page, contract


def test_router_has_no_lab_gate_and_old_bookmarks_land_on_the_game():
    router = read("router.tsx")
    assert "DevLabGate" not in router and "DevWorkshopPage" not in router
    assert "VisualBookPlaygroundPage" not in router and "InkboundFoundationPage" not in router
    assert 'path: "dev/*", element: <Navigate to="/game" replace />' in router
    for legacy in ("visual-playground", "ink-lab", "inkspace-story", "inkspace-reader", "tabletop-kit", "space-lab"):
        assert f'path: "game/{legacy}", element: <Navigate to="/game" replace />' in router, legacy
    # Real player routes are intact.
    for route in ('path: "adventure/:roomId"', 'path: "heroes"', 'path: "adventures"',
                  'path: "history"', 'path: "account"', 'path: "admin"', 'path: "author"'):
        assert route in router, route


_IMPORT = re.compile(
    r"""(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]"""
    r"""|import\(\s*['"]([^'"]+)['"]\s*\)|@import\s+(?:url\()?['"]([^'"]+)['"]""")
_ASSET = re.compile(r"""['"`]((?:\.{1,2}/)[^'"`\s]+\.(?:png|webp|jpe?g|svg|gif|mp3|ogg|wav|woff2?))['"`]""")


def _resolve(base: Path, spec: str, files: set[Path]):
    if not spec.startswith("."):
        return None
    candidate = (base.parent / spec).resolve()
    for option in [candidate, *[Path(str(candidate) + e) for e in (".tsx", ".ts", ".jsx", ".js", ".css", ".json")],
                   *[candidate / ("index" + e) for e in (".tsx", ".ts", ".js")]]:
        if option in files:
            return option
    return None


def test_every_frontend_source_file_is_reachable_from_the_entry_point():
    # Hidden OS/editor files (.DS_Store and similar) are not source.
    files = {p.resolve() for p in SRC.rglob("*")
             if p.is_file() and not any(part.startswith(".") for part in p.relative_to(SRC).parts)}
    seen: set[Path] = set()
    stack = [(SRC / "main.tsx").resolve()]
    while stack:
        node = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        if node.suffix not in {".tsx", ".ts", ".js", ".jsx", ".css"}:
            continue
        text = node.read_text(encoding="utf-8", errors="ignore")
        for match in _IMPORT.finditer(text):
            target = _resolve(node, next(g for g in match.groups() if g), files)
            if target:
                stack.append(target)
        for match in _ASSET.finditer(text):
            target = _resolve(node, match.group(1), files)
            if target:
                stack.append(target)
    orphaned = sorted(str(p.relative_to(SRC.resolve())) for p in files - seen
                      if str(p.relative_to(SRC.resolve())) not in KNOWN_UNREFERENCED)
    assert not orphaned, f"Unreferenced frontend source (remove or wire it up): {orphaned}"
