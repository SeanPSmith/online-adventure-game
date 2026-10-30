"""Pass 66.56 — Account, Settings and Admin UI-only regression contracts."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]

def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def test_account_tabs_link_to_active_accessible_panel():
    account = read("frontend/src/pages/account/AccountPage.tsx")
    for required in (
        'id={`q56-account-tab-${tab}`}',
        'aria-controls="q56-account-tabpanel"',
        'id="q56-account-tabpanel"',
        'aria-labelledby={`q56-account-tab-${activeTab}`}',
        'setSearchParams(next, { replace: true })',
        'role="status"',
    ):
        assert required in account, required
    assert 'T2</div>' not in account, "Legacy Tales of Two monogram returned"
    assert '(^_^)/' not in account
    assert 'setStatus(`:/ ' not in account


def test_account_real_self_service_actions_preserved():
    account = read("frontend/src/pages/account/AccountPage.tsx")
    for required in (
        'authApi.updateProfile(', 'authApi.changePassword(', 'authApi.deleteAccount(',
        'authApi.logoutOtherSessions()', 'authApi.getAccountUsage()',
        '<SettingsPage section="preferences" />',
        '<SettingsPage section="notifications" />',
        '<InkboundPaperPreferences />', '<AppearanceWardrobe />',
        'SAVE PROFILE', 'CHANGE PASSWORD', 'SIGN OUT OTHER DEVICES',
        'DELETE ACCOUNT PERMANENTLY', 'NO PAYMENT METHOD REQUIRED',
    ):
        assert required in account, required


def test_admin_sections_navigate_to_real_existing_sections():
    admin = read("frontend/src/pages/admin/AdminPage.tsx")
    keys = ("operations", "diagnostics", "activity", "spend", "narration", "accounts", "import")
    for key in keys:
        assert f'href="#q56-admin-{key}"' in admin
        assert f'id="q56-admin-{key}"' in admin
    assert '<OperationsDashboard />' in admin
    assert '<PlaytestDiagnostics />' in admin
    assert 'isAdmin' in admin and '<Navigate to="/game" replace />' in admin
    assert 'getAdminAnalytics' in admin and 'getAdminUsage' in admin
    assert 'getAdminNarrationUsage' in admin


def test_admin_mutation_guards_and_confirmation_remain_real():
    admin = read("frontend/src/pages/admin/AdminPage.tsx")
    for required in (
        'setAuthorAccess(target.user_id, !currentlyAuthor)',
        'setAccountActive(target.user_id, !target.is_active)',
        'setUserEntitlement(userId, {',
        'onClick={() => setPendingAccount(target)}',
        'onClick={() => void toggleAccount(pendingAccount)}',
        'disabled={busy || isTargetAdmin}',
        'importAuthorContent(bundle, authorMap)',
        'await loadUsers(search)',
    ):
        assert required in admin, required


def test_themed_styles_are_scoped_and_avoid_invented_visual_effects():
    account = read("frontend/src/pages/account/inkscapeAccountPass6656.css")
    admin = read("frontend/src/pages/admin/inkscapeAdminPass6656.css")
    assert '.inkbound-account-shell' in account and '.inkbound-account-shell' in admin
    for source in (account, admin):
        assert 'var(--ib-text)' in source and 'var(--ib-line)' in source
        assert 'linear-gradient' not in source and 'text-shadow' not in source
        assert 'box-shadow:0 ' not in source
        assert '@media' in source
    assert ':focus-visible' in account and ':focus-visible' in admin
    assert 'prefers-reduced-motion:reduce' in account
    assert 'quill-settings-index a' in account


def test_source_is_presentation_only_and_no_async_or_backend_shims():
    account = read("frontend/src/pages/account/AccountPage.tsx")
    admin = read("frontend/src/pages/admin/AdminPage.tsx")
    assert '"./inkscapeAccountPass6656.css"' in account
    assert '"./inkscapeAdminPass6656.css"' in admin
    assert not re.search(r'\b(?:fetch|XMLHttpRequest)\s*\(', account + admin)
