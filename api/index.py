"""Vercel entrypoint for the VajraNow engine API (FastAPI, ASGI).

Locally: python -m uvicorn api.index:app --port 8000
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from vajranow.service import create_app  # noqa: E402

app = create_app()
