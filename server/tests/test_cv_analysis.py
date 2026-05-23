"""Smoke tests for CV module (no real video required)."""

from cv_analysis import analyze_chair_video, analyze_walk_video


def test_cv_module_imports():
    assert callable(analyze_walk_video)
    assert callable(analyze_chair_video)
