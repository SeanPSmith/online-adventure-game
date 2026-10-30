"""Pass 65.8: real Inkbound lobby and restored in-adventure commands.

Production control paths continue through AdventurePage; no client-side
story generation, room mutation or dice outcomes are introduced.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "frontend/src/pages/game/AdventurePage.tsx"
LOBBY = ROOT / "frontend/src/pages/game/InkboundLobby.tsx"
LIVE = ROOT / "frontend/src/pages/game/InkboundLiveRoom.tsx"
CSS = ROOT / "frontend/src/pages/game/inkboundPass658.css"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_real_pre_chapter_lobby_only_and_no_pregeneration():
    parent = text(PAGE)
    lobby = text(LOBBY)
    assert 'live.game && !live.game.started' in parent
    assert 'inkboundLobbyReady && live.game && <InkboundLobby' in parent
    assert 'onBeginAdventure={live.startAdventure}' in parent
    assert 'canBeginAdventure={canBeginAdventure}' in parent
    assert 'chapterPreparing={Boolean(live.game.chapter_preparing)}' in parent
    assert 'disabled={!props.connected || !props.canBeginAdventure || props.chapterPreparing}' in lobby
    assert 'The first chapter is being generated. No choices or dice rolls yet.' in lobby
    assert 'The opening chapter is generated only after you begin the adventure.' in parent
    for forbidden in ('useLiveAdventure(', 'useGameSocket(', 'Math.random(', 'fetch(', 'window.confirm(', '<select', 'submitChoice('):
        assert forbidden not in lobby, forbidden


def test_real_coop_lobby_preserves_authority_and_invitations():
    parent, lobby = text(PAGE), text(LOBBY)
    assert 'players={live.room?.players ?? []}' in parent
    assert 'readiness={readiness}' in parent
    assert 'playerId={live.playerId}' in parent
    assert 'isHost={Boolean(localRoomPlayer?.is_host)}' in parent
    assert 'playMode={live.room?.play_mode ?? "solo"}' in parent
    assert 'props.isHost ? <button' in lobby
    assert 'props.readiness.find(' in lobby
    assert 'RoomInviteButton' in lobby
    assert 'onToggleNarrator={toggleStoryTime}' in parent
    assert 'canStartSolo={Boolean(live.game.can_start_solo)}' in parent
    assert 'onStartSolo={confirmSoloStart}' in parent
    assert 'props.canStartSolo && props.isHost' in lobby
    assert 'next.set("reader", "classic")' in parent


def test_existing_adventure_functionality_not_hidden_by_reader():
    page, live = text(PAGE), text(LIVE)
    assert 'sessionUtilities={<>' in page
    assert '{props.sessionUtilities}' in live
    assert 'onClick={confirmSoloStart}' in page
    assert 'onClick={live.requestWrapUp}' in page
    assert 'writeAudioPreferences({ effectsEnabled:' in page
    assert 'NarratorVoicePicker value={audioPreferences.narrationVoice}' in page
    assert 'onClick={narrateChapter}' in page
    assert 'onClick={narrateChoices}' in page
    assert 'onClick={pauseNarration}' in page
    assert 'resumeNarration()' in page
    assert 'ShareMomentButton title=' in page
    assert 'RoomInviteButton roomCode={normalizedRoomCode}' in page
    assert 'onSelectChoice={selectChoice}' in page
    assert 'onLockChoice={lockChoice}' in page
    assert 'onSubmitIntermissionScore={live.submitIntermissionScore}' in page
    assert 'live.submitChoice(selectedChoiceId)' in page


def test_all_six_theme_lobby_and_device_breakpoints():
    css, lobby = text(CSS), text(LOBBY)
    for palette in ('parchment', 'ivory', 'cream', 'navy', 'phosphor', 'midnight'):
        assert f'.inkbound-lobby[data-ink-paper="{palette}"]' in css
    assert 'data-ink-paper={props.paper}' in lobby
    for surface in ('.ibl-lobby-art', '.ibl-lobby-synopsis', '.ibl-lobby-party-list',
                    '.ibl-lobby-begin', '.ibl-utility-actions', '.qte-modal',
                    '.hero-death-window', '.level-up-modal'):
        assert surface in css
    assert '@media(max-width:780px)' in css
    assert '@media(max-width:440px)' in css
    assert 'prefers-reduced-motion:reduce' in css
    assert 'mask-image:' not in css
    assert 'radial-gradient(' not in css
    assert 'position:absolute' not in css
    assert 'background:var(--ia-paper)' in css


def test_legacy_shell_is_hidden_without_clipping_the_document():
    page, css = text(PAGE), text(CSS)
    assert 'inkboundReady || inkboundLobbyReady' in page
    assert '!inkboundReady && !inkboundLobbyReady' in page
    assert '.game-site-shell:has(.inkbound-lobby)' in css
    assert 'height:auto!important' in css
    assert 'overflow:visible!important' in css
    assert 'min-height:100dvh' in css
