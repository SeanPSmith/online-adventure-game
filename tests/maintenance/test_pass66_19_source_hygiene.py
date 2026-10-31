"""Pass 66.19: protect source dependencies and safely retire orphaned modules."""
from __future__ import annotations

import importlib.util
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_DIR = ROOT / "scripts"


def load_script(name: str):
    path = SCRIPT_DIR / name
    spec = importlib.util.spec_from_file_location(name.removesuffix(".py").replace("-", "_"), path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def sample_root(tmp_path: Path, module):
    root = tmp_path / "root"
    for name in module.RETIRED:
        dest = root / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, dest) if (ROOT / name).exists() else None
    main = root / "frontend/src/main.tsx"
    main.parent.mkdir(parents=True, exist_ok=True)
    main.write_text('import { router } from "./router";\n', encoding='utf-8')
    return root


def test_auditor_resolves_static_imports_and_artwork():
    auditor = load_script('audit-source-hygiene.py')
    issues, duplicates, asset_refs = auditor.audit(ROOT)
    assert issues == []
    # Static references legitimately decrease as obsolete artwork and themes are retired.
    # Validate actual source and asset integrity rather than an arbitrary catalog size.
    assert asset_refs > 0, "The audit must inspect at least one real art/brand URI"
    assert any('brand/favicon.ico' in group for group in duplicates)


def test_retired_modules_removed_from_release_tree():
    pruner = load_script('prune-retired-source.py')
    # Running the source cleanup is a required step before staging release.
    assert all(not (ROOT / name).exists() for name in pruner.RETIRED)


def pinned_fixture(tmp_path, pruner, monkeypatch):
    """Synthetic retired modules pinned by SHA, so the tests never depend on local backup folders."""
    import hashlib
    root = tmp_path / "root"
    pinned = {}
    for name in pruner.RETIRED:
        body = f"// synthetic retired module {name}\n".encode()
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        pinned[name] = hashlib.sha256(body).hexdigest()
    main = root / "frontend/src/main.tsx"
    main.write_text('import { router } from "./router";\n', encoding="utf-8")
    monkeypatch.setattr(pruner, "RETIRED", pinned)
    return root


def test_pruner_dry_run_and_idempotent_apply(tmp_path, monkeypatch):
    pruner = load_script('prune-retired-source.py')
    root = pinned_fixture(tmp_path, pruner, monkeypatch)
    assert pruner.clean(root, apply=False) == 0
    assert all((root / name).exists() for name in pruner.RETIRED)
    assert pruner.clean(root, apply=True) == 0
    assert all(not (root / name).exists() for name in pruner.RETIRED)
    assert all((root / '_cleanup-backups/pass66_19' / name).exists() for name in pruner.RETIRED)
    assert pruner.clean(root, apply=True) == 0


def test_pruner_rejects_local_edits_without_deleting_anything(tmp_path, monkeypatch):
    pruner = load_script('prune-retired-source.py')
    root = pinned_fixture(tmp_path, pruner, monkeypatch)
    name = next(iter(pruner.RETIRED))
    (root / name).write_text('LOCAL CUSTOM MODIFICATION', encoding='utf-8')
    assert pruner.clean(root, apply=True) == 2
    assert all((root / item).is_file() for item in pruner.RETIRED)


def test_pruner_blocks_referenced_features(tmp_path):
    pruner = load_script('prune-retired-source.py')
    root = sample_root(tmp_path, pruner)
    (root / 'frontend/src/main.tsx').write_text('import { BookPageTurn } from "./features/appearance/BookPageTurn";\n', encoding='utf-8')
    assert pruner.clean(root, apply=True) == 2


def test_auditor_detects_broken_import_and_missing_artwork(tmp_path):
    """Prevent a relaxed count check from masking real integrity problems."""
    auditor = load_script('audit-source-hygiene.py')
    root = tmp_path / 'broken-source'
    src = root / 'frontend/src'
    public = root / 'frontend/public'
    src.mkdir(parents=True)
    public.mkdir(parents=True)
    (src / 'main.tsx').write_text(
        'import { missing } from "./this-module-does-not-exist";\n'
        'export const art = "/art/missing-scene.webp";\n',
        encoding='utf-8',
    )
    issues, duplicates, asset_refs = auditor.audit(root)
    assert any('Missing relative module:' in issue for issue in issues), issues
    assert 'Missing explicit asset: /art/missing-scene.webp' in issues
    assert asset_refs == 1
    assert duplicates == []
