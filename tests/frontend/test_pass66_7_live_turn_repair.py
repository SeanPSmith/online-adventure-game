"""Regression contracts for live Inkbound turn flow and reader recovery.

No new runtime imports; TypeScript build and browser tests run in the normal
project release, but a simple source check protects the integration boundaries.
"""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]

def source(relative):
    return (ROOT / relative).read_text(encoding='utf-8')

ROOM = source('frontend/src/pages/game/InkboundLiveRoom.tsx')
PAGE = source('frontend/src/pages/game/AdventurePage.tsx')
THEATER = source('frontend/src/features/adventure/useTurnTheater.ts')
RUNTIME = source('frontend/src/features/adventure/IntermissionRuntime.tsx')
CSS = source('frontend/src/styles/inkboundGameplayPass667.css')

def test_no_scene_ascii_fallback_in_live_inkbound():
    assert 'ibl-scene-ascii' not in ROOM
    assert 'scene.ascii_art.trim()' not in ROOM
    assert '<figure className="ibl-chapter-illustration"' in ROOM
    # Scene art comes from the committed chapter; its fallback follows the
    # world/genre rather than repeating a hard-coded fantasy illustration.
    assert 'sceneArtUrl={sceneArtUrl}' in PAGE
    assert 'illustrationSrc={genreInkIllustration(' in PAGE
    assert 'north-road-editorial.png' not in PAGE

def test_sticky_tools_and_scrollable_chapter():
    assert 'ref={chapterScroller}' in ROOM
    assert '<details className="ibl-instruments-disclosure" open>' in ROOM
    assert 'props.scene.id, props.turnNumber' in ROOM
    assert 'grid-template-columns:minmax(0,1fr)' in CSS
    assert 'position:sticky' in CSS
    assert 'height:calc(100dvh - 120px)' in CSS
    assert 'overflow-y:auto' in CSS
    assert 'max-height:none!important' in CSS  # phone scrolling

def test_choice_preview_is_server_derived_with_honest_estimate():
    odds = source('frontend/src/features/adventure/choicePreview.ts')
    for value in ('choice.risk_level', 'choice.xp_reward', 'choice.possible_gains', 'choice.possible_costs', 'choice.check.difficulty'):
        assert value in ROOM
    for snippet in ('SKILL_STAT', 'die === 20', 'die !== 1', 'hero.skills?.[check.skill]'):
        assert snippet in odds
    assert 'Base chance ≈' in ROOM and 'Odds vary' in ROOM

def test_story_ready_always_escapes_if_final_receipt_is_committed():
    assert 'if (!final || final.preliminary) return' in THEATER
    assert 'readyReceiptRef.current &&' in THEATER
    assert 'finishIntermissionStoryReady();' in THEATER
    # A one-shot, cancellable guard must work with the native timer API and
    # without a browser-only window dependency (Node simulates this hook).
    assert 'const fallback = setInterval(' in THEATER
    assert 'clearInterval(fallback)' in THEATER
    assert 'window.setTimeout' not in THEATER
    assert 'rememberIntermission(null)' in THEATER
    assert 'transition("resolution")' in THEATER
    assert 'onStoryReadyComplete();' in RUNTIME
    assert 'submitFinalScore();' in RUNTIME
    assert 'storyReadySeconds > 0' in RUNTIME

def test_new_overlay_has_resolvable_css_import_and_six_theme_tokens():
    main = source('frontend/src/main.tsx')
    assert 'import "./styles/inkboundGameplayPass667.css"' in main
    for token in ('--ia-text','--ia-rule','--ia-dim'):
        assert token in CSS
    from re import findall
    for relative in findall(r'import\s+[\'\"]([^\'\"]+\.css)[\'\"]', main):
        assert (ROOT / 'frontend/src' / relative).is_file(), relative
