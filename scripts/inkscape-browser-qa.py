#!/usr/bin/env python3
"""Pass 66.59: read-only real-browser visual evidence for Quillairo staging.

Captures public pages and, optionally, signed-in pages in a temporary browser
context. Does not save passwords, tokens, cookies or browser storage state.
This is evidence collection, not automatic visual approval.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse, urljoin

PUBLIC_ROUTES = ("/", "/login", "/register", "/forgot-password", "/rulebook")
PRIVATE_ROUTES = (
    "/game", "/game/heroes", "/game/heroes/new", "/game/adventures",
    "/game/history", "/account", "/author", "/admin",
)
VIEWPORTS = (("desktop", 1440, 900), ("tablet", 768, 1024), ("mobile", 390, 844), ("small-mobile", 320, 740))
MAX_FULL_PAGE_HEIGHT = 12000
_ROOT = Path(__file__).resolve().parents[1]


def safe_url(value: str) -> str:
    parsed = urlparse(value.strip())
    localhost = parsed.hostname in {"localhost", "127.0.0.1"}
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise ValueError("Base URL must be a site origin with no credentials, path, query or fragment")
    if parsed.scheme != "https" and not (localhost and parsed.scheme == "http"):
        raise ValueError("HTTPS required, except for local development on localhost")
    return value.rstrip("/")


def find_staging_url() -> str:
    if not shutil.which("aws"):
        raise RuntimeError("AWS CLI unavailable; pass --url https://YOUR-STAGING-URL")
    profile = os.getenv("AWS_PROFILE", "adventure-staging")
    region = os.getenv("AWS_REGION", "us-east-1")
    cmd = ["aws", "cloudformation", "describe-stacks", "--stack-name", "AdventurePlatformFrontend-staging",
           "--profile", profile, "--region", region,
           "--query", "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue | [0]", "--output", "text"]
    env = os.environ.copy()
    env["AWS_PAGER"] = ""
    env["AWS_EC2_METADATA_DISABLED"] = "true"
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=20, env=env, check=False)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("AWS lookup timed out; supply --url to avoid an AWS login") from exc
    if result.returncode or result.stdout.strip() in ("", "None", "null"):
        raise RuntimeError("Could not read staging CloudFront URL with current AWS session; supply --url. No SSO login attempted.")
    return safe_url(result.stdout.strip())


def output_dir(explicit: str | None) -> Path:
    if explicit:
        dest = Path(explicit).expanduser().resolve()
    else:
        dest = (_ROOT.parent / "assets" / "AWS" / "visual-qa" / dt.datetime.now().strftime("pass66_59-%Y%m%d-%H%M%S")).resolve()
    # Do not accidentally add private browser screenshots to git release commits.
    if dest == _ROOT or _ROOT in dest.parents:
        raise ValueError("QA screenshots must be outside the root/ repository")
    dest.mkdir(parents=True, exist_ok=False)
    return dest


def safe_name(route: str) -> str:
    return "home" if route == "/" else re.sub(r"[^a-z0-9-]+", "-", route.strip("/").replace("/", "-"))


def redact(message: str) -> str:
    # Runtime errors can contain API URLs. Never persist query values, bearer tokens or cookies.
    message = re.sub(r"(?i)bearer\s+\S+", "Bearer [REDACTED]", message)
    message = re.sub(r"(?i)(token|secret|password|authorization|cookie)\s*[:=]\s*[^\s,;]+", r"\1=[REDACTED]", message)
    message = re.sub(r"(https?://[^\s?#]+)\?[^\s#]+", r"\1?[QUERY REDACTED]", message)
    return message[:280]


def get_metrics(page) -> dict:
    return page.evaluate("""() => {
      const visible = (node) => !!(node.getClientRects().length);
      const img = [...document.querySelectorAll('img')].filter(visible);
      const bad = img.filter(el => el.complete && el.naturalWidth === 0);
      const broken = bad.map(el => (el.getAttribute('src')||'').split('?')[0].slice(0,160));
      const headings = [...document.querySelectorAll('h1')].filter(visible).map(el=>el.innerText.trim().slice(0,120));
      const documentWidth = document.documentElement.scrollWidth;
      const viewportWidth = window.innerWidth;
      return { title: document.title, heading: headings, viewport_width: viewportWidth,
        document_width: documentWidth, overflow_px: Math.max(0, documentWidth - viewportWidth),
        missing_images: broken, visible_image_count: img.length,
        height: document.documentElement.scrollHeight,
        main_present: !!document.querySelector('main') };
    }""")


def check_public_interactions(page) -> list[dict]:
    results: list[dict] = []
    # Check only real controls in the published public page; never fabricate outcomes.
    try:
        menu = page.locator(".public-menu-toggle")
        menu.click(timeout=3000)
        was_open = menu.get_attribute("aria-expanded") == "true"
        page.keyboard.press("Escape")
        closed = menu.get_attribute("aria-expanded") == "false"
        results.append({"check": "mobile-menu-escape", "passed": was_open and closed})
    except Exception as exc:
        results.append({"check": "mobile-menu-escape", "passed": False, "reason": redact(str(exc))})
    try:
        choice = page.get_by_role("button", name=re.compile("Follow the lantern light", re.I))
        choice.click(timeout=3000)
        passed = choice.get_attribute("aria-pressed") == "true" and "You step from the road" in page.locator(".qpub-sample-outcome").inner_text()
        results.append({"check": "sample-choice-updates-preview", "passed": passed})
    except Exception as exc:
        results.append({"check": "sample-choice-updates-preview", "passed": False, "reason": redact(str(exc))})
    return results


def capture(base: str, signed_in: bool, dest: Path, browser_name: str, show_browser: bool) -> dict:
    from playwright.sync_api import sync_playwright, TimeoutError as PwTimeout

    results = {"pass": "66.59", "origin": base, "timestamp_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
               "signed_in_requested": signed_in, "screenshots": [], "interaction_checks": [], "warnings": [],
               "manual_approval_required": True, "launch_blockers": ["Password recovery remains unimplemented (66.58 inventory)."]}
    with sync_playwright() as playwright:
        options = {"headless": not show_browser}
        if browser_name == "chrome": options["channel"] = "chrome"
        elif browser_name and browser_name not in ("bundled", "chromium"):
            options["executable_path"] = browser_name
        browser = playwright.chromium.launch(**options)
        context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1,
                                      reduced_motion="reduce", accept_downloads=False, service_workers="block")
        page = context.new_page()
        # Do not include query strings, bodies, cookies, storage state, auth headers or HAR files.
        if signed_in:
            if not show_browser:
                raise RuntimeError("--signed-in requires --headed to permit an interactive login")
            print("\nA temporary Chrome window is opening. Sign into staging there; only after login will screenshots be taken.")
            page.goto(base + "/login", wait_until="domcontentloaded", timeout=35000)
            try:
                page.wait_for_url(re.compile(r"/game(?:[/?#]|$)"), timeout=480000)
            except PwTimeout as exc:
                raise RuntimeError("No signed-in /game navigation detected. No protected captures taken.") from exc
            print("Authenticated screen detected. Capturing protected routes without saving your session.")

        all_routes = list(PUBLIC_ROUTES) + (list(PRIVATE_ROUTES) if signed_in else [])
        for route in all_routes:
            for label, width, height in VIEWPORTS:
                page.set_viewport_size({"width": width, "height": height})
                errors: list[str] = []
                def on_pageerror(error): errors.append(redact(str(error)))
                page.on("pageerror", on_pageerror)
                screenshot_rel = f"{safe_name(route)}--{label}.png"
                entry = {"route": route, "size": label, "width": width, "height": height, "file": screenshot_rel}
                try:
                    page.goto(urljoin(base + "/", route.lstrip("/")), wait_until="domcontentloaded", timeout=35000)
                    try: page.locator("#main-content").wait_for(state="visible", timeout=12000)
                    except PwTimeout: pass
                    page.evaluate("document.fonts.ready.then(() => true)")
                    page.wait_for_timeout(350)
                    entry["final_path"] = urlparse(page.url).path
                    entry["route_reached"] = entry["final_path"] == route
                    if signed_in and route.startswith(("/game", "/account", "/author", "/admin")) and not entry["route_reached"]:
                        results["warnings"].append(f"Protected route redirected: {route} ({label})")
                    entry["metrics"] = get_metrics(page)
                    entry["page_errors"] = errors[:3]
                    if entry["metrics"]["overflow_px"] > 2:
                        results["warnings"].append(f"Horizontal overflow {route} {label}: {entry['metrics']['overflow_px']}px")
                    if entry["metrics"]["missing_images"]:
                        results["warnings"].append(f"Missing imagery on {route} {label}")
                    if errors:
                        results["warnings"].append(f"Runtime JS error on {route} {label}")
                    full_page = entry["metrics"]["height"] <= MAX_FULL_PAGE_HEIGHT
                    entry["full_page"] = full_page
                    page.screenshot(path=str(dest/screenshot_rel), full_page=full_page, animations="disabled", timeout=30000)
                    if route == "/" and label == "mobile":
                        results["interaction_checks"] = check_public_interactions(page)
                    print(f"  {'OK' if entry['route_reached'] else 'CHECK'} {route:<18} {label:<12} {entry['metrics']['overflow_px']}px overflow")
                except Exception as exc:
                    entry["failure"] = redact(str(exc))
                    results["warnings"].append(f"Failed capture: {route} {label}")
                    print(f"  FAIL {route:<18} {label:<12} {entry['failure'][:120]}")
                finally:
                    page.remove_listener("pageerror", on_pageerror)
                results["screenshots"].append(entry)
        context.close()
        browser.close()
    return results


def write_report(dest: Path, data: dict) -> None:
    (dest/"results.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    cards = []
    for item in data["screenshots"]:
        route = html.escape(item["route"])
        label = html.escape(item["size"])
        metrics = item.get("metrics", {})
        problems = []
        if not item.get("route_reached"): problems.append("route redirected")
        if metrics.get("overflow_px", 0) > 2: problems.append(f"overflow {metrics['overflow_px']}px")
        if metrics.get("missing_images"): problems.append("missing image")
        if item.get("page_errors"): problems.append("JS errors")
        if item.get("failure"): problems.append("capture failed")
        status = html.escape(", ".join(problems) or "capture complete")
        file = html.escape(item["file"], quote=True)
        cards.append(f'<article><h2>{route} <small>{label} — {item["width"]}×{item["height"]}</small></h2><p>{status}</p>' +
                     (f'<a href="{file}"><img loading="lazy" src="{file}" alt="Screenshot of {route} at {label}"></a>' if not item.get("failure") else "") + '</article>')
    warning_html = ''.join(f'<li>{html.escape(note)}</li>' for note in data['warnings']) or '<li>No automated capture warnings</li>'
    report = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Quillairo 66.59 — Visual QA</title>
<style>body{background:#eee8df;color:#181817;font:15px/1.5 system-ui;margin:0 auto;padding:32px;max-width:1600px}h1{font:42px Georgia,serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:22px}article{background:white;border:1px solid #c5b9a6;padding:12px}article h2{font:20px Georgia,serif;margin:0}small{font:12px system-ui;display:block}article img{width:100%;height:440px;object-fit:contain;object-position:top;background:#f6f4ef;border:1px solid #ddd}p,li{font-size:14px}a{color:inherit} .notice{background:#fff9eb;padding:16px;border-left:3px solid #927037;margin:20px 0}</style>
<h1>Quillairo — 66.59 Browser Evidence</h1><p>Source: ''' + html.escape(data['origin']) + '''. Compare at thumbnail size first, full resolution second. This report does not imply approval.</p>
<div class="notice"><strong>Manual review required.</strong> Compare against the nine Oct 23 Inkscape references. Confirm reading order, type legibility, spacing, illustration quality, mobile interactions, real gameplay sequence, authentication, and all themes. Screenshots stay on this machine unless you share them.</div>
<h2>Automated warnings</h2><ul>''' + warning_html + '''</ul><main>''' + ''.join(cards) + '</main></html>'
    (dest/"index.html").write_text(report, encoding="utf-8")


def self_check() -> int:
    assert len(PUBLIC_ROUTES) == 5 and len(PRIVATE_ROUTES) == 8 and len(VIEWPORTS) == 4
    assert safe_url("https://staging.example.org/") == "https://staging.example.org"
    assert safe_url("http://localhost:5173") == "http://localhost:5173"
    for bad in ("file:///etc/passwd", "http://example.org", "https://example.org/?token=x", "https://me:pass@example.org", "https://example.org/other"):
        try: safe_url(bad)
        except ValueError: continue
        raise AssertionError("Unsafe URL accepted: " + bad)
    assert safe_name("/game/heroes") == "game-heroes"
    assert "xyz" not in redact("https://example.org/path?token=xyz")
    assert _ROOT.joinpath("scripts/release-staging.sh").is_file()
    print("PASS: 66.59 QA tool source and safety checks (no browser, account, or AWS calls)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-check", action="store_true", help="Offline verification, no browser dependency or AWS calls")
    parser.add_argument("--url", help="Staging origin; otherwise read CloudFrontUrl via AWS CLI without SSO login")
    parser.add_argument("--output", help="Evidence directory OUTSIDE root/ (default sibling assets/AWS/visual-qa/)")
    parser.add_argument("--signed-in", action="store_true", help="Open Chrome to sign in and inspect protected routes too")
    parser.add_argument("--browser", default="chrome", help="Playwright browser channel 'chrome', 'bundled', or Chromium executable path")
    parser.add_argument("--headed", action="store_true", help="Show browser window (required with --signed-in)")
    parser.add_argument("--archive", action="store_true", help="Create a review ZIP next to the screenshot directory; review its contents before sharing")
    args = parser.parse_args()
    if args.self_check: return self_check()
    try:
        try: import playwright.sync_api  # noqa: F401
        except ImportError as exc:
            raise RuntimeError("Playwright not installed. Run scripts/run-inkscape-browser-qa.sh to bootstrap outside root/.") from exc
        base = safe_url(args.url) if args.url else find_staging_url()
        destination = output_dir(args.output)
        data = capture(base, args.signed_in, destination, args.browser, args.headed or args.signed_in)
        write_report(destination, data)
        if args.archive:
            archive_path = shutil.make_archive(str(destination), "zip", root_dir=destination)
            print("Review ZIP (screenshots may contain private data): " + archive_path)
        print(f"\nVisual QA report: {destination/'index.html'}")
        print(f"Capture warnings: {len(data['warnings'])}; interactive checks: {sum(x['passed'] for x in data['interaction_checks'])}/{len(data['interaction_checks'])}")
        print("NOT VISUALLY APPROVED: review screenshots manually against the supplied references.")
        return 0 if all("failure" not in x for x in data["screenshots"]) else 1
    except (RuntimeError, ValueError, OSError) as exc:
        print("QA BLOCKED: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__": raise SystemExit(main())
