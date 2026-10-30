#!/usr/bin/env python3
"""Read-only static Inkscape QA gate; not a replacement for logged-in browser QA.

Usage: python3 scripts/audit-inkscape-ui.py --strict
       python3 scripts/audit-inkscape-ui.py --json
No network, credentials, build dependencies or source modifications required.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend/src"


def source(rel: str) -> str:
    path = ROOT / rel
    if not path.is_file():
        raise FileNotFoundError(rel)
    return path.read_text(encoding="utf-8")


def run_audit() -> dict:
    issues: list[str] = []
    checks: list[dict] = []

    def check(label: str, valid: bool, detail: str = "") -> None:
        checks.append({"check": label, "passed": bool(valid), "detail": detail})
        if not valid:
            issues.append(f"{label}: {detail}")

    router = source("frontend/src/router.tsx")
    lazy = re.findall(r'await import\("(\./pages/[^\"]+)"\)', router)
    check("lazy route discovery", len(lazy) >= 22, f"{len(lazy)} lazy declarations")
    targets = sorted(set(lazy))
    missing = [name for name in targets if not (FRONTEND / (name.removeprefix("./") + ".tsx")).is_file()]
    check("lazy route modules", not missing, ", ".join(missing))
    # Each route is behind the existing public/auth/admin composition: this
    # gate catches removal of their protective wrappers, without claiming to
    # authenticate or exercise live browser interactions.
    for label, fragment in (
        ("public shell", "<PublicLayout />"),
        ("authentication gate", "<RequireAuth />"),
        ("game shell", "<GameLayout />"),
        ("account shell", "<AccountLayout />"),
        ("route error fallback", "<RouteErrorPage />"),
    ):
        check(label, fragment in router)

    # Pass 66.68 retired the admin /dev workshop of CRT/book/tabletop experiments.
    # This guard fails if a lab gate, workshop page or lab route reappears.
    check("retired lab routes stay retired",
          "DevLabGate" not in router and "DevWorkshopPage" not in router and 'path: "dev"' not in router,
          "no lab gate, workshop page or /dev route")

    layouts = {
        "Public": source("frontend/src/layouts/PublicLayout.tsx"),
        "Game": source("frontend/src/layouts/GameLayout.tsx"),
        "Account": source("frontend/src/layouts/AccountLayout.tsx"),
    }
    for label, contents in layouts.items():
        check(f"{label.lower()} skip link", 'href="#main-content"' in contents)
        check(f"{label.lower()} main landmark", 'id="main-content"' in contents and 'tabIndex={-1}' in contents)
        check(f"{label.lower()} theme selection", 'data-ink-paper={paper}' in contents)
    check("account navigation landmark", 'aria-label="Account navigation"' in layouts["Account"])
    check("public navigation landmark", 'aria-label="Primary navigation"' in layouts["Public"])
    check("game navigation landmark", 'aria-label="Primary navigation"' in layouts["Game"])

    shared_css = source("frontend/src/styles/inkscapeSitewideQaPass6657.css")
    main = source("frontend/src/main.tsx")
    check("sitewide QA stylesheet loaded", 'import "./styles/inkscapeSitewideQaPass6657.css";' in main)
    check("mobile menu unclipped", "overflow: visible" in shared_css and ".header-system-popover" in shared_css)
    check("mobile account navigation wraps", "flex-wrap: wrap" in shared_css and ".inkbound-account-shell" in shared_css)
    check("theme-backed keyboard focus", ":focus-visible" in shared_css and "var(--ib-text)" in shared_css)
    check("sitewide chrome presentation-only", all(token not in shared_css for token in ("@keyframes", "filter:", "backdrop-filter:", "url(", "animation:", "!important; display:none")))

    # Existing assets/brand integrity is separately checked by source-hygiene.
    # This checks relative JS/CSS import resolution on each route and the
    # three shared layouts, catching lazy-page CSS omissions before deployment.
    inspected = [FRONTEND / (name.removeprefix("./") + ".tsx") for name in targets]
    inspected += [FRONTEND / "main.tsx", FRONTEND / "router.tsx"]
    inspected += [FRONTEND / "layouts" / (name + "Layout.tsx") for name in layouts]
    missing_imports: list[str] = []
    count = 0
    for path in inspected:
        for imported in re.findall(r'\b(?:from\s+)?[\"\'](\.{1,2}/[^\"\']+)[\"\']', path.read_text(encoding="utf-8")):
            base = path.parent / imported
            choices = [base, Path(str(base) + ".tsx"), Path(str(base) + ".ts"), Path(str(base) + ".css"), base / "index.tsx", base / "index.ts"]
            count += 1
            if not any(candidate.is_file() for candidate in choices):
                missing_imports.append(str(path.relative_to(ROOT)) + ": " + imported)
    check("production imports resolve", not missing_imports, f"{count} imports; missing: {missing_imports[:8]}")

    # The gameplay guard is about changed files, not presence of class names.
    # Installer hashes and limits changes to presentation, audit and tests.
    return {
        "pass": "66.57", "kind": "static source QA",
        "production_lazy_declarations": len(lazy),
        "unique_lazy_route_modules": len(targets),
        "imports_inspected": count,
        "checks": checks,
        "failed": issues,
        "limitations": [
            "No authenticated browser screenshots or visual diff",
            "No live API, socket, narration, dice, multiplayer or payment interaction",
            "Run the standard project checks and manually review staging on desktop/mobile",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="return nonzero for failed static contracts")
    parser.add_argument("--json", action="store_true", help="machine-readable report to stdout")
    args = parser.parse_args()
    try:
        report = run_audit()
    except (FileNotFoundError, UnicodeError) as exc:
        print("FAIL: Inkscape UI audit could not read required files:", exc)
        return 1
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        for item in report["checks"]:
            print(("PASS" if item["passed"] else "FAIL") + ": " + item["check"] + (" — " + item["detail"] if item["detail"] else ""))
        print(f"66.57 source audit: {sum(c['passed'] for c in report['checks'])}/{len(report['checks'])} passed; "
              f"{report['production_lazy_declarations']} lazy route declarations; {report['imports_inspected']} imports inspected")
        print("NOTE: Logged-in browser/visual QA is still required; this tool does not assert visual perfection.")
    return 1 if report["failed"] and args.strict else 0


if __name__ == "__main__":
    raise SystemExit(main())
