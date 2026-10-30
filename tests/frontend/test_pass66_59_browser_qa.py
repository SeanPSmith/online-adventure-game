"""No-playwright, no-network safety checks for opt-in staging browser QA."""
from pathlib import Path
import importlib.util
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
QA = ROOT / 'scripts/inkscape-browser-qa.py'
WRAPPER = ROOT / 'scripts/run-inkscape-browser-qa.sh'


def load():
    spec = importlib.util.spec_from_file_location('inkscape_browser_qa_6659', QA)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_read_only_static_self_check():
    result = subprocess.run([sys.executable, str(QA), '--self-check'], cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'PASS' in result.stdout


def test_no_auth_artifacts_or_deploy_mutation():
    src = QA.read_text()
    shell = WRAPPER.read_text()
    assert 'storage_state(' not in src
    assert 'cookies()' not in src
    assert 'context.storage_state' not in src
    assert '--signed-in' in src and 'headless' in src
    assert 'temp' not in shell or '.qa-venv' in shell
    assert 'release-staging.sh' not in shell
    assert 'aws sso login' not in src and 'aws sso login' not in shell


def test_sources_observed_66_58_baseline():
    assert (ROOT / 'frontend/src/styles/inkscapeLaunchPolishPass6658.css').is_file()
    assert (ROOT / 'frontend/src/styles/inkscapeSitewideQaPass6657.css').is_file()
    assert 'inkscape-browser-qa.py --self-check' in (ROOT / 'scripts/check-project.sh').read_text()


def test_expected_routes_screen_sizes():
    mod = load()
    assert '/game/heroes' in mod.PRIVATE_ROUTES
    assert '/forgot-password' in mod.PUBLIC_ROUTES
    assert {320,390,768,1440} == {v[1] for v in mod.VIEWPORTS}
    assert mod.safe_name('/game/heroes') == 'game-heroes'


def test_url_restrictions():
    mod = load()
    for bad in ('https://example.org/?secret=1', 'https://user:password@example.org/', 'http://example.org', 'https://example.org/other'):
        try: mod.safe_url(bad)
        except ValueError: pass
        else: assert False, f'accepted unsafe URL {bad}'


def test_redaction():
    mod = load()
    assert 'secret123' not in mod.redact('Authorization: secret123')
    assert 'xyz123' not in mod.redact('https://host.tld/path?token=xyz123')


def test_wrapper_only_writes_qa_venv_outside_project():
    shell = WRAPPER.read_text()
    assert 'assets/AWS/.qa-venv' in shell
    assert 'playwright' in shell
    assert 'exec "$ENV_DIR/bin/python" scripts/inkscape-browser-qa.py "$@"' in shell
