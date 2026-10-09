"""Shared filesystem roots for source-contract tests.

Use PROJECT_ROOT instead of __file__.parents[N] in nested suites.
"""
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
