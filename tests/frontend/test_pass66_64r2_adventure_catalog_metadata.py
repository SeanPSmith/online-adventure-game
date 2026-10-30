"""Guard the active reader's adventure-catalog metadata after retiring legacy skins."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ADVENTURE = (ROOT / 'frontend/src/pages/game/AdventurePage.tsx')


def test_reader_resolves_world_catalog_using_immutable_adventure_id():
    source = ADVENTURE.read_text(encoding='utf-8')
    assert source.count('const worldCatalogItem = catalog.find(') == 1
    assert 'item.adventure_id === (live.game?.adventure_id ?? matchingAdventure?.adventure_id)' in source
    assert 'worldCatalogItem?.title' in source
    assert 'worldCatalogItem?.tags' in source


def test_reader_preserves_story_art_and_document_identifiers():
    source = ADVENTURE.read_text(encoding='utf-8')
    assert 'genreInkIllustration(worldCatalogItem?.title' in source
    assert 'fantasyIllustration' in source
    assert 'worldCatalogItem?.metadata?.world_document_id' in source
    assert 'worldCatalogItem?.metadata?.brief_document_id' in source


def test_retired_theme_engine_stays_retired():
    source = ADVENTURE.read_text(encoding='utf-8')
    for forbidden in ('AppearanceProvider', 'useAppearance', 'resolveAppearance', 'themePacks', 'themeEditions', 'themeContract'):
        assert forbidden not in source
    assert 'useInkboundPaper' in source
