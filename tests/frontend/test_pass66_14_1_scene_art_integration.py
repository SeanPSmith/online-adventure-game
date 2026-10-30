"""Pass 66.14.1: keep the reader presentational while preserving live scene art."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGES = ROOT / 'frontend' / 'src' / 'pages' / 'game'


def test_scene_art_polling_belongs_to_a_controller_not_reader():
    reader = (PAGES / 'InkboundLiveRoom.tsx').read_text(encoding='utf-8')
    page = (PAGES / 'AdventurePage.tsx').read_text(encoding='utf-8')
    hook = (ROOT / 'frontend' / 'src' / 'features' / 'adventure' / 'useSceneArtwork.ts').read_text(encoding='utf-8')
    for forbidden in ('fetch(', 'new WebSocket', 'socket.emit', 'import { useGameSocket'):
        assert forbidden not in reader
    assert 'useSceneArtwork(' in page
    assert 'sceneArtUrl={sceneArtUrl}' in page
    assert 'onSceneArtError={onSceneArtError}' in page
    assert 'AbortController' in hook and 'credentials: "same-origin"' in hook
    assert 'attempts < 36' in hook


def test_existing_figure_geometry_and_real_alpha_overlay_are_preserved():
    reader = (PAGES / 'InkboundLiveRoom.tsx').read_text(encoding='utf-8')
    css = (PAGES / 'inkboundLiveRoom.css').read_text(encoding='utf-8')
    assert '<figure className="ibl-chapter-illustration"' in reader
    assert 'data-artwork-state={sceneArtReady' in reader
    assert 'aria-hidden={sceneArtReady}' in reader and 'aria-hidden={!sceneArtReady}' in reader
    assert '<div className="ibl-story-art">' in reader
    assert 'props.sceneArtUrl' in reader
    assert 'scene.ascii_art.trim()' not in reader
    assert '.ibl-chapter-illustration > .ibl-story-art' in css
    assert 'object-fit:contain' in css
    assert 'mask-image' not in css


def test_offline_benchmark_uses_fast_mock_without_changing_production_retries():
    benchmark = (ROOT / 'scripts' / 'aws' / 'benchmark-story-time-remote.sh').read_text(encoding='utf-8')
    tests = (ROOT / 'tests' / 'narration' / 'test_cpu_benchmark_ssm_readiness.py').read_text(encoding='utf-8')
    assert 'STORY_TIME_SSM_RETRY_SECONDS:-5' in benchmark
    assert 'STORY_TIME_SSM_RETRY_SECONDS=\'0\'' in tests
    assert 'MOCK_AWS = r\'\'\'#!/usr/bin/env bash' in tests
