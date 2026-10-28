"""Presentation-only contract: modal portal and fallback pages. No live gameplay files."""
from pathlib import Path
import re
from tests.support import PROJECT_ROOT
ROOT=Path(PROJECT_ROOT)

def read(path): return (ROOT/path).read_text(encoding='utf-8')

def test_shared_dialog_uses_one_inherited_theme_and_one_size_contract():
    sys=read('frontend/src/styles/inkboundSystemPass660.css')
    frame=read('frontend/src/styles/inkboundFramePass6610.css')
    assert 'width:min(760px,calc(100vw - 32px))' in sys
    assert 'width:min(1040px,calc(100vw - 28px))' not in frame
    assert 'backdrop-filter:blur(3px)' not in frame
    assert '#modal-root .inkbound-global-dialog::backdrop' in frame
    assert 'var(--ix-display-font,var(--ib-serif))' in sys
    assert 'var(--ix-focus,var(--ib-text))' in sys
    assert '.panel-heading .icon-button' in sys
    assert 'min-height:44px' in sys

def test_shared_dialog_does_not_override_gameplay_theater_or_arcade():
    installer=read('scripts/pass66_50_apply.py')
    targets=re.search(r'OPERATIONS = \{(.+?)\n\}',installer,re.S).group(1)
    for prohibited in ('app/main.py','director.py','AdventurePage.tsx','InkboundLiveRoom.tsx','Arcade','dice','useTurnTheater','gameSocket'):
        assert prohibited not in targets
    modal=read('frontend/src/state/ModalContext.tsx')
    for contract in ('aria-modal="true"','dialog.showModal()','openerRef.current?.isConnected','onCancel=','onClick='):
        assert contract in modal

def test_route_fallbacks_keep_recovery_and_user_theme():
    css=read('frontend/src/styles/components.css')
    for mode in ('cream','parchment','navy','midnight','phosphor'):
        assert f'.not-found.inkscape-route-state[data-ink-paper="{mode}"]' in css
    for page in ('NotFoundPage.tsx','RouteErrorPage.tsx'):
        src=read('frontend/src/pages/'+page)
        assert 'data-ink-paper={paper}' in src
        assert 'useInkboundPaper(user?.user_id ?? "")' in src
        assert 'className="not-found inkscape-route-state"' in src
    assert 'window.location.reload()' in read('frontend/src/pages/RouteErrorPage.tsx')
    assert 'to="/game"' in read('frontend/src/pages/RouteErrorPage.tsx')
    assert 'to="/"' in read('frontend/src/pages/NotFoundPage.tsx')
