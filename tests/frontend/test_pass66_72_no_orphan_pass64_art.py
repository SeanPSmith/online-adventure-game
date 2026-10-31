"""Pass 66.72: retired desk/tabletop/ink-mask artwork stays deleted, and nothing in art/pass64 is orphaned."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "frontend/public/art/pass64"
SRC = ROOT / "frontend/src"


def test_only_referenced_covers_remain():
    files = sorted(p.relative_to(ART).as_posix() for p in ART.rglob("*") if p.is_file())
    assert files == ["gothic.webp", "scifi.webp"], files


def test_every_remaining_pass64_file_is_used_by_source():
    source = "\n".join(p.read_text(encoding="utf-8", errors="ignore")
                       for p in SRC.rglob("*") if p.suffix in {".ts", ".tsx", ".css"})
    for path in ART.rglob("*"):
        if path.is_file():
            assert f"/art/pass64/{path.relative_to(ART).as_posix()}" in source, path.name


def test_no_source_points_at_deleted_pass64_art():
    import re
    live = {p.relative_to(ART).as_posix() for p in ART.rglob("*") if p.is_file()}
    for path in SRC.rglob("*"):
        if path.suffix not in {".ts", ".tsx", ".css"}:
            continue
        for ref in re.findall(r"/art/pass64/([\w./-]+)", path.read_text(encoding="utf-8", errors="ignore")):
            assert ref in live, f"{path.name} references deleted art {ref}"
