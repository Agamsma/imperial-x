// Synthetic storm for the /demo page. Everything here is made up in code.
// It is NOT a forecast and uses no real radar, satellite or lightning data.

export type Level = "green" | "yellow" | "orange" | "red";
export type LngLat = [number, number];

export const LEVEL_COLOR: Record<Level, string> = {
  green: "#2E9E4F",
  yellow: "#F2C94C",
  orange: "#F2994A",
  red: "#D64545",
};

export const LEVEL_TEXT: Record<Level, { name: string; action: string }> = {
  green: { name: "Green", action: "No warning" },
  yellow: { name: "Yellow", action: "Be updated" },
  orange: { name: "Orange", action: "Be prepared" },
  red: { name: "Red", action: "Take action" },
};

const RANK: Record<Level, number> = { green: 0, yellow: 1, orange: 2, red: 3 };

// Time steps: Now, +10 ... +120 min, then the 6 h outlook.
export const STEP_MINUTES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
export const OUTLOOK_STEP = STEP_MINUTES.length; // index 13
export const STEP_COUNT = STEP_MINUTES.length + 1;

export function stepLabel(step: number): string {
  if (step >= OUTLOOK_STEP) return "6 h outlook";
  const m = STEP_MINUTES[step];
  return m === 0 ? "Now" : `+${m} min`;
}

export const MAP_CENTER: LngLat = [76.55, 9.45];
// Initial view: the storm track plus all three places.
export const VIEW_BOUNDS: [LngLat, LngLat] = [
  [76.0, 8.45],
  [77.2, 10.55],
];
// Kept well inside India so no international boundary is ever in view.
export const MAX_BOUNDS: [LngLat, LngLat] = [
  [74.0, 7.8],
  [78.6, 13.0],
];

// Storm motion: starts near the Alappuzha / Kochi coast and moves north-east.
const START = { lat: 9.93, lon: 76.18 };
const BEARING_DEG = 45;
const SPEED_KMH = 42;

// Core radii in km (across track). Shapes are stretched along the track.
const RADII: Record<Exclude<Level, "green">, number> = { yellow: 17, orange: 10, red: 5 };
const STRETCH = 1.4;

const KM_PER_DEG_LAT = 111.0;
const kmPerDegLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

const bearing = (BEARING_DEG * Math.PI) / 180;
const ALONG = { e: Math.sin(bearing), n: Math.cos(bearing) }; // unit vector along track
const ACROSS = { e: Math.cos(bearing), n: -Math.sin(bearing) }; // unit vector to the right

function offset(lat: number, lon: number, eastKm: number, northKm: number): LngLat {
  return [lon + eastKm / kmPerDegLon(lat), lat + northKm / KM_PER_DEG_LAT];
}

function toLocalKm(p: LngLat, origin: { lat: number; lon: number }) {
  return {
    e: (p[0] - origin.lon) * kmPerDegLon(origin.lat),
    n: (p[1] - origin.lat) * KM_PER_DEG_LAT,
  };
}

function centreAt(minutes: number, speedFactor = 1): { lat: number; lon: number } {
  const d = (SPEED_KMH * speedFactor * minutes) / 60;
  const [lon, lat] = offset(START.lat, START.lon, ALONG.e * d, ALONG.n * d);
  return { lat, lon };
}

// Storm grows a little over the first 2 hours.
const growth = (minutes: number) => 1 + 0.004 * minutes;

function shape(minutes: number, level: Exclude<Level, "green">): LngLat[] {
  const c = centreAt(minutes);
  const r = RADII[level] * growth(minutes);
  const pts: LngLat[] = [];
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const a = ((i % n) / n) * Math.PI * 2;
    // Deterministic wobble so the cell looks less like a perfect ellipse.
    const wobble = 1 + 0.08 * Math.sin(3 * a + minutes / 25) + 0.05 * Math.cos(5 * a - minutes / 40);
    const along = Math.cos(a) * r * STRETCH * wobble;
    const across = Math.sin(a) * r * wobble;
    pts.push(offset(c.lat, c.lon, ALONG.e * along + ACROSS.e * across, ALONG.n * along + ACROSS.n * across));
  }
  return pts;
}

type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
const fc = (features: Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });

export function stormCells(step: number): GeoJSON.FeatureCollection {
  if (step >= OUTLOOK_STEP) return fc([]);
  const m = STEP_MINUTES[step];
  return fc(
    (["yellow", "orange", "red"] as const).map((level) => ({
      type: "Feature",
      properties: { level, color: LEVEL_COLOR[level] },
      geometry: { type: "Polygon", coordinates: [shape(m, level)] },
    })),
  );
}

export function stormTrack(): GeoJSON.FeatureCollection {
  const line = STEP_MINUTES.map((m) => {
    const c = centreAt(m);
    return [c.lon, c.lat];
  });
  return fc([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line } }]);
}

export function stormCentre(step: number): GeoJSON.FeatureCollection {
  if (step >= OUTLOOK_STEP) return fc([]);
  const c = centreAt(STEP_MINUTES[step]);
  return fc([{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [c.lon, c.lat] } }]);
}

// Uncertainty cone: widens from 2 km now to 20 km at +120 min.
export function uncertaintyCone(): GeoJSON.FeatureCollection {
  const left: LngLat[] = [];
  const right: LngLat[] = [];
  for (let m = 0; m <= 120; m += 5) {
    const c = centreAt(m);
    const w = 2 + 0.15 * m;
    left.push(offset(c.lat, c.lon, -ACROSS.e * w, -ACROSS.n * w));
    right.push(offset(c.lat, c.lon, ACROSS.e * w, ACROSS.n * w));
  }
  const ring = [...left, ...right.reverse(), left[0]];
  return fc([{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }]);
}

// 6 h outlook: one broad yellow area over central Kerala.
const OUTLOOK = { lat: 10.45, lon: 76.85, alongKm: 80, acrossKm: 58 };

export function outlookArea(step: number): GeoJSON.FeatureCollection {
  if (step < OUTLOOK_STEP) return fc([]);
  const pts: LngLat[] = [];
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const a = ((i % n) / n) * Math.PI * 2;
    const wobble = 1 + 0.06 * Math.sin(4 * a);
    const along = Math.cos(a) * OUTLOOK.alongKm * wobble;
    const across = Math.sin(a) * OUTLOOK.acrossKm * wobble;
    pts.push(offset(OUTLOOK.lat, OUTLOOK.lon, ALONG.e * along + ACROSS.e * across, ALONG.n * along + ACROSS.n * across));
  }
  return fc([{ type: "Feature", properties: { level: "yellow" }, geometry: { type: "Polygon", coordinates: [pts] } }]);
}

function insideEllipse(p: LngLat, centre: { lat: number; lon: number }, acrossKm: number) {
  const { e, n } = toLocalKm(p, centre);
  const along = e * ALONG.e + n * ALONG.n;
  const across = e * ACROSS.e + n * ACROSS.n;
  return (along / (acrossKm * STRETCH)) ** 2 + (across / acrossKm) ** 2 <= 1;
}

function levelAtMinute(p: LngLat, minutes: number, speedFactor = 1): Level {
  const c = centreAt(minutes, speedFactor);
  const g = growth(minutes);
  if (insideEllipse(p, c, RADII.red * g)) return "red";
  if (insideEllipse(p, c, RADII.orange * g)) return "orange";
  if (insideEllipse(p, c, RADII.yellow * g)) return "yellow";
  return "green";
}

function inOutlook(p: LngLat) {
  const { e, n } = toLocalKm(p, OUTLOOK);
  const along = e * ALONG.e + n * ALONG.n;
  const across = e * ACROSS.e + n * ACROSS.n;
  return (along / OUTLOOK.alongKm) ** 2 + (across / OUTLOOK.acrossKm) ** 2 <= 1;
}

export function levelAt(p: LngLat, step: number): Level {
  if (step >= OUTLOOK_STEP) return inOutlook(p) ? "yellow" : "green";
  return levelAtMinute(p, STEP_MINUTES[step]);
}

export type Place = {
  id: string;
  name: string;
  lngLat: LngLat;
  unreliable?: string;
};

export const PLACES: Place[] = [
  { id: "cok", name: "Kochi Airport", lngLat: [76.401, 10.152] },
  { id: "tvm", name: "Thiruvananthapuram", lngLat: [76.936, 8.524] },
  { id: "munnar", name: "Munnar", lngLat: [77.06, 10.089], unreliable: "Not reliable (terrain, low motion confidence)" },
];

export type Arrival = {
  place: Place;
  worst: Level;
  text: string;
  detail: string;
};

// First minute (within 2 h) that the orange core reaches a place, for a given speed.
function firstOrangeMinute(p: LngLat, speedFactor: number): number | null {
  for (let m = 0; m <= 120; m++) {
    if (RANK[levelAtMinute(p, m, speedFactor)] >= RANK.orange) return m;
  }
  return null;
}

// Arrival window from the synthetic storm speed with a +/- 20% speed range.
export function arrivalWindows(): Arrival[] {
  return PLACES.map((place) => {
    let worst: Level = "green";
    for (let m = 0; m <= 120; m += 5) {
      const l = levelAtMinute(place.lngLat, m);
      if (RANK[l] > RANK[worst]) worst = l;
    }

    if (place.unreliable) {
      return {
        place,
        worst: worst === "green" ? "yellow" : worst,
        text: place.unreliable,
        detail: "Inside the 6 h outlook area. Check again at the next update.",
      };
    }

    const fast = firstOrangeMinute(place.lngLat, 1.2);
    const mid = firstOrangeMinute(place.lngLat, 1);
    const slow = firstOrangeMinute(place.lngLat, 0.8);

    if (mid === null) {
      return { place, worst, text: "No storm expected in the next 2 h", detail: "Outside the storm track and cone." };
    }

    const lo = Math.max(0, Math.floor((fast ?? mid) / 5) * 5);
    const hi = slow === null ? null : Math.ceil(slow / 5) * 5;
    return {
      place,
      worst,
      text: hi === null ? `${lo} min or later` : `${lo} to ${hi} min`,
      detail: `Storm core arrival. Most likely around ${Math.round(mid / 5) * 5} min.`,
    };
  });
}

export type Alert = { level: Level; title: string; body: string };

export function buildAlerts(arrivals: Arrival[]): Alert[] {
  const alerts: Alert[] = arrivals.map((a) => {
    const lt = LEVEL_TEXT[a.worst];
    if (a.place.unreliable) {
      return {
        level: a.worst,
        title: `${a.place.name}: ${lt.name}, ${lt.action.toLowerCase()}`,
        body: "Storms may form over the hills in the next 6 h. Arrival time is not reliable here.",
      };
    }
    if (a.worst === "green") {
      return { level: "green", title: `${a.place.name}: ${lt.name}, no warning`, body: a.text + "." };
    }
    return {
      level: a.worst,
      title: `${a.place.name}: ${lt.name}, ${lt.action.toLowerCase()}`,
      body: `Storm core in ${a.text}. Lightning likely (radar proxy). Hail flag (not validated).`,
    };
  });
  alerts.push({
    level: "yellow",
    title: "Idukki and Thrissur hills: Yellow, be updated",
    body: "New storm cells may form in the next 1 to 3 h (probability zone).",
  });
  return alerts.sort((a, b) => RANK[b.level] - RANK[a.level]);
}
