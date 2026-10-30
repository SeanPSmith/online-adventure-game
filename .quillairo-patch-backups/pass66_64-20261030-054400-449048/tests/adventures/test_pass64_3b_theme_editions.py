"""Pass 64.3B source-level guardrails for safe visual editions.
These guards intentionally avoid touching live room/dice logic.
"""
from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / 'frontend' / 'src'


def read(path: str) -> str:
    return (SRC / path).read_text(encoding='utf-8')


def test_curated_presentation_registry_and_backward_compatibility():
    editions = read('features/appearance/themeEditions.ts')
    contracts = read('features/appearance/themeContract.ts')
    packs = read('features/appearance/themePacks.ts')
    for family in ('brighter-world', 'leatherbound', 'garden-table', 'starward-folio', 'ink-and-ash', 'bloodmoon-manuscript'):
        assert family in editions
    assert "'tales-of-two-theme/v2'" in editions
    assert "const PALETTE" in editions
    assert "const CONFIG" in editions
    assert "themeEditionCssVars" in editions
    assert "normalizeEditionFamily(obj.editionFamily)" in contracts
    assert "normalizeEditionLighting(obj.editionLighting)" in contracts
    assert '"tales-of-two-theme/v1"' in packs
    assert 'parseThemePack' in packs


def test_lighting_and_reader_fallbacks_preserve_plain_mode():
    editions = read('features/appearance/themeEditions.ts')
    reader = read('pages/game/AdventurePage.tsx')
    context = read('features/appearance/AppearanceContext.tsx')
    assert "resolveEditionLighting" in editions
    assert "prefers-color-scheme: dark" in context
    assert 'worldSkin.reader === "plain" ? undefined' in reader
    assert 'data-installed-reader-theme=' in reader
    assert 'data-reader-edition-family=' in reader
    assert 'resolveAppearance(preferences,' in reader
    assert 'readerEditionFamily(worldSkin.reader)' in reader
    assert 'themeCssVars(readerTheme)' in reader
    assert 'themeEditionCssVars(themeEdition(' in reader


def test_workshop_uses_existing_custom_controls_and_no_purchase_claims():
    wardrobe = read('features/appearance/AppearanceWardrobe.tsx')
    assert 'EDITION_FAMILIES.map(' in wardrobe
    assert 'editionLighting' in wardrobe
    assert 'aria-pressed={selected}' in wardrobe
    assert '<TerminalSelect' in wardrobe
    assert '<select' not in wardrobe
    assert 'installTheme' in wardrobe and 'saveJSON' in wardrobe
    assert 'equipTheme(null, "library")' in wardrobe


def test_platform_and_reader_use_presentational_only_css():
    layout = read('layouts/GameLayout.tsx')
    css = read('features/appearance/themeEditions.css')
    assert 'data-edition-family=' in layout
    assert 'data-edition-mode=' in layout
    assert 'data-installed-library-theme=' in layout
    assert 'libraryTheme ? themeCssVars(libraryTheme) : themeEditionCssVars(edition)' in layout
    assert ':not([data-installed-library-theme="true"])' in css
    assert ':not([data-installed-reader-theme="true"])' in css
    assert '@media(prefers-reduced-motion:reduce)' in css
