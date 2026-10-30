"""Contracts for the production Inkbound home; standard library only.

These checks protect real socket/account wiring and design constraints. They do
not replace a full TypeScript build or browser acceptance test.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
HOME = (ROOT / 'frontend/src/pages/game/InkboundAuthenticatedDashboard.tsx').read_text()
PARENT = (ROOT / 'frontend/src/pages/game/GameHomePage.tsx').read_text()
CSS = (ROOT / 'frontend/src/pages/game/inkboundAuthenticatedDashboard.css').read_text()
THEMES = (ROOT / 'frontend/src/features/appearance/inkboundPaper.ts').read_text()
PICKER = (ROOT / 'frontend/src/features/appearance/InkboundPaperPreferences.tsx').read_text()


class InkboundHomeContracts(unittest.TestCase):
    def test_real_home_route_renders_live_dashboard(self):
        self.assertIn('if (!homeLab) return (', PARENT)
        self.assertIn('<InkboundAuthenticatedDashboard', PARENT)
        self.assertIn('onCreate={(item, mode)', PARENT)
        self.assertIn('createRoom(selectedHeroId, item.adventure_id, mode)', PARENT)
        self.assertIn('onJoin={(code)', PARENT)
        self.assertIn('joinRoom(selectedHeroId, code)', PARENT)
        self.assertIn('lastRoomEntry', PARENT)

    def test_directory_and_heroes_are_not_hardcoded(self):
        for field in ('heroes: Character[]', 'catalog: AdventureCatalogItem[]',
                      'adventures: AdventureListItem[]', 'selectedHeroId: string',
                      'directoryReady: boolean', 'connected: boolean'):
            self.assertIn(field, HOME)
        self.assertIn('useInkboundPaper(userId)', HOME)
        self.assertIn('tot:inkbound:paper:', THEMES)
        self.assertIn('encodeURIComponent(item.room_code)', HOME)
        self.assertIn('encodeURIComponent(item.character_id)', HOME)

    def test_six_requested_paper_options_live_in_account_preferences(self):
        for option in ('parchment', 'ivory', 'cream', 'navy', 'phosphor', 'midnight'):
            self.assertRegex(CSS, rf'\[data-ink-paper="{option}"\]')
            self.assertIn(f'id: "{option}"', THEMES)
        self.assertIn('aria-pressed={selectedPaper === paper.id}', PICKER)

    def test_coop_lobby_mechanics_unchanged(self):
        self.assertIn('onCreate(selectedStory,mode)', HOME)
        self.assertIn('mode === "coop"', HOME)
        self.assertIn('both players are ready', HOME)
        self.assertIn('type="radio"', HOME)
        self.assertIn('Enter the lobby', HOME)
        self.assertIn('onJoin(roomCode.trim().toUpperCase())', HOME)

    def test_hero_selection_remains_restricted(self):
        self.assertIn('hero.is_alive && hero.hero_status === "active"', HOME)
        self.assertIn('occupied.has(hero.character_id)', HOME)
        self.assertIn('!occupied.has(hero.character_id)', HOME)
        self.assertGreaterEqual(HOME.count('onChange={onSelectHero}'), 3)
        self.assertIn('disabled={!canEnter}', HOME)

    def test_no_flattened_art_or_feather_mask(self):
        self.assertIn('/art/inkbound/north-road-editorial.png', HOME)
        self.assertIn('alt="Two wanderers', HOME)
        for banned in ('mask-image:', 'radial-gradient(', 'clip-path:', 'mix-blend-mode:screen'):
            self.assertNotIn(banned, CSS)
        self.assertNotIn('position:absolute', HOME)

    def test_modal_is_accessible(self):
        for part in ('aria-modal="true"', 'role="dialog"', 'aria-labelledby=',
                     'event.key === "Escape"', 'event.key !== "Tab"',
                     'modalOpener.current?.focus()', 'modalCloseRef.current?.focus()'):
            self.assertIn(part, HOME)

    def test_navigation_has_real_targets(self):
        for target in ('/game/heroes/new', '/game/graveyard', '/game/adventures',
                       '/game/arcade', '/game/rulebook', '/account'):
            self.assertIn(target, HOME)
        self.assertIn('onClick={onLogout}', HOME)

    def test_transparency_not_an_opaque_canvas(self):
        import struct
        image = ROOT / 'frontend/public/art/inkbound/north-road-editorial.png'
        data = image.read_bytes()
        self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n')
        width, height, depth, color = struct.unpack('>IIBB', data[16:26])
        self.assertGreaterEqual(width, 1200)
        self.assertGreaterEqual(height, 600)
        self.assertEqual(color, 6, 'Hero art must be true RGBA, not RGB/opaque')
        self.assertEqual(depth, 8)


if __name__ == '__main__':
    unittest.main()
