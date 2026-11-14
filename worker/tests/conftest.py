import json
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def cases():
    return [json.loads(p.read_text()) for p in sorted((ROOT / 'scenarios/refund-rescue/cases').glob('*.json'))]


@pytest.fixture
def policy():
    return json.loads((ROOT / 'scenarios/refund-rescue/scenario.json').read_text())['policy']
