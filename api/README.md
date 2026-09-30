# api/

**Status: planned. No code yet.**

A FastAPI service that will serve nowcast results to the dashboard:

- Latest hazard polygons with IMD colour levels
- Arrival windows for chosen places
- Data feed health (radar, satellite, lightning)

Storage is planned in PostgreSQL with PostGIS. The current `/demo` page does not call any API. It uses synthetic data generated in `lib/storm.ts`.
