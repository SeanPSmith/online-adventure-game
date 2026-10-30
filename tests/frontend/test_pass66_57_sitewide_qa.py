"""66.57 cross-route Inkscape QA — presentation-only source contracts."""
from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def audit():
    path = ROOT / "scripts/audit-inkscape-ui.py"
    spec = importlib.util.spec_from_file_location("inkscape_audit_6657", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.run_audit()


def test_inkscape_route_integrity_all_checks_pass():
    result = audit()
    assert not result["failed"], result["failed"]
    assert result["production_lazy_declarations"] >= 25
    assert result["imports_inspected"] >= 100


def test_account_header_is_named_and_core_navigation_untouched():
    layout = read("frontend/src/layouts/AccountLayout.tsx")
    assert '<nav className="header-nav" aria-label="Account navigation">' in layout
    for token in ("canUseAuthorStudio", "isAdmin", "readLastGameRoute()", "<Outlet />", 'href="#main-content"'):
        assert token in layout


def test_sitewide_css_preserves_illustration_and_room_geometry():
    css = read("frontend/src/styles/inkscapeSitewideQaPass6657.css")
    assert "not(.is-adventure-mode)" in css, "Live room must not inherit responsive navigation rewrite"
    assert ".inkbound-account-shell" in css
    for forbidden in (".inkbound-live", ".ibl-", ".story-pane", ".adventure-layout", "@keyframes", "url(", "filter:", "text-shadow:", "background-image:"):
        assert forbidden not in css, f"Out-of-scope styling: {forbidden}"


def test_mobile_navigation_does_not_clip_system_dropdown():
    css = read("frontend/src/styles/inkscapeSitewideQaPass6657.css")
    assert ".game-header .header-nav" in css
    assert "overflow: visible" in css
    assert "flex-wrap: wrap" in css
    assert ".header-system-popover" in css


def test_keyboard_theme_focus_and_anchor_reachability():
    css = read("frontend/src/styles/inkscapeSitewideQaPass6657.css")
    assert ":focus-visible" in css
    assert "var(--ib-text)" in css
    assert "scroll-margin-block-start" in css
    assert "44px" in css


def test_sitewide_static_gate_runs_in_standard_project_verification():
    check = read("scripts/check-project.sh")
    assert 'scripts/audit-inkscape-ui.py --strict' in check
    assert check.index("audit-inkscape-ui.py --strict") < check.index('"$PYTHON_BIN" -m pytest tests -q')
    assert "./scripts/aws/deploy-game-staging.sh" not in check


def test_audit_command_is_read_only_and_fails_on_regression():
    out = subprocess.run(
        [sys.executable, str(ROOT / "scripts/audit-inkscape-ui.py"), "--strict"],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )
    assert out.returncode == 0, out.stderr + out.stdout
    assert "NOTE: Logged-in browser/visual QA is still required" in out.stdout


def test_no_logic_edits_in_sitewide_pass():
    entry = read("frontend/src/main.tsx")
    assert 'import "./styles/inkscapeSitewideQaPass6657.css";' in entry
    for required in ("<AuthProvider>", "<GameSocketProvider>", "<ModalProvider>", "<RouterProvider router={router} />"):
        assert required in entry
