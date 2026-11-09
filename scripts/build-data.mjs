// Build data/states.json from the Anthropic Economic Index state CSV.
// The CSV itself stays out of the repository; pass its path as the first argument:
//   node scripts/build-data.mjs ../data/state-usage-2026-05.csv
import { readFileSync, writeFileSync } from "node:fs";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: node scripts/build-data.mjs <path-to-state-usage-csv>");
  process.exit(1);
}

const lines = readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
const header = lines[0].split(",");
const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`Missing column: ${name}`);
  return i;
};
const iCode = col("state_code");
const iName = col("state_name");
const iIndex = col("usage_per_capita_index");

const rows = lines.slice(1).map((line, n) => {
  const cells = line.split(",");
  if (cells.length !== header.length) throw new Error(`Row ${n + 2} has ${cells.length} cells`);
  const index = Number(cells[iIndex]);
  if (!Number.isFinite(index)) throw new Error(`Row ${n + 2} has no index value`);
  return { code: cells[iCode], name: cells[iName], index };
});
if (rows.length !== 51) throw new Error(`Expected 51 rows (50 states + D.C.), got ${rows.length}`);

// Rank from highest to lowest index. Tied values share a rank (1, 2, 2, 4 ...).
rows.sort((a, b) => b.index - a.index || a.name.localeCompare(b.name));
rows.forEach((r, i) => {
  r.rank = i > 0 && r.index === rows[i - 1].index ? rows[i - 1].rank : i + 1;
});

// Four groups by rank. 51 places do not split evenly, so the groups hold
// 13, 13, 13 and 12 places: ceil(51 / 4) = 13 each, the remainder at the bottom.
const GROUPS = ["Leading", "Upper middle", "Lower middle", "Emerging"];
const size = Math.ceil(rows.length / 4);
rows.forEach((r, i) => {
  r.group = Math.min(Math.floor(i / size), 3);
});
// A tie must never straddle two groups.
for (let i = 1; i < rows.length; i++) {
  if (rows[i].index === rows[i - 1].index && rows[i].group !== rows[i - 1].group) {
    throw new Error(`Tie at ${rows[i].index} splits ${rows[i - 1].code} and ${rows[i].code} across groups`);
  }
}

const out = {
  month: "2026-05",
  measure: "usage_per_capita_index",
  groups: GROUPS,
  states: rows.map(({ code, name, index, rank, group }) => ({ code, name, index, rank, group })),
};
writeFileSync(new URL("../data/states.json", import.meta.url), JSON.stringify(out) + "\n");

for (const g of [0, 1, 2, 3]) {
  const members = rows.filter((r) => r.group === g);
  console.log(
    `${GROUPS[g].padEnd(13)} ${String(members.length).padStart(2)} places, ` +
      `${members.at(-1).index.toFixed(2)} to ${members[0].index.toFixed(2)}`
  );
}
console.log(`Wrote data/states.json (${rows.length} places)`);
