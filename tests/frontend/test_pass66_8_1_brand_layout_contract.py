"""Quillairo branding shell compile contracts (no external dependencies)."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend" / "src" / "layouts"
THEME_IMPORT = 'import { useInkboundPaper } from "../features/appearance/inkboundPaper";'


def test_brand_layouts_use_one_theme_hook_and_one_value():
    for name in ("GameLayout.tsx", "AccountLayout.tsx"):
        source = (FRONTEND / name).read_text(encoding="utf-8")
        assert source.count(THEME_IMPORT) == 1, name
        assert source.count('useInkboundPaper(user?.user_id ?? "")') == 1, name
        assert 'const [paper] = useInkboundPaper(user?.user_id ?? "");' in source, name
        assert 'brandPaper' not in source, name
        assert source.count('data-ink-paper={paper}') == 1, name


def test_game_shell_has_no_duplicate_jsx_theme_attribute():
    source = (FRONTEND / 'GameLayout.tsx').read_text(encoding='utf-8')
    shell = re.search(r'<div\s+className=\{`site-shell.*?>', source, flags=re.S)
    assert shell, 'GameLayout root must exist'
    attrs = re.findall(r'\b([a-z][a-z\d-]*)=', shell.group(0), flags=re.I)
    assert len(attrs) == len(set(attrs)), f'duplicate JSX props: {attrs}'


def test_account_uses_approved_logo_not_plain_text():
    source = (FRONTEND / 'AccountLayout.tsx').read_text(encoding='utf-8')
    assert 'import { BrandLockup }' in source
    assert '<BrandLockup />' in source
    assert 'aria-label="Quillairo home"' in source
    assert '<strong>QUILLAIRO</strong>' not in source
