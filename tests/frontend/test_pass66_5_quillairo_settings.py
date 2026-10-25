"""Pass 66.5 settings surface contracts; never replace real handlers with mock toggles."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
ACCOUNT = (ROOT / "frontend/src/pages/account/AccountPage.tsx").read_text()
SETTINGS = (ROOT / "frontend/src/pages/account/SettingsPage.tsx").read_text()
STYLE = (ROOT / "frontend/src/pages/account/quillairoSettingsPass665.css").read_text()
ACCOUNT_LAYOUT = (ROOT / "frontend/src/layouts/AccountLayout.tsx").read_text()
PAPERS = (ROOT / "frontend/src/features/appearance/inkboundPaper.ts").read_text()


def test_real_account_preferences_uses_mockup_page_composition():
    for target in ["quill-settings-page", "quill-settings-intro", "quill-settings-content", "quill-settings-index"]:
        assert target in ACCOUNT
    for target in ['"#ink-settings-storytime"', '"#inkbound-paper"', '"#ink-settings-reading"', '"#ink-settings-gameplay"', '"#ink-settings-notifications"']:
        assert target in ACCOUNT
    assert '<SettingsPage section="preferences" />' in ACCOUNT
    assert '<SettingsPage section="notifications" />' in ACCOUNT
    assert "<InkboundPaperPreferences />" in ACCOUNT
    assert "<AppearanceWardrobe />" in ACCOUNT
    assert "quillairoSettingsPass665.css" in ACCOUNT


def test_service_connections_are_original_and_live():
    for contract in [
        "writeAudioPreferences(next)", "prepareStoryTime()", "stopStoryTimeEngine()",
        "playNarration([{", "stopNarration", "NarratorVoicePicker", "playSound(\"critical\")",
        "writeStoryDisplayPreferences", "getNotificationSettings()", "saveNotificationSettings(next)",
        "enableWebPush()", "disableWebPush()", "requestSmsVerification(phoneDraft)",
        "verifySmsCode(verificationCode.trim())", "readNotificationPreferences()",
    ]:
        assert contract in SETTINGS
    for label in ["STORY TIME // YOUR STORYTELLER", "STORY DISPLAY", "AUDIO // YOUR ADVENTURE", "REAL-WORLD ADVENTURE NOTIFICATIONS"]:
        assert label in SETTINGS


def test_theme_selector_remains_shared_not_duplicated():
    assert "useInkboundPaper" in PAPERS
    assert "InkboundPaperPreferences" in ACCOUNT
    for name in ('"ivory"', '"cream"', '"parchment"', '"navy"', '"phosphor"', '"midnight"'):
        assert name in PAPERS
    assert 'data-ink-paper={paper}' in ACCOUNT_LAYOUT
    # Pass 66.8 replaces the provisional plain-text brand with the approved
    # asset-backed lockup. Keep testing the real brand, not retired markup.
    assert 'import { BrandLockup } from "../components/brand/BrandLockup";' in ACCOUNT_LAYOUT
    assert '<BrandLockup paper={paper} />' in ACCOUNT_LAYOUT
    assert 'aria-label="Quillairo home"' in ACCOUNT_LAYOUT
    assert '<strong>QUILLAIRO</strong>' not in ACCOUNT_LAYOUT
    lockup = (ROOT / "frontend/src/components/brand/BrandLockup.tsx").read_text(encoding="utf-8")
    assert '/brand/primary-light.png' in lockup
    assert '/brand/secondary-dark.png' in lockup


def test_settings_layout_is_responsive_and_has_no_text_covering_illustration():
    assert "grid-template-columns:minmax(238px,25%) minmax(0,1fr)" in STYLE
    assert "flex-direction:column" in STYLE  # Inkspace folio: one readable manuscript column
    assert "@media (max-width:950px)" in STYLE
    assert "@media (max-width:720px)" in STYLE
    assert "@media(max-width:430px)" in STYLE
    assert "min-width:0" in STYLE
    assert "pointer-events:none" in STYLE
    assert "--ib-paper" in (ROOT / "frontend/src/styles/inkboundSystemPass660.css").read_text()
    # Avoid decorative handwriting overlays or theme-dependent white rectangle masks.
    assert "mix-blend-mode" not in STYLE
    assert "mask-image" not in STYLE
    assert "filter:blur" not in STYLE
    assert "window.confirm" not in ACCOUNT + SETTINGS


def test_controls_stay_native_accessible_inputs_with_custom_visual_treatment():
    assert 'checked={audio.effectsEnabled}' in SETTINGS
    assert 'checked={audio.narrationEnabled}' in SETTINGS
    assert 'checked={storyDisplay.wordReveal}' in SETTINGS
    assert 'checked={preferences.inApp}' in SETTINGS
    assert 'type="range"' in SETTINGS
    assert 'input:focus-visible' in STYLE
    assert 'input[type="checkbox"]:checked:after' in STYLE
    assert 'prefers-reduced-motion:reduce' in STYLE


def test_only_account_preferences_receives_new_full_page_layout():
    assert 'activeTab === "preferences" ? <div className="quill-settings-page">' in ACCOUNT
    assert 'activeTab === "profile" ? <ProfileTab />' in ACCOUNT
    assert 'activeTab === "security" ? <SecurityTab />' in ACCOUNT
    assert 'activeTab === "billing" ? <BillingTab />' in ACCOUNT
    assert 'activeTab === "notifications" ? <SettingsPage section="notifications" />' in ACCOUNT
    # Presence of the original sensitive account actions matters more than a skin.
    for contract in ["changePassword(", "updateProfile(", "logoutOtherSessions(", "deleteAccount("]:
        assert contract in ACCOUNT


def test_new_relative_css_import_resolves():
    for source in (ACCOUNT, SETTINGS):
        for target in re.findall(r'import\s+["\'](\.[^"\']+\.css)["\']', source):
            file_path = (ROOT / 'frontend/src/pages/account' / target).resolve()
            assert file_path.is_file(), f"Missing import: {target}"


def test_embedded_notifications_does_not_duplicate_story_time_startup():
    assert 'section !== "notifications" && audio.narrationEnabled' in SETTINGS
    assert 'section === "notifications" ? undefined : observeStoryTime(setStoryTime)' in SETTINGS
    assert 'if (section === "preferences") return;' in SETTINGS
