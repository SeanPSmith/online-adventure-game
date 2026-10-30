"""Pass 66.64 — the six Inkscape paper themes are the sole player theme selection.

Keep live reader, gameplay, six-theme persistence, and accessibility contracts real.
Retired appearance/edition/JSON-pack UIs must never be imported by production.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'frontend/src'


def read(relative):
    return (SRC / relative).read_text(encoding='utf-8')


def test_six_inkscape_papers_are_the_only_selectable_themes():
    source = read('features/appearance/inkboundPaper.ts')
    ids = re.findall(r'\{ id: "([a-z]+)", name:', source)
    assert ids == ['parchment', 'ivory', 'cream', 'navy', 'phosphor', 'midnight']
    preferences = read('features/appearance/InkboundPaperPreferences.tsx')
    assert 'INKBOUND_PAPERS.map' in preferences
    assert 'useInkboundPaper' in preferences
    assert 'aria-pressed' in preferences
    assert 'writeInkboundPaper' in source


def test_account_has_no_retired_wardrobe_or_custom_palette_workflows():
    account = read('pages/account/AccountPage.tsx')
    layout = read('layouts/GameLayout.tsx')
    assert '<InkboundPaperPreferences />' in account
    assert '#inkbound-paper' in account
    for retired in ('AppearanceWardrobe', '#wardrobe', 'Personal Editions', 'Palette Studio'):
        assert retired not in account
    assert 'APPEARANCE</NavLink>' in layout
    assert '#inkbound-paper' in layout
    assert 'themeCssVars' not in layout
    assert 'data-platform-skin' not in layout
    assert 'data-ink-paper={paper}' in layout


def test_old_theme_engines_and_global_overrides_are_removed():
    for relative in (
        'features/appearance/AppearanceWardrobe.tsx',
        'features/appearance/AppearanceContext.tsx',
        'features/appearance/themePacks.ts',
        'features/appearance/themeContract.ts',
        'features/appearance/themeEditions.ts',
        'features/appearance/themeEditions.css',
        'features/appearance/themePresentation.css',
        'features/appearance/themeWorkshop.css',
        'features/appearance/wardrobe.css',
        'styles/pass64Shell.css',
        'styles/brighterWorldShell.css',
        'pages/game/adventureWorldPass64.css',
    ):
        assert not (SRC / relative).exists(), relative
    for relative in ('main.tsx', 'layouts/GameLayout.tsx', 'pages/game/AdventurePage.tsx'):
        content = read(relative)
        for retired in ('AppearanceProvider', 'useAppearance', 'themePacks', 'themeEditions', 'resolveAppearance', 'themeContract'):
            assert retired not in content, (relative, retired)


def test_story_typeface_and_gameplay_are_not_regressed():
    reader = read('pages/game/AdventurePage.tsx')
    for live in ('useLiveAdventure(', 'useTurnTheater(', 'StoryReveal', 'storyPreferences.readingTypeface',
                 'storyPreferences.decorativeInitials', 'data-ink-paper={inkPaper}'):
        assert live in reader, live
    for retired in ('data-world-skin', 'data-reader-edition-family', 'data-installed-reader-theme'):
        assert retired not in reader
    # Player reading options remain separate from the abandoned custom skin system.
    assert 'writeStoryDisplayPreferences' in read('pages/account/SettingsPage.tsx')
    assert 'prefers-reduced-motion:reduce' in read('pages/game/adventureLiterary643.css')
