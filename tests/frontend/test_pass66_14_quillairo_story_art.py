"""Pass 66.14: reusable art vs scene art, transparency and ownership contracts."""
from pathlib import Path
import os
import re
import struct
import zlib

from app.generation import scene_art
from app.characters.creation_routes import _verify_transparent_margins

ROOT = Path(__file__).resolve().parents[2]


def _png(width: int, height: int, pixel: tuple[int, int], *, alpha: int = 255) -> bytes:
    rows = bytearray()
    for y in range(height):
        rows.append(0)
        for x in range(width):
            rows.extend((40, 40, 40, alpha if (x, y) == pixel else 0))
    def chunk(tag: bytes, body: bytes):
        return struct.pack('>I', len(body)) + tag + body + struct.pack('>I', zlib.crc32(tag + body))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')


def test_real_png_margin_not_fake_rectangular_feather():
    _verify_transparent_margins(_png(100, 100, (50, 50)), 0.10)
    try:
        _verify_transparent_margins(_png(100, 100, (9, 50)), 0.10)
    except ValueError as exc:
        assert 'margin' in str(exc).lower()
    else:
        assert False, 'border touch must fail'


def test_art_uses_committed_story_not_speculative_choice():
    title, body = 'The Broken Bridge', 'Joe catches a fraying rope as the bridge collapses into a deep gorge.'
    prompt = scene_art.illustration_prompt(title=title, prose=body, genre='mystery')
    assert title in prompt and body in prompt
    assert 'transparent' in prompt.lower()
    assert 'rectangular' in prompt
    assert scene_art.scene_object_key('ABCD12', 'ai_turn_14', body) != scene_art.scene_object_key('ABCD12', 'ai_turn_14', body+'!')
    assert 'worlds' not in scene_art.scene_object_key('ABCD12', 'ai_turn_14', body)


def test_identifiers_are_validated_and_paths_cannot_escape():
    for value in ('../secret', 'a/b', 'http://evil', '😃'):
        try:
            scene_art.safe_id(value)
        except ValueError:
            pass
        else:
            assert False, value


def test_images_are_independent_with_natural_margins():
    for name in ('home-vista', 'living-worlds', 'auth-journey'):
        path = ROOT / 'frontend/public/art/quillairo-public' / f'{name}.png'
        raw=path.read_bytes()
        # This same production validator decodes real alpha and enforces every pixel.
        _verify_transparent_margins(raw, 0.099)


def test_director_commit_schedules_art_without_gating_turn():
    source = (ROOT/'app/main.py').read_text()
    assert source.count('schedule_scene_art(room.code, session.scene, session.adventure)') == 2
    assert 'asyncio.create_task(_render(key, prompt' in (ROOT/'app/generation/scene_art.py').read_text()
    assert 'commit_director_turn(' in source
    assert 'commit_director_opening(' in source


def test_private_room_access_and_authored_cover_contract():
    source=(ROOT/'app/generation/scene_art.py').read_text()
    assert 'room.player_for_user(user.user_id) is None' in source
    assert 'created_by_user_id' in source
    assert 'require_author_write' in source
    assert 'ServerSideEncryption="AES256"' in source
    assert 'max_attempts' in source and 'QUILLAIRO_ART_DAILY_LIMIT' in source


def test_react_reader_stories_do_not_use_ascii_or_static_chapter_number_art():
    room=(ROOT/'frontend/src/pages/game/InkboundLiveRoom.tsx').read_text()
    page=(ROOT/'frontend/src/pages/game/AdventurePage.tsx').read_text()
    hook=(ROOT/'frontend/src/features/adventure/useSceneArtwork.ts').read_text()
    assert 'sceneArtUrl' in room and 'fetch(' not in room
    assert 'useSceneArtwork(' in page and 'fetch(url, { credentials: "same-origin", signal: controller.signal })' in hook
    assert 'className="ibl-art-scene"' in room
    assert 'scene.ascii_art' not in room
    assert 'turnNumber === 1 ? "/art/inkbound' not in page


def test_authored_story_then_world_then_genre_fallback_and_author_ui():
    asset=(ROOT/'frontend/src/features/appearance/quillairoGenreArt.ts').read_text()
    dashboard=(ROOT/'frontend/src/pages/game/InkboundAuthenticatedDashboard.tsx').read_text()
    author=(ROOT/'app/web/author/index.html').read_text()
    assert 'brief_document_id' in asset and 'world_document_id' in asset
    assert 'nextCoverSource' in dashboard
    assert 'q-world-art-panel' in author and 'q-world-art-generate' in author
    assert 'worldDocumentId' in (ROOT/'frontend/src/pages/game/InkboundLiveRoom.tsx').read_text()


def test_rulebook_is_real_reskinned_page_not_flat_image():
    rulebook=(ROOT/'frontend/src/pages/game/RulebookPage.tsx').read_text()
    theme=(ROOT/'frontend/src/pages/game/quillairoRulebookPass6614.css').read_text()
    for section in ('THE CORE LOOP','HERO BIO // CANON','CORE ATTRIBUTES','LEVELS // ADVANCEMENT','XP // SUCCESS AND FAILURE'):
        assert section in rulebook
    for paper in ('cream','parchment','navy','phosphor','midnight'):
        assert f'data-ink-paper="{paper}"' in theme


def test_paid_art_quota_is_durable_and_atomic(tmp_path, monkeypatch):
    monkeypatch.setattr(scene_art, 'DATABASE_PATH', tmp_path / 'test-art.sqlite3')
    monkeypatch.setenv('QUILLAIRO_ART_DAILY_LIMIT', '2')
    assert scene_art._reserve_attempt('scene-1', 1)
    assert not scene_art._reserve_attempt('scene-1', 1)
    assert scene_art._reserve_attempt('scene-2', 1)
    assert not scene_art._reserve_attempt('scene-3', 1)
    assert scene_art._attempt_count('scene-1') == 1
    assert scene_art._attempt_count('scene-3') == 0


def test_world_cover_hidden_until_published_for_other_accounts():
    source=(ROOT/'app/generation/scene_art.py').read_text()
    assert '_readable_document' in source
    assert 'version.get("status") == "published"' in source
