// Types and fetchers for the Imperial-X engine API (Python, served under /api/py).
// Every response is computed from synthetic storms.

export const ENGINE_BASE = "/api/py";

export type LevelName = "green" | "yellow" | "orange" | "red";
export const LEVEL_ORDER: LevelName[] = ["green", "yellow", "orange", "red"];

export type FeatureCollection = GeoJSON.FeatureCollection;

export type Frame = {
  t: number;
  kind: "observed" | "forecast" | "outlook";
  tier?: "sharp" | "probability" | "outlook";
  label: string;
  radar: string | null;
  warnings: FeatureCollection | null;
  missing: boolean;
  lightning: FeatureCollection | null;
};

export type Feed = {
  id: string;
  label: string;
  status: "ok" | "degraded" | "stale" | "proxy" | "missing";
  detail: string;
  source: string;
};

export type Arrival = {
  status: "now" | "expected" | "possible" | "none" | "unreliable" | "outside";
  text: string;
  detail: string;
  window: [number, number] | null;
  most_likely: number | null;
  chance: number | null;
  confidence: "high" | "medium" | "low" | null;
};

export type Probability = {
  storm: number[];
  lightning: number[];
  heavy: number[];
  severe: number[];
  hail: number[];
  rain50: number;
  rain100: number;
};

export type PlaceForecast = {
  id: string;
  name: string;
  lon: number;
  lat: number;
  elev_m: number | null;
  kind: string;
  covered: boolean;
  levels: number[];
  level: LevelName;
  arrival: Arrival;
  hazards: string[];
  motion_confidence: number;
  rain_next_hour_mm: { median: number; p90: number };
  probability: Probability;
  frame_levels?: (number | null)[];
};

export type PointForecast = PlaceForecast & { leads: number[] };

export type StormCell = {
  id: string;
  lon: number;
  lat: number;
  max_dbz: number;
  area_km2: number;
  speed_kmh: number;
  toward_deg: number;
  toward: string;
  trend: "Growing" | "Steady" | "Weakening";
  growth_30_db: number;
  lightning_10min: number;
  max_rain_mm_h: number;
  near: string;
  hazards: string[];
  track: { t: number; lon: number; lat: number }[];
  past: [number, number][];
  cone: [number, number][];
};

export type InitiationZone = {
  lon: number;
  lat: number;
  radius_km: number;
  max_growth_db: number;
  near: string;
  chance: "likely" | "possible";
  in_radar_range: boolean;
};

export type Alert = {
  kind: "place" | "area";
  place_id: string | null;
  level: LevelName;
  title: string;
  body: string;
  lon?: number;
  lat?: number;
};

export type Bundle = {
  engine: {
    name: string;
    version: string;
    data: string;
    disclaimer: string;
    members: number;
    fusion: string;
    timings_ms: Record<string, number>;
  };
  scenario: { id: string; title: string; summary: string; story: string[] };
  grid: { nx: number; ny: number; cell_km: number; bounds: [number, number, number, number]; corners: [number, number][] };
  radar: { name: string; lon: number; lat: number; range_km: number; ring: GeoJSON.Feature };
  feeds: Feed[];
  qc: { clutter_pixels: number; speckle_pixels: number; missing_scans: number[]; notes: string[] };
  motion: {
    mean_speed_kmh: number;
    mean_toward_deg: number;
    mean_toward: string;
    quality: "good" | "fair" | "poor";
    tracked_blocks: number;
    echo_blocks: number;
    arrows: FeatureCollection;
  };
  fusion_inputs: string[];
  frames: Frame[];
  cells: StormCell[];
  initiation: InitiationZone[];
  places: PlaceForecast[];
  alerts: Alert[];
  legend: { radar_dbz: { label: string; color: string }[]; levels: { level: LevelName; name: string; action: string }[] };
  method: {
    z_r_relation: { a: number; b: number; hail_cap_dbz: number; note: string };
    thresholds_dbz: Record<string, number>;
    rain_1h_mm: { heavy: number; cloudburst: number };
    level_rules: Record<string, string>;
    neighbourhood: string;
    status: string;
  };
};

export type ScenarioInfo = { id: string; title: string; summary: string; story: string[] };

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${ENGINE_BASE}${path}`, { signal });
  if (!res.ok) throw new Error(`Engine request failed (${res.status})`);
  return (await res.json()) as T;
}

export const fetchScenarios = (signal?: AbortSignal) => getJson<ScenarioInfo[]>("/v1/scenarios", signal);
export const fetchNowcast = (id: string, signal?: AbortSignal) => getJson<Bundle>(`/v1/nowcast/${id}`, signal);
export const fetchPoint = (id: string, lon: number, lat: number, signal?: AbortSignal) =>
  getJson<PointForecast>(`/v1/nowcast/${id}/point?lon=${lon.toFixed(4)}&lat=${lat.toFixed(4)}`, signal);
export const fetchHealth = (signal?: AbortSignal) =>
  getJson<{ status: string; version: string; fusion_model: string }>("/health", signal);

export const LEVEL_HEX: Record<LevelName, string> = {
  green: "#2E9E4F",
  yellow: "#F2C94C",
  orange: "#F2994A",
  red: "#D64545",
};

export const levelName = (i: number | null | undefined): LevelName => LEVEL_ORDER[Math.max(0, Math.min(3, i ?? 0))];
