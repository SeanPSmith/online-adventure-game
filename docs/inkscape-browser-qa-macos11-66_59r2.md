# Pass 66.59 R2 — macOS 11 Playwright compatibility

The first visual capture on macOS 11 (Big Sur) failed while launching Playwright's *bundled* Node binary, which referenced a libc++ symbol available only on newer macOS releases. This happens before Chrome starts and is not a problem with Quillairo's React bundle or AWS staging.

The `scripts/run-inkscape-browser-qa.sh` runner now detects macOS versions before 14 and uses Playwright `1.55.0` in the existing isolated `../assets/AWS/.qa-venv`, with `PLAYWRIGHT_NODEJS_PATH` pointing to a local Node.js 18+ executable. Playwright 1.55.0 declares Node.js >=18 compatibility and has Python macOS 11 wheels. System Chrome is used for captures (the QA script's `--browser chrome` default); no browser download, operating-system upgrade or system-wide Node change is required.

From `root/`, once this patch is applied:

```bash
bash scripts/run-inkscape-browser-qa.sh --archive
```

To also inspect protected routes:

```bash
bash scripts/run-inkscape-browser-qa.sh --signed-in --archive
```

Keep screenshot evidence under `assets/AWS/visual-qa` outside Git. The QA venv may download a compatible Python package when first running R2. The tool does not modify deployment, gameplay, auth, browser login data, or AWS. If the installed Node is unavailable/older than 18, the runner stops with actionable error instead of attempting a system upgrade.

This is a runtime compatibility workaround, not a certification that every Playwright version or browser is supported indefinitely on Big Sur. Actual Chrome capture must still be verified on the Mac.
