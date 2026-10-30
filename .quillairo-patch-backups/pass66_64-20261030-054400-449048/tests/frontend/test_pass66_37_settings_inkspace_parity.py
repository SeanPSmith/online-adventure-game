"""Pass 66.37: Inkspace settings remains fully functional and never reverts to legacy styling."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
READ = lambda path: (ROOT / path).read_text(encoding="utf-8")


def test_current_settings_folio_and_anchors():
    account = READ("frontend/src/pages/account/AccountPage.tsx")
    css = READ("frontend/src/pages/account/quillairoSettingsPass665.css")
    assert 'className="quill-settings-page"' in account
    for anchor in ("#inkbound-paper", "#ink-settings-storytime", "#ink-settings-reading",
                   "#ink-settings-gameplay", "#ink-settings-notifications", "#quill-settings-ai", "#wardrobe"):
        assert anchor in account
    assert '.quill-settings-content>.quill-settings-panels{display:contents}' in css
    assert '.quill-settings-content>.inkpaper-preferences{order:10}' in css
    assert '.quill-settings-storytime{order:20}' in css
    assert 'grid-template-columns:minmax(238px,25%) minmax(0,1fr)' in css
    assert '@media (max-width:950px)' in css and '@media(max-width:430px)' in css
    assert 'pointer-events:none' in css


def test_legacy_wardrobe_controls_not_removed_or_faked():
    widget = READ("frontend/src/features/appearance/AppearanceWardrobe.tsx")
    for contract in ("useAppearance()", "EDITION_FAMILIES.map", "PLATFORM_SKINS.map",
                     "INCLUDED_PACKS", "equipTheme(", "updateAppearance(", "installTheme(",
                     "removeTheme(", "saveJSON(", "parseThemePack(", "TerminalSelect", "input type=\"color\""):
        assert contract in widget, contract
    wardrobe = READ("frontend/src/features/appearance/wardrobe.css")
    editor = READ("frontend/src/features/appearance/themeWorkshop.css")
    assert 'background:linear-gradient(125deg,#281b16,#0f1217)' not in wardrobe
    assert 'background:#271914' not in wardrobe
    assert 'background:#261a1538' not in editor
    for source in (wardrobe, editor):
        assert 'var(--ib-text)' in source
        assert 'var(--ib-line)' in source


def test_settings_services_and_access_control_unchanged():
    settings = READ("frontend/src/pages/account/SettingsPage.tsx")
    ai = READ("frontend/src/pages/account/GlobalAiModelSettings.tsx")
    for preserved in ("saveNotificationSettings(next)", "enableWebPush()", "disableWebPush()",
                      "requestSmsVerification(phoneDraft)", "verifySmsCode(verificationCode.trim())",
                      "writeStoryDisplayPreferences", "writeAudioPreferences(next)",
                      "stopStoryTimeEngine()", "NarratorVoicePicker", "playNarration([{"):
        assert preserved in settings
    assert 'isAdmin ? <GlobalAiModelSettings />' in settings
    assert 'saveGlobalAiModels(story, recap)' in ai
    assert 'compact terminal notices' not in settings.lower()
    assert '(^_^)/' not in settings and ':/' not in settings


def test_settings_remain_theme_aware_and_accessible():
    css = READ("frontend/src/pages/account/quillairoSettingsPass665.css")
    ai = READ("frontend/src/pages/account/quillairoAiModels.css")
    for color in ('navy', 'midnight', 'phosphor'):
        assert f'data-ink-paper="{color}"' in css
    assert 'input[type="checkbox"]:checked:after' in css
    assert 'input:focus-visible' in css
    assert 'prefers-reduced-motion:reduce' in css
    assert 'aria-pressed' in READ("frontend/src/features/appearance/AppearanceWardrobe.tsx")
    assert 'aria-pressed' in READ("frontend/src/pages/account/GlobalAiModelSettings.tsx")
    assert 'focus-visible' in ai
