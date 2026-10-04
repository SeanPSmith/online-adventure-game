from pathlib import Path

from app.admin.project_docs import load_project_documentation


def test_project_docs_loader_returns_searchable_sections(tmp_path: Path) -> None:
    path = tmp_path / "PROJECT_MASTER.md"
    path.write_text(
        "# Master Docs\n\nIntro copy.\n\n## Runtime\n\nServer truth.\n\n## Arcade\n\nCabinets.\n",
        encoding="utf-8",
    )

    snapshot = load_project_documentation(path)

    assert snapshot["title"] == "Master Docs"
    assert snapshot["filename"] == "PROJECT_MASTER.md"
    assert snapshot["intro"] == "Intro copy."
    assert [section["title"] for section in snapshot["sections"]] == [
        "Runtime",
        "Arcade",
    ]
    assert snapshot["sections"][0]["id"] == "runtime"
    assert snapshot["sections"][1]["content"] == "Cabinets."
    assert "## Runtime" in snapshot["content"]


def test_backend_packaging_includes_master_docs() -> None:
    root = Path(__file__).resolve().parents[1]
    dockerfile = (root / "Dockerfile").read_text(encoding="utf-8")
    package_script = (root / "scripts" / "aws" / "package-backend.sh").read_text(
        encoding="utf-8"
    )

    assert "COPY docs/PROJECT_MASTER.md ./docs/PROJECT_MASTER.md" in dockerfile
    assert "docs/PROJECT_MASTER.md" in package_script


def test_admin_control_room_exposes_master_documentation() -> None:
    root = Path(__file__).resolve().parents[1]
    page = (root / "frontend" / "src" / "pages" / "admin" / "AdminPage.tsx").read_text(
        encoding="utf-8"
    )
    service = (root / "frontend" / "src" / "services" / "admin.ts").read_text(
        encoding="utf-8"
    )
    routes = (root / "app" / "auth" / "routes.py").read_text(encoding="utf-8")

    assert "PROJECT DOCS" in page
    assert "PROJECT DOCUMENTATION // CANONICAL MASTER" in page
    assert "getAdminProjectDocumentation" in page
    assert '"/api/auth/admin/project-docs"' in service
    assert '@router.get("/admin/project-docs")' in routes
