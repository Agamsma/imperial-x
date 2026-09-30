# data_pipeline/

**Status: planned. No code yet.**

Python code that will:

1. **Ingest** Doppler radar (MOSDAC TERLS), INSAT-3D/3DR infrared and lightning data.
2. **Align** everything onto one 2 km grid, every 10 minutes.
3. Run quality checks (missing scans, stale files, clutter).

Downloaded data goes in a local `data/` folder, which is in `.gitignore`. Never commit raw or processed data. See [docs/data-sources.md](../docs/data-sources.md).
