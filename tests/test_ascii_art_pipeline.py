from __future__ import annotations

from app.generation.ascii_art import generate_scene_ascii_art


def test_ascii_art_is_deterministic_for_same_scene() -> None:
    first = generate_scene_ascii_art(
        title="SATURDAY SHIFT",
        body="Two clerks stare down a dark aisle inside the Elk City Superette.",
        goal="Figure out what moved at the end of the store.",
        threat="Something is waiting under the red EXIT sign.",
        mood="quiet eerie 1984",
    )
    second = generate_scene_ascii_art(
        title="SATURDAY SHIFT",
        body="Two clerks stare down a dark aisle inside the Elk City Superette.",
        goal="Figure out what moved at the end of the store.",
        threat="Something is waiting under the red EXIT sign.",
        mood="quiet eerie 1984",
    )

    assert first == second


def test_ascii_art_respects_reasonable_dimensions() -> None:
    art = generate_scene_ascii_art(
        title="HIGHWAY PANIC",
        body="A lonely road bends toward a gas station at night.",
        width=60,
        height=20,
    )
    lines = art.splitlines()
    assert len(lines) == 20
    assert all(len(line) <= 60 for line in lines)


def test_ascii_art_uses_scene_theme_instead_of_placeholder_story() -> None:
    art = generate_scene_ascii_art(
        title="OLD CHAPEL",
        body="The chapel doors stand open in the cemetery and a figure waits near the altar.",
    )
    assert "STORY" not in art
    assert "OLD CHAPEL" in art
    assert "+" in art or "|_|" in art
