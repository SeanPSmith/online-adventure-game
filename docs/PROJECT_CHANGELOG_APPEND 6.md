## 2026-09-30 — Admin Control Room + Author Content Portability Pass

### Practical changes
- Added durable `admin` permission bootstrap support via `TOT_ADMIN_USER_IDS` / `TOT_ADMIN_USERNAMES`.
- Staging now bootstraps `SeanSteezy` as `admin` + `author` + `publish` without making admin privilege browser-delegable.
- Added protected admin APIs for user search and Author/Publish grant/revoke, including an explicit denial marker so revocation overrides legacy document-ownership fallback.
- Added React `/admin` control room with permission management and legacy content import UI.
- Exposed the existing full Python Author editor through `/author-console` behind CloudFront, including `/static/author/*` routing.
- Updated Author write-origin validation for same-origin requests behind CloudFront while retaining custom write-header CSRF protection.
- Added a portable legacy Author-content exporter for SQLite worlds, briefs, versions, and generated/public adventures.
- Added atomic cloud import with editable legacy-username → cloud-username ownership remapping and explicit refusal when any resolved author account is missing.
- Deliberately did not pre-authorize the unclaimed `Princess_Athena` username while public registration remains open.

### Validation
- Focused backend compatibility/admin/content portability suite: 13/13 passing.
- Python compilation passed for all new/modified backend modules and exporter script.
