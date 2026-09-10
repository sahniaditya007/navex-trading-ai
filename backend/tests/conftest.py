"""
Pytest configuration and sys.path setup for NAVEX Trading AI.
Ensures backend directory is always in sys.path during test runs.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
