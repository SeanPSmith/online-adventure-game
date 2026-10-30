"""Pass 66.59 R2: ensure our Big Sur browser QA fix stays isolated and safe."""
from pathlib import Path
import subprocess
import os
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[2]
WRAPPER = ROOT / 'scripts/run-inkscape-browser-qa.sh'


def test_macos_big_sur_dependency_compatibility_isolation():
    source = WRAPPER.read_text()
    assert "PW_PIN='1.55.0'" in source
    assert 'PLAYWRIGHT_NODEJS_PATH' in source
    assert 'MACOS_MAJOR < 14' in source
    assert 'assets/AWS/.qa-venv' in source
    assert 'release-staging.sh' not in source
    assert 'aws sso' not in source
    assert 'exec "$ENV_DIR/bin/python" scripts/inkscape-browser-qa.py "$@"' in source
    assert '--signed-in' not in source  # sign-in remains opt-in at the Python CLI


def test_runner_macos_11_pins_and_overrides_driver_without_real_pip_or_browser(tmp_path):
    # Execute the real bash wrapper in a fake tree. No network/pip/browser/AWS.
    root = tmp_path/'root'
    scripts = root/'scripts'
    scripts.mkdir(parents=True)
    wrapper = scripts/'run-inkscape-browser-qa.sh'
    shutil.copy2(WRAPPER, wrapper)
    (scripts/'inkscape-browser-qa.py').write_text('pass\n')
    bindir = tmp_path/'bin'
    bindir.mkdir()
    logfile = tmp_path/'calls.txt'
    def executable(name, body):
        path = bindir/name
        path.write_text('#!/bin/bash\n'+body)
        path.chmod(0o755)
        return path
    executable('uname', 'echo Darwin\n')
    executable('sw_vers', 'echo 11.7.10\n')
    fake_node = executable('node', 'if [[ "$1" == "-v" ]]; then echo v18.18.0; else echo 18; fi\n')
    python = executable('python3', 'echo "system-python $*" >> "$QA_TEST_LOG"\n')
    envdir=tmp_path/'qa-venv'
    (envdir/'bin').mkdir(parents=True)
    executable_path=envdir/'bin'/'python'
    executable_path.write_text('#!/bin/bash\necho "qa-python $*; node=${PLAYWRIGHT_NODEJS_PATH:-missing}" >> "$QA_TEST_LOG"\nif [[ "$1" == "-c" ]]; then echo 1.64.1; fi\n')
    executable_path.chmod(0o755)
    env=os.environ.copy()
    env['PATH']=str(bindir)+':'+env.get('PATH','')
    env['PYTHON_BIN']=str(python)
    env['QUILLAIRO_QA_VENV']=str(envdir)
    env['QA_TEST_LOG']=str(logfile)
    env.pop('PLAYWRIGHT_NODEJS_PATH', None)
    result=subprocess.run(['bash',str(wrapper),'--archive'],cwd=root,env=env,capture_output=True,text=True)
    assert result.returncode==0, result.stderr + result.stdout
    calls=logfile.read_text()
    assert 'pip install --disable-pip-version-check --quiet playwright==1.55.0' in calls
    assert 'node='+str(fake_node) in calls
    assert 'scripts/inkscape-browser-qa.py --archive' in calls
    assert 'Big Sur-compatible' in result.stdout
