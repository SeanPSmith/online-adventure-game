from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def test_installer_has_no_node_or_jsx_rewrite_dependency():
    src=(ROOT/'scripts/pass66_52_apply.py').read_text()
    assert 'subprocess.run' not in src
    assert 'wrap_history_ast(' not in src
    assert 'wrap_page(' not in src
    assert 'ScriptTarget.' not in src
    assert 'pass66_52_jsx_probe.cjs' not in src
    assert 'ensure_style_import' in src

def test_only_archive_page_imports_and_presentation_copy_are_mutated():
    import importlib.util,sys
    spec=importlib.util.spec_from_file_location('patchr3', ROOT/'scripts/pass66_52_apply.py')
    mod=importlib.util.module_from_spec(spec);sys.modules[spec.name]=mod;spec.loader.exec_module(mod)
    sample="import A from 'a';\nconst example = () => <CustomLayout/>;\n// PageTitle Panel history-card ShareMomentButton ArchivedChronicleAudio listCharacterStories(\n"
    actual=mod.update(mod.CHRONICLES,sample)
    assert 'const example = () => <CustomLayout/>;' in actual
    assert actual.count('import "./inkscapeArchivePass6652.css";')==1
    assert mod.update(mod.CHRONICLES,actual)==actual
