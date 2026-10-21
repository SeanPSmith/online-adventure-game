
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
def read(path): return (ROOT/path).read_text(encoding="utf-8")
def test_six_editions_and_saved_legacy_white_id():
    themes = read("frontend/src/features/appearance/inkboundPaper.ts")
    for edition in ("parchment", "ivory", "cream", "navy", "phosphor", "midnight"):
        assert f'id: "{edition}"' in themes
    assert 'if (value === "chalk") return "ivory";' in themes

def test_system_scopes_cover_account_game_author_and_global_portals():
    account=read("frontend/src/layouts/AccountLayout.tsx")
    game=read("frontend/src/layouts/GameLayout.tsx")
    modal=read("frontend/src/state/ModalContext.tsx")
    author=read("app/web/author/author.js")
    assert 'data-ink-paper={paper}' in account and 'inkbound-system-shell' in account
    assert 'data-ink-paper={paper}' in game and 'inkbound-system-shell' in game
    assert 'data-ink-paper={paper}' in modal and 'inkbound-global-dialog' in modal
    assert 'applyAuthorInkboundPaper(auth.user.user_id)' in author
    assert 'tot:inkbound:paper:' in author
    assert 'to="/account/author"' in account and 'to="/account/author"' in game

def test_actual_editor_remains_functional():
    author=read("app/web/author/author.js")
    for contract in ('installTerminalSelects()', 'refreshLibrary()', 'saveDraft(', 'publishVersion(', 'submitAuthorAiHelper('):
        assert contract in author
    hub=read("frontend/src/pages/author/AuthorPage.tsx")
    assert 'getAuthorIdentity' in hub and 'listAuthorDocuments' in hub
    assert 'to="/author-console"' in hub

def test_inkbound_reuses_voice_synchronized_word_reveal():
    room=read("frontend/src/pages/game/InkboundLiveRoom.tsx")
    adventure=read("frontend/src/pages/game/AdventurePage.tsx")
    for field in ('<StoryReveal','followNarration={followNarration}', 'narrationCue={narrationCue}', 'enabled={wordRevealEnabled}'):
        assert field in room
    for field in ('wordRevealEnabled={storyPreferences.wordReveal}', 'followNarration={audioPreferences.narrationEnabled', 'narrationCue={theater.chapterReleased'):
        assert field in adventure
    assert 'live.startAdventure' in adventure

def test_modal_sizes_and_component_css_imports():
    css=read("frontend/src/styles/inkboundSystemPass660.css")
    assert 'width:min(960px,calc(100vw - 32px))' in css
    assert 'calc(100dvh - 32px)' in css
    assert 'inkboundSystemPass660.css' in read("frontend/src/main.tsx")
    # Guard package completeness for stylesheet imports in modified React files.
    for relative in ("frontend/src/main.tsx", "frontend/src/pages/game/AdventurePage.tsx", "frontend/src/pages/game/InkboundLiveRoom.tsx"):
        path=ROOT/relative
        import re
        for name in re.findall(r'import ["\'](\.[^"\']+\.css)["\']',path.read_text()):
            assert (path.parent/name).exists(),f"missing {name} imported by {relative}"

def test_all_six_reading_palettes_have_high_contrast():
    # Relative luminance per WCAG 2.x; premium manuscript requires strong legibility.
    palettes = {
      "ivory": ("#f7f3e9", "#28251f", "#514b40"),
      "cream": ("#eee7d9", "#30291e", "#504433"),
      "parchment": ("#d9c6a4", "#33271a", "#413021"),
      "navy": ("#0b1725", "#f4e9d6", "#ded2bd"),
      "phosphor": ("#06140c", "#c6f9b1", "#a9dfa1"),
      "midnight": ("#141516", "#f5f6f3", "#d6d9d6"),
    }
    sheet = read("frontend/src/styles/inkboundSystemPass660.css")
    def luminance(hex_color):
        rgb = [int(hex_color[i:i+2], 16) / 255 for i in (1, 3, 5)]
        linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
        return sum(a*b for a, b in zip(linear, (.2126, .7152, .0722)))
    for key, (paper, title, body) in palettes.items():
        assert f'[data-ink-paper="{key}"]' in sheet
        for ink in (title, body):
            a, b = sorted((luminance(paper), luminance(ink)))
            assert (b + .05) / (a + .05) >= 7, f"{key} weak text contrast"
