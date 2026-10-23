"""Regression contracts for the real Quillairo Hero Hall / sheet / memorial pages.

Do not assert arbitrary presentational markup counts; protect working service
callbacks, semantic role boundaries, and the art/portrait rules instead.
"""
from pathlib import Path
from tests.support import PROJECT_ROOT

HALL = (PROJECT_ROOT / "frontend/src/pages/heroes/HeroManagerPage.tsx").read_text()
SHEET = (PROJECT_ROOT / "frontend/src/pages/heroes/HeroSheetPage.tsx").read_text()
GRAVE = (PROJECT_ROOT / "frontend/src/pages/heroes/GraveyardPage.tsx").read_text()
CSS = (PROJECT_ROOT / "frontend/src/pages/heroes/quillairoHeroArchivePass6615.css").read_text()


def test_hero_hall_is_a_real_filtered_owner_archive():
    for contract in ("listCharacters()", "getHeroPortraits", "selectedHeroPortraits",
                     "heroBelongsToView(hero, view)", "hero.is_alive", "hero.hero_status",
                     "to={`/game/heroes/${hero.character_id}`}"):
        assert contract in HALL, contract
    assert "Math.random" not in HALL
    assert "<pre" not in HALL


def test_destructive_actions_remain_server_held_and_confirmed():
    for contract in ("setHeroDisposition(", "deleteCharacter(",
                     'confirmName !== hero.name', "COMMIT TO MEMORY", "DELETE FOREVER"):
        assert contract in HALL, contract
    assert "window.confirm" not in HALL


def test_portraits_are_selected_and_private_not_fabricated():
    assert "result.value.selected_attempt" in HALL
    assert "chosen.url" in HALL
    assert "monogram-gold-original.png" in HALL
    assert "portraitBook.selected_attempt" in SHEET
    assert "chooseHeroPortrait(hero.character_id" in SHEET
    assert "generateHeroPortrait(hero.character_id)" in SHEET
    assert "portraitBook.attempts_used < portraitBook.max_attempts" in SHEET


def test_character_sheet_keeps_server_advancement_and_editable_bio():
    for contract in ("getCharacter(heroId)", "getCreationRules()", "listCharacterStories(heroId)",
                     "advanceCharacter(heroId", "updateCharacterProfile(heroId", "setStatSpend",
                     "setSkillSpend", "setTalentSpend", "COMMIT ADVANCEMENT", "HERO DOSSIER"):
        assert contract in SHEET, contract
    assert "hero.inventory.map" in SHEET
    assert "hero.effects.map" in SHEET
    assert "hero.xp_progress_percent" in SHEET


def test_graveyard_is_real_shared_memorial_without_private_bio():
    assert "listGraveyard()" in GRAVE
    assert "hero.epitaph" in GRAVE
    assert "hero.buried_at" in GRAVE
    assert "hero.bio" not in GRAVE
    assert "<pre" not in GRAVE


def test_manuscript_layouts_are_responsive_and_theme_aware():
    assert "var(--ib-paper" in CSS
    assert "var(--ib-text" in CSS
    assert "var(--ib-line" in CSS
    assert "@media(max-width:760px)" in CSS
    assert "prefers-reduced-motion" in CSS
    for cls in (".qh15-hero-grid", ".qh15-sheet-frontispiece", ".qh15-memorials",
                ".qh15-inventory-list", ".qh15-filter-tabs"):
        assert cls in CSS


def test_existing_safe_margin_art_is_used_not_a_flat_page_image():
    assert "/art/quillairo-heroes/hero-hall-vista.png" in HALL
    assert "/art/quillairo-heroes/memorial-crossroads.png" in GRAVE
    for forbidden in ("clip-path:inset", "mask-image:linear-gradient", "feather"):
        assert forbidden not in CSS


def test_archival_watercolor_art_is_true_rgba_and_keeps_ten_percent_clear_canvas():
    """PNG inspection uses only the standard library (no Pillow in release tests)."""
    import struct
    import zlib

    for name in ("hero-hall-vista.png", "memorial-crossroads.png"):
        file = PROJECT_ROOT / "frontend/public/art/quillairo-heroes" / name
        png = file.read_bytes()
        assert png[:8] == b"\x89PNG\r\n\x1a\n"
        w, h, depth, color, _, _, interlace = struct.unpack(">IIBBBBB", png[16:29])
        assert (depth, color, interlace) == (8, 6, 0)
        pointer, compressed = 8, bytearray()
        while pointer < len(png):
            length = int.from_bytes(png[pointer:pointer + 4], "big")
            kind = png[pointer + 4:pointer + 8]
            if kind == b"IDAT":
                compressed.extend(png[pointer + 8:pointer + 8 + length])
            pointer += 12 + length
            if kind == b"IEND":
                break
        decoded = zlib.decompress(compressed)
        stride, previous, offset = w * 4, bytearray(w * 4), 0
        # Inspect only the 10% perimeter; there must be *zero* alpha there.
        margin_x, margin_y = (w + 9) // 10, (h + 9) // 10
        for y in range(h):
            method = decoded[offset]
            row = bytearray(decoded[offset + 1:offset + 1 + stride])
            offset += stride + 1
            for x in range(stride):
                a = row[x - 4] if x >= 4 else 0
                b = previous[x]
                c = previous[x - 4] if x >= 4 else 0
                if method == 1:
                    row[x] = (row[x] + a) & 255
                elif method == 2:
                    row[x] = (row[x] + b) & 255
                elif method == 3:
                    row[x] = (row[x] + ((a + b) >> 1)) & 255
                elif method == 4:
                    p = a + b - c
                    da, db, dc = abs(p - a), abs(p - b), abs(p - c)
                    row[x] = (row[x] + (a if da <= db and da <= dc else b if db <= dc else c)) & 255
                else:
                    assert method == 0
            alpha = row[3::4]
            if y < margin_y or y >= h - margin_y:
                assert not any(alpha), f"{name} has opaque border row {y}"
            else:
                assert not any(alpha[:margin_x]), f"{name} left unsafe margin"
                assert not any(alpha[w - margin_x:]), f"{name} right unsafe margin"
            previous = row
