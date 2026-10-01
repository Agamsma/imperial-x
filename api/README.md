# api/

The Vercel entrypoint for the VajraNow engine API. The app itself lives in
[`vajranow/service.py`](../vajranow/service.py).

- Docs (live): `/api/py/docs`
- Reference: [docs/api.md](../docs/api.md)

Run locally:

```bash
pip install -r requirements.txt
python -m uvicorn api.index:app --reload --port 8000
```

Every response is computed from synthetic storms. Not a real forecast.
