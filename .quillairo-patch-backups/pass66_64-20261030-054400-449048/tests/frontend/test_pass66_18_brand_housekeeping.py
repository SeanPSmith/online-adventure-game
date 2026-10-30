"""Pass 66.18: public brand clean-up without breaking legacy persisted IDs."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def test_public_copy_and_ai_instructions_uses_quillairo():
    for name in (
        "app/generation/director.py", "app/generation/openai_provider.py",
        "app/authoring/ai_assist.py", "frontend/public/legal/story-time-third-party-notices.txt",
        "scripts/release-staging.sh",
    ):
        text = read(name)
        assert "TALES OF TWO" not in text, name
        assert "Tales of Two" not in text, name
        assert "Quillairo" in text or "QUILLAIRO" in text, name


def test_existing_branded_interfaces_still_have_stable_ids():
    director = read("app/generation/director.py")
    for old_tool_id in (
        "tales_of_two_director_turn", "tales_of_two_turn_recap",
        "tales_of_two_director_turn_json_repair", "tales_of_two_director_turn_repair",
    ):
        assert old_tool_id in director
    for op in ("director_story", "director_recap", "director_json_repair", "director_schema_repair"):
        assert f'operation="{op}"' in director
    assert 'tales-of-two-theme/v1' in read('frontend/src/features/appearance/themePacks.ts')
    assert 'tales-of-two-theme/v2' in read('frontend/src/features/appearance/themeEditions.ts')
    assert 'tales-of-two:notification-preferences:v2' in read('frontend/src/services/notifications.ts')


def test_quillairo_export_and_manifest():
    assert 'quillairo-${pack.id}.json' in read('frontend/src/features/appearance/themePacks.ts')
    assert '`quillairo:${payload.kind' in read('frontend/public/notification-sw.js')
    assert json.loads(read('frontend/package.json'))['name'] == 'quillairo-frontend'
    assert json.loads(read('frontend/package-lock.json'))['packages']['']['name'] == 'quillairo-frontend'
    assert json.loads(read('frontend/public/brand/tokens.json'))['name'] == 'Quillairo'
    assert 'legacy_product_name' not in read('frontend/public/brand/tokens.json')


def test_story_art_nonblocking_commit_and_rescue_preserved():
    main = read('app/main.py')
    director = read('app/generation/director.py')
    assert main.count('schedule_scene_art(room.code, session.scene, session.adventure)') == 2
    assert 'operation="director_story"' in director
    assert 'director_story_rescue' in director


def test_quillairo_release_and_snapshot_are_clean():
    assert 'TALES OF TWO // STAGING RELEASE' not in read('scripts/release-staging.sh')
    package = read('scripts/package-for-review.sh')
    for rule in (".aws-build/", ".pass64-2-backup/", "*.tsbuildinfo"):
        assert f"--exclude='{rule}'" in package
