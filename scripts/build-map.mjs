// Build data/us-map.json: one SVG path per state, plus label spots.
// Shapes come from us-atlas (states-albers-10m), already projected to a 975 x 610 box.
//   npm install && node scripts/build-map.mjs <path-to-states-albers-10m.json>
// Download: https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-albers-10m.json
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { geoPath } from "d3-geo";

const topoPath = process.argv[2];
if (!topoPath) {
  console.error("Usage: node scripts/build-map.mjs <path-to-states-albers-10m.json>");
  process.exit(1);
}

const NAME_TO_CODE = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL",
  Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA",
  Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
  Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

// States too small to tap or label on the map get a labeled box in the Atlantic.
export const SMALL = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"];

// Hand-placed label spots where the shape's center falls badly.
const LABEL_AT = {
  FL: [795, 540], OK: [482, 382], ID: [204, 168], LA: [566, 470],
};
// Islands too small to hold a label get one beside them, in text color.
const LABEL_BESIDE = { HI: [292, 540] };

const topo = JSON.parse(readFileSync(topoPath, "utf8"));
const states = feature(topo, topo.objects.states).features;
const path = geoPath(); // shapes are pre-projected

const round = (d) => d.replace(/-?\d+\.\d+/g, (n) => (+n).toFixed(1));
const out = { width: 975, height: 610, states: {} };

for (const f of states) {
  const code = NAME_TO_CODE[f.properties.name];
  if (!code) continue; // territories are not in the data
  const beside = LABEL_BESIDE[code];
  const [x, y] = beside ?? LABEL_AT[code] ?? path.centroid(largestPart(f));
  out.states[code] = {
    d: round(path(f)),
    label: SMALL.includes(code) ? null : [Math.round(x), Math.round(y)],
    ...(beside ? { beside: true } : {}),
  };
}

const missing = Object.values(NAME_TO_CODE).filter((c) => !out.states[c]);
if (missing.length) throw new Error(`No shape for: ${missing.join(", ")}`);

const json = JSON.stringify(out);
writeFileSync(new URL("../data/us-map.json", import.meta.url), json + "\n");
console.log(`Wrote data/us-map.json: ${Object.keys(out.states).length} shapes, ${(json.length / 1024).toFixed(0)} KB`);

// The largest polygon of a multipolygon, so islands don't pull the label off the mainland.
function largestPart(f) {
  if (f.geometry.type !== "MultiPolygon") return f;
  let best = null;
  let bestArea = -1;
  for (const coords of f.geometry.coordinates) {
    const g = { type: "Feature", geometry: { type: "Polygon", coordinates: coords } };
    const a = path.area(g);
    if (a > bestArea) [best, bestArea] = [g, a];
  }
  return best;
}
