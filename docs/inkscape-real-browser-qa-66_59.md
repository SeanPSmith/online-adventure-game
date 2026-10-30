# Quillairo — Pass 66.59: real-browser parity evidence

## Why this pass exists
Source and visual-token audits (66.57/66.58) do **not** prove visual parity with the nine approved October 23 images. This pass captures real browser renders and gives reviewable evidence without changing gameplay or restyling successful illustration.

## Run from `root/`

After deploying 66.59, run:

```bash
bash scripts/run-inkscape-browser-qa.sh --archive
```

The tool reads the *existing* AWS CloudFormation CloudFrontUrl with the `adventure-staging` profile. It **never launches AWS SSO login**. If that read is unavailable, provide the site origin explicitly:

```bash
bash scripts/run-inkscape-browser-qa.sh --url https://YOUR-STAGING-DOMAIN
```

Chrome must be installed (standard Google Chrome). The script creates an isolated Python QA environment at `assets/AWS/.qa-venv` only when missing. No Playwright or screenshot assets are added to the deployed app. Captures and `index.html` review sheet are saved in `assets/AWS/visual-qa/pass66_59-*` outside the project Git repo. The `--archive` option creates a ZIP next to that folder for review or upload.

To capture protected routes too, opt into an interactive fresh Chrome session:

```bash
bash scripts/run-inkscape-browser-qa.sh --signed-in
```

Sign into *your staging account* in that browser window. Do not type credentials in the terminal or share them here. The script waits until it sees the authenticated Adventure Hall and then captures Hero Hall, creation, adventures, history, account, author and admin routes. Some may redirect based on permissions and are flagged. Browser session is ephemeral; **no passwords, bearer tokens, cookies, HAR, storage state or secrets are exported**. Screenshots can contain private story or hero data. Review before sharing.

## Coverage / review gates

- Captures 1440, 768, 390 and 320 pixel-wide windows, full page up to 12,000px height.
- Checks overflow, missing visible images, page errors, route redirects and the mobile menu Escape behavior and sample-choice interaction.
- Comparison against the nine approved reference images requires *human visual review* at thumbnail and full-size: visual focal point, layout clarity, responsive forms, illustration/text boundaries, appropriate gold, coherent material, quiet negative space, and no universal fake distress.
- Public auth and password recovery are reviewed separately. Recovery is still unimplemented in 66.58 and is a public-launch blocker.
- A full live adventure must still be played through story → choice → intermission → dice → outcome → next story. This pass does not touch that code or certify it automatically.
- Signed-in verification includes all themes and real permission states. Do not claim launch approval until these are completed.

No React, backend, game, database, auth, AI, narration, multiplayer, or AWS configuration files are modified by this pass.
