"""Pass 66.58 launch polish: static visual/accessibility contracts, no gameplay modifications."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def scan():
    module_path = ROOT / "scripts/audit-inkscape-launch-readiness.py"
    spec = importlib.util.spec_from_file_location("quillairo6658", module_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.report()


def test_static_inventory_integrity_and_original_illustrations():
    outcome = scan()
    assert not outcome["source_issues"], outcome["source_issues"]
    assert len(outcome["public_art"]) == 3
    assert all(x["width"] >= 800 and x["height"] >= 600 for x in outcome["public_art"])


def test_mobile_navigation_escape_returns_focus_without_router_changes():
    shell = read("frontend/src/layouts/PublicLayout.tsx")
    assert 'event.key === "Escape" && menuOpen' in shell
    assert "menuButton.current?.focus()" in shell
    assert "setMenuOpen(false);" in shell
    assert "[location.pathname, location.search, location.hash]" in shell
    assert 'aria-controls="public-navigation"' in shell


def test_dead_feedback_promo_removed_without_changing_live_contact_link():
    shell = read("frontend/src/layouts/PublicLayout.tsx")
    assert "FEEDBACK // OFFLINE" not in shell
    assert 'mailto:${FEEDBACK_EMAIL}' in shell
    assert '<a href={feedbackHref}>FEEDBACK</a>' in shell


def test_missing_route_sends_signed_out_users_home():
    code = read("frontend/src/pages/RouteErrorPage.tsx")
    assert 'authenticated ? (' in code
    assert 'to="/game"' in code and 'to="/"' in code
    assert "RETURN HOME" in code
    assert 'window.location.reload()' in code


def test_small_screen_type_and_touch_targets_are_reachable():
    css = read("frontend/src/styles/inkscapeLaunchPolishPass6658.css")
    for token in ("max-width: 375px", "grid-template-columns: minmax(0, 1fr)", "min-height: 44px", "font-size: 15px", "font-size: 12px"):
        assert token in css
    for forbidden in (".inkbound-live", ".ibl-", ".story-pane", "background-image:", "filter:", "@keyframes"):
        assert forbidden not in css


def test_known_password_reset_blocker_is_reported_not_hidden():
    result = scan()
    assert any("Password recovery" in reason for reason in result["launch_blockers"])
    assert len(result["requires_real_browser"]) >= 5


def test_audit_cli_json_and_strict_source():
    program = ROOT / "scripts/audit-inkscape-launch-readiness.py"
    process = subprocess.run([sys.executable, str(program), "--json", "--strict-source"], cwd=ROOT, text=True, capture_output=True, check=False)
    assert process.returncode == 0, process.stdout + process.stderr
    data = json.loads(process.stdout)
    assert data["pass"] == "66.58"
    assert data["launch_blockers"]


def test_audit_is_pretest_gate_not_a_false_visual_success():
    script = read("scripts/check-project.sh")
    assert 'scripts/audit-inkscape-launch-readiness.py --strict-source' in script
    assert script.index('audit-inkscape-launch-readiness.py --strict-source') < script.index('"$PYTHON_BIN" -m pytest tests -q')
    assert "Manual QA" in read("docs/inkscape-launch-readiness-66_58.md")


def test_gameplay_state_recovery_unchanged_by_pass():
    main = read("frontend/src/main.tsx")
    for token in ("<AuthProvider>", "<GameSocketProvider>", "<ModalProvider>", "<RouterProvider router={router} />"):
        assert token in main
    assert 'import "./styles/inkscapeSitewideQaPass6657.css";' in main
    assert 'import "./styles/inkscapeLaunchPolishPass6658.css";' in main
