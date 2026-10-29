#!/usr/bin/env python3
"""66.58 read-only Inkscape launch-readiness inventory; not a visual approval.

Source checks may block staging if --strict-source is supplied. Open launch
blockers remain visible but do NOT block a staging release; they DO block
claiming public-launch readiness. No network, accounts, browser or dependencies.
"""
from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def png_dimensions(rel: str) -> tuple[int, int]:
    path = ROOT / rel
    with path.open("rb") as file:
        header = file.read(24)
    if len(header) < 24 or not header.startswith(b"\x89PNG\r\n\x1a\n") or header[12:16] != b"IHDR":
        raise ValueError(f"Not a valid PNG header: {rel}")
    return struct.unpack(">II", header[16:24])


def report() -> dict:
    source_checks: list[dict] = []
    source_issues: list[str] = []
    launch_blockers: list[str] = []

    def check(label: str, ok: bool, note: str = "") -> None:
        source_checks.append({"name": label, "passed": ok, "note": note})
        if not ok:
            source_issues.append(label + (": " + note if note else ""))

    public = read("frontend/src/layouts/PublicLayout.tsx")
    error = read("frontend/src/pages/RouteErrorPage.tsx")
    home = read("frontend/src/pages/public/PublicHomePage.tsx")
    entry = read("frontend/src/main.tsx")
    polish = read("frontend/src/styles/inkscapeLaunchPolishPass6658.css")
    recovery = read("frontend/src/pages/auth/ForgotPasswordPage.tsx")

    check("public-menu-escape-focus", 'event.key === "Escape"' in public and "menuButton.current?.focus()" in public)
    check("public-menu-state", 'aria-expanded={menuOpen}' in public and "menuOpen ? \"Close navigation menu\"" in public)
    check("no-placeholder-feedback-link", "FEEDBACK // OFFLINE" not in public and "feedbackHref ?" in public)
    check("route-error-auth-safe-return", 'authenticated ? (' in error and '<Link className="button" to="/game">' in error and '<Link className="button" to="/">' in error)
    check("pass6658-css-loaded", 'import "./styles/inkscapeLaunchPolishPass6658.css";' in entry)
    check("small-screen-legibility", "max-width: 375px" in polish and "grid-template-columns: minmax(0, 1fr)" in polish and "font-size: 11px" in polish)
    check("sample-not-a-live-world", "AN INTERACTIVE SAMPLE · NOT A LIVE GAME" in home and "illustrative choice preview" in home)
    check("live-world-link-still-present", 'to="/game"' in home)
    check("existing-brand-intact", "<BrandLockup paper={paper} />" in public)
    check("no-global-art-treatment", not any(x in polish for x in ("filter:", "animation:", "backdrop-filter:", "background-image:", "url(", "!important; display:none")))

    art: list[dict] = []
    for rel in (
        "frontend/public/art/quillairo-public/home-vista.png",
        "frontend/public/art/quillairo-public/auth-journey.png",
        "frontend/public/art/quillairo-public/living-worlds.png",
    ):
        try:
            w, h = png_dimensions(rel)
            check("public-art-" + Path(rel).name, w >= 800 and h >= 600, f"{w}×{h}")
            art.append({"path": rel, "width": w, "height": h})
        except (FileNotFoundError, OSError, ValueError) as exc:
            check("public-art-" + Path(rel).name, False, str(exc))

    if "not yet available" in recovery or "not connected" in recovery:
        launch_blockers.append("Password recovery is explicitly unavailable. A secure recovery workflow must be connected and validated before public launch.")

    manual = [
        "Compare rendered home/login/register against the nine approved references at desktop and mobile sizes.",
        "Verify 320/375/390px navigation, form labels, choice buttons and no horizontal overflow in a real browser.",
        "Verify auth, Hero Hall, archive, authoring and admin journeys against actual staging accounts.",
        "Play a full adventure through intermission, dice, result and next chapter with no gameplay changes.",
        "Verify all six themes, keyboard focus, screen reader landmarks and responsive long-form reading.",
        "Validate password recovery, email delivery and account security before public launch.",
    ]
    return {
        "pass": "66.58",
        "kind": "source and launch readiness inventory, not browser QA",
        "source_checks": source_checks,
        "source_issues": source_issues,
        "public_art": art,
        "launch_blockers": launch_blockers,
        "requires_real_browser": manual,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--strict-source", action="store_true", help="fail on missing static integrity contracts, not on known launch blockers")
    args = parser.parse_args()
    try:
        data = report()
    except (FileNotFoundError, OSError, UnicodeError) as exc:
        print(f"FAIL: 66.58 source inventory unreadable: {exc}")
        return 1
    if args.json:
        print(json.dumps(data, indent=2))
    else:
        for item in data["source_checks"]:
            print(("PASS" if item["passed"] else "FAIL") + ": " + item["name"] + (" — " + item["note"] if item["note"] else ""))
        for issue in data["launch_blockers"]:
            print("PUBLIC LAUNCH BLOCKER (staging allowed): " + issue)
        print("MANUAL QA REQUIRED: " + str(len(data["requires_real_browser"])) + " outstanding browser/interaction checks")
        print(f"66.58 source inventory: {sum(x['passed'] for x in data['source_checks'])}/{len(data['source_checks'])} passing")
    return 1 if args.strict_source and data["source_issues"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
