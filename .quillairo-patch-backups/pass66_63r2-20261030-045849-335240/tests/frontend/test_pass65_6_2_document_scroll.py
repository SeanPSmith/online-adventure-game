"""Pass 65.6.2: the real Inkbound dashboard scrolls as a document.

Uses the Python standard library; does not introduce Playwright/Pillow into the
project's release dependencies. A browser interaction check accompanies the pass.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
CSS = (ROOT / 'frontend/src/pages/game/inkboundAuthenticatedDashboard.css').read_text(encoding='utf-8')
LEGACY = (ROOT / 'frontend/src/pages/game/livingBook644.css').read_text(encoding='utf-8')
DASHBOARD = (ROOT / 'frontend/src/pages/game/GameHomePage.tsx').read_text(encoding='utf-8')
LAYOUT = (ROOT / 'frontend/src/layouts/GameLayout.tsx').read_text(encoding='utf-8')


def declarations(selector: str) -> str:
    result = re.search(re.escape(selector) + r'\s*\{([^{}]+)\}', CSS)
    assert result is not None, f'Missing scoped style for {selector}'
    return result.group(1)


class InkboundDocumentScrollContracts(unittest.TestCase):
    SHELL = '.game-site-shell.p64-shell.is-inkspace-home'
    MAIN = SHELL + ' .game-main'

    def test_real_dashboard_remains_inside_existing_game_layout(self):
        self.assertIn('if (!homeLab) return (', DASHBOARD)
        self.assertIn('<InkboundAuthenticatedDashboard', DASHBOARD)
        self.assertIn('isDeskHome', LAYOUT)
        self.assertIn('isInkspaceHome', LAYOUT)
        self.assertIn('is-inkspace-home', LAYOUT)
        self.assertIn('className="game-main"', LAYOUT)

    def test_legacy_desktop_shell_still_constrains_old_book(self):
        self.assertIn('height:100dvh!important;min-height:0!important;max-height:100dvh;overflow:hidden!important', LEGACY)
        self.assertIn('overflow:hidden!important', LEGACY)
        self.assertIn('homeLab', DASHBOARD)

    def test_only_real_inkbound_shell_releases_viewport(self):
        style = declarations(self.SHELL)
        for required in ('height:auto!important', 'min-height:100dvh!important',
                         'max-height:none!important', 'overflow:visible!important'):
            self.assertIn(required, style)
        self.assertNotIn('overflow-x:hidden', style)

    def test_main_expands_and_releases_overflow(self):
        style = declarations(self.MAIN)
        for required in ('height:auto!important', 'max-height:none!important',
                         'overflow:visible!important', 'flex:1 0 auto'):
            self.assertIn(required, style)

    def test_inkbound_contents_use_normal_document_flow(self):
        self.assertIn('.inkbound-home{', CSS)
        self.assertIn('min-height:100vh;width:100%', CSS)
        self.assertIn('.i656-main{padding-bottom:50px;min-height:65vh}', CSS)
        self.assertNotIn('height:100dvh', declarations('.inkbound-home'))
        self.assertNotIn('overflow:hidden', declarations('.inkbound-home'))
        self.assertNotIn('position:fixed', declarations('.inkbound-home'))


if __name__ == '__main__':
    unittest.main()
