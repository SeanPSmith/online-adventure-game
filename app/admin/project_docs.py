from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import re


PROJECT_ROOT = Path(__file__).resolve().parents[2]
PROJECT_MASTER_PATH = PROJECT_ROOT / "docs" / "PROJECT_MASTER.md"


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "section"


def load_project_documentation(path: Path | None = None) -> dict:
    document_path = path or PROJECT_MASTER_PATH
    content = document_path.read_text(encoding="utf-8")

    lines = content.splitlines()
    title = "Tales of Two — Master Project Documentation"
    intro_lines: list[str] = []
    sections: list[dict[str, str]] = []
    current_title: str | None = None
    current_lines: list[str] = []

    def flush_section() -> None:
        nonlocal current_title, current_lines
        if current_title is None:
            return
        sections.append(
            {
                "id": _slugify(current_title),
                "title": current_title,
                "content": "\n".join(current_lines).strip(),
            }
        )
        current_title = None
        current_lines = []

    for line in lines:
        if line.startswith("# ") and title == "Tales of Two — Master Project Documentation":
            title = line[2:].strip() or title
            continue

        if line.startswith("## "):
            flush_section()
            current_title = line[3:].strip()
            continue

        if current_title is None:
            intro_lines.append(line)
        else:
            current_lines.append(line)

    flush_section()

    modified_at = datetime.fromtimestamp(
        document_path.stat().st_mtime,
        tz=timezone.utc,
    ).isoformat()

    return {
        "title": title,
        "filename": document_path.name,
        "updated_at": modified_at,
        "intro": "\n".join(intro_lines).strip(),
        "content": content,
        "sections": sections,
    }
