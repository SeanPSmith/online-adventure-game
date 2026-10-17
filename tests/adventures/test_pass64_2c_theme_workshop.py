"""Cosmetic theme integration guardrails; runtime pack validation has a Node test."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "frontend" / "src"

def content(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

def test_custom_themes_are_data_only_not_executable_css():
    contract = content("features/appearance/themePacks.ts")
    assert 'const HEX = /^#[0-9a-fA-F]{6}$/' in contract
    assert 'exactKeys(input' in contract
    assert 'contrastRatio(' in contract
    assert 'length > 16_384' in contract
    assert 'length >= 24' in contract
    assert 'themeCssVars' in contract
    assert 'script:' not in contract

def test_theme_editor_is_reachable_and_keeps_account_settings():
    account = content("pages/account/AccountPage.tsx")
    wardrobe = content("features/appearance/AppearanceWardrobe.tsx")
    assert '<AppearanceWardrobe' in account
    assert 'installTheme(' in wardrobe
    assert 'type="file"' in wardrobe
    assert 'saveJSON(' in wardrobe
    assert 'Reduce decorative motion' in wardrobe
    assert 'readerMode: "plain"' in wardrobe

def test_reader_override_cannot_disrupt_turn_state():
    story = content("pages/game/AdventurePage.tsx")
    assert 'data-world-skin={worldSkin.reader}' in story
    assert 'worldSkin.reader !== "plain"' in story
    assert 'data-installed-reader-theme=' in story
    assert 'useTurnTheater' in story
    assert 'StoryReveal' in story
    assert 'useGameSocket' in story

def test_storybook_navigation_uses_no_fake_page_overlay():
    layout = content("layouts/GameLayout.tsx")
    shell = content("styles/brighterWorldShell.css")
    assert '<BookPageTurn />' not in layout
    assert 'import { BookPageTurn }' not in layout
    assert 'brighterWorldShell.css' in layout
    assert '@keyframes p643-arrive' in shell
    assert 'prefers-reduced-motion:reduce' in shell
    assert '.is-adventure-mode' in shell  # Live Reader is excluded from navigation fades.


def test_workshop_uses_project_native_themed_selectors():
    wardrobe = content("features/appearance/AppearanceWardrobe.tsx")
    select = content("components/ui/TerminalSelect.tsx")
    assert 'import { TerminalSelect }' in wardrobe
    assert 'ariaLabel="Theme target"' in wardrobe
    assert 'ariaLabel="Theme material"' in wardrobe
    assert '<select' not in wardrobe
    assert 'options={MATERIALS.map(' in wardrobe
    assert 'setTarget(next)' in wardrobe and 'setMaterial(sample.material)' in wardrobe
    assert 'role="listbox"' in select and 'aria-expanded={open}' in select
