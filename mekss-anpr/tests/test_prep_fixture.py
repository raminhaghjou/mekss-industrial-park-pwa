"""The JS/TS ports of prep_crnn are tested against a shared fixture; keep it in sync with OpenCV."""

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("refresh_prep_fixture", ROOT / "scripts" / "refresh_prep_fixture.py")
refresh = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(refresh)


def test_shared_prep_fixture_matches_prep_crnn():
    fixture = json.loads(refresh.FIXTURE.read_text(encoding="utf-8"))
    current = refresh.expected(fixture)
    for key in ("small", "plate"):
        assert fixture[key]["prep"] == current[key]["prep"], f"run scripts/refresh_prep_fixture.py ({key})"
    for key, values in current["stage"].items():
        assert fixture["stage"][key] == values, f"run scripts/refresh_prep_fixture.py (stage {key})"
