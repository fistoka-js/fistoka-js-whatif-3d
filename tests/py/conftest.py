import sys
from pathlib import Path

# Make `import pipeline` work when pytest is run from anywhere.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


def pytest_configure(config):
    config.addinivalue_line("markers", "network: needs internet (real Edge TTS)")
