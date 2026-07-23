"""Pytest configuration — make backend package importable."""
import sys
from pathlib import Path

# Add backend dir to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))