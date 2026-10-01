from __future__ import annotations

import unittest
from pathlib import Path


class AuthorUiRegressionTests(unittest.TestCase):

    def test_author_fields_enable_native_spellcheck(self) -> None:
        html = Path("app/web/author/index.html").read_text()
        js = Path("app/web/author/author.js").read_text()

        self.assertIn('spellcheck="true"', html)
        self.assertIn('control.spellcheck = true', js)


    def test_author_console_exposes_ai_population_controls(self) -> None:
        html = Path("app/web/author/index.html").read_text()
        js = Path("app/web/author/author.js").read_text()

        self.assertIn('id="author-assist-prompt"', html)
        self.assertIn('id="author-assist-button"', html)
        self.assertIn('AI POPULATE GAPS', html)
        self.assertIn('AI EXPAND', js)
        self.assertIn('/api/author/assist', js)

    def test_npc_editor_exposes_structured_canon_controls(self) -> None:
        js = Path("app/web/author/author.js").read_text()

        for field in (
            '"availability"',
            '"introduction_timing"',
            '"occupation"',
            '"introduction_conditions"',
            '"location_constraints"',
            '"forbidden_uses"',
        ):
            self.assertIn(field, js)
