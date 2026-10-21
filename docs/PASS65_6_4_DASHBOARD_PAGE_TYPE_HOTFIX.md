# Pass 65.6.4 — Inkbound dashboard TypeScript build hotfix

Restores the strongly typed dashboard navigation alias `Page` accidentally
removed when the paper palette selector was moved to Account Preferences.
It fixes TypeScript TS2304 in `InkboundAuthenticatedDashboard.tsx` without
changing dashboard presentation, gameplay callbacks, or the palette picker.

Includes a dependency-free regression test for the alias and navigation values.
This incremental overlay applies on top of Pass 65.6.3.

Install and deploy from the project root:

```bash
bash scripts/install-overlay.sh ../assets/AWS/pass65_6_4_dashboard_page_type_hotfix.zip && \
  ./scripts/release-staging.sh "Pass 65.6.4: Fix Inkbound dashboard TypeScript page type"
```

The deployment script runs the full checks before pushing or deploying.
