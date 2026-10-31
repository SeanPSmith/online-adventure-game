"""Prevent missing endings, hidden progression, and duplicate dice systems."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]


def test_one_finale_renders_in_classic_and_inkbound():
    page=(ROOT/'frontend/src/pages/game/AdventurePage.tsx').read_text()
    reader=(ROOT/'frontend/src/pages/game/InkboundLiveRoom.tsx').read_text()
    assert page.count('className="finale-inline journey-finale-summary"') == 1
    assert 'completedRoomRecovery ?? (live.status === "ready" && theater.chapterReleased ? finalePanel : null)' in page
    assert 'finalePanel={completedRoomRecovery ?? (theater.chapterReleased ? finalePanel : null)}' in page
    assert 'chapterReleased={theater.chapterReleased' in page
    assert '|| Boolean(completedRoomRecovery)' in page
    assert '{props.finalePanel ? props.finalePanel : <>' in reader
    assert 'END ADVENTURE HERE // RETURN TO HALL' in page


def test_finale_survives_missed_socket_event():
    live=(ROOT/'frontend/src/state/useLiveAdventure.ts').read_text()
    assert 'payload.director_complete && payload.last_turn_result.finale' in live
    assert 'setFinale(payload.last_turn_result.finale)' in live
    assert 'setFinale(payload.finale)' in live


def test_dice_and_progression_are_existing_server_authored_components():
    page=(ROOT/'frontend/src/pages/game/AdventurePage.tsx').read_text()
    reader=(ROOT/'frontend/src/pages/game/InkboundLiveRoom.tsx').read_text()
    theater=(ROOT/'frontend/src/features/adventure/TurnTheater.tsx').read_text()
    assert '<TurnTheater' in page
    assert '<TurnResolutionTheater' in theater
    assert 'lastResult={lastLocalResult}' in page
    assert 'lastProgression={lastLocalProgression}' in page
    assert 'props.lastResult.check.roll' in reader
    assert 'props.lastProgression?.xp_gained' in reader
    assert 'HP unchanged' in reader


def test_authoritative_party_snapshot_is_preferred_over_stale_character_fetch():
    page=(ROOT/'frontend/src/pages/game/AdventurePage.tsx').read_text()
    assert 'partyHeroes.find((p) => p.character_id === characterId) ?? hero' in page
    assert 'hero={partyHeroes.find((p) => p.character_id === characterId) ?? hero ?? null}' in page


def test_final_chapter_is_prominent_and_uses_existing_vote_api():
    page=(ROOT/'frontend/src/pages/game/AdventurePage.tsx').read_text()
    reader=(ROOT/'frontend/src/pages/game/InkboundLiveRoom.tsx').read_text()
    assert 'End this adventure here' in page
    assert 'onClick={live.requestWrapUp}' in page
    assert 'props.wrapUpCallout' in reader
    assert 'wrap_up_votes.includes(live.playerId)' in page
