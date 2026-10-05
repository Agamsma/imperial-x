# api/

The Vercel entrypoint for the Imperial-X engine API. The app itself lives in
[`imperial_x/service.py`](../imperial_x/service.py).

- Docs (live): `/api/py/docs`
- Reference: [docs/api.md](../docs/api.md)

Run locally:

```bash
pip install -r requirements.txt
python -m uvicorn api.index:app --reload --port 8000
```

Every response is computed from synthetic storms. Not a real forecast.
