"""Guard the last-mile Quillairo reskin against legacy chrome regression."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "frontend/src"


def test_reskin_loads_after_existing_editorial_layers():
    main = (SOURCE / "main.tsx").read_text()
    new = 'import "./styles/quillairoLegacySurfacesPass6621.css";'
    assert main.count(new) == 1
    assert main.index('quillairoPublicPass6612.css') < main.index(new)
    assert main.index('quillairoInvitePass6613.css') < main.index(new)


def test_reskin_scopes_shared_chrome_not_live_reader_or_arcade_engine():
    stylesheet = (SOURCE / "styles/quillairoLegacySurfacesPass6621.css").read_text()
    assert '.inkbound-account-shell' in stylesheet
    assert '.game-site-shell:not(.is-desk-home):not(.is-adventure-mode)' in stylesheet
    assert '.arcade-lab-list-item' in stylesheet
    assert '.arcade-lab-meta' in stylesheet
    assert '.arcade-lab-game-shell {' not in stylesheet
    assert '.ibl-prose' not in stylesheet
    assert '.inkbound-live' not in stylesheet
    assert '.quillairo-lockup img' not in stylesheet
    assert '.not-found' in stylesheet


def test_every_active_paper_variant_has_accessible_chrome_values():
    stylesheet = (SOURCE / "styles/quillairoLegacySurfacesPass6621.css").read_text()
    for variant in ('cream', 'parchment', 'navy', 'phosphor', 'midnight'):
        assert f'data-ink-paper="{variant}"' in stylesheet
    assert '--qs-accent' in stylesheet
    assert 'focus-visible' in stylesheet
    assert 'min-height: 44px' in stylesheet
    assert 'prefers-reduced-motion' in stylesheet
    assert 'select option' in stylesheet


def test_admin_docs_no_longer_force_black_background_under_paper_skin():
    admin = (SOURCE / "pages/admin/AdminPage.css").read_text()
    assert 'background: #010601' not in admin
    assert 'background: var(--ib-paper, #010601)' in admin
    assert 'var(--ib-text, var(--green-soft))' in admin


def test_gameplay_interfaces_unchanged_by_reskin():
    # This pass intentionally only changes shared CSS, the style import, docs
    # and contract tests. Turn authority / story generation remain in previous passes.
    stylesheet = (SOURCE / "styles/quillairoLegacySurfacesPass6621.css").read_text()
    assert 'schedule_scene_art' not in stylesheet
    assert 'onSelectChoice' not in stylesheet
    assert 'dice' not in stylesheet.lower()
