# Claude.ai use by state, May 2026

A one-page map that answers one question: which US states use Claude.ai more than expected for their population?

It shows the usage per capita index for the 50 states and D.C. An index of 1.0 means a state's share of US Claude.ai use equals its share of US working-age people (ages 15 to 64).

## Files

| File | What it is |
|---|---|
| `index.html`, `styles.css`, `app.js` | The page. No libraries, no build step. |
| `data/states.json` | The only numbers the page uses: each state's index, rank and rank group (3 KB). |
| `data/us-map.json` | One SVG path per state. |
| `scripts/build-data.mjs` | Makes `data/states.json` from the source CSV. |
| `scripts/build-map.mjs` | Makes `data/us-map.json` from us-atlas. |

The source CSV is not in this repository. To rebuild the data file:

```sh
node scripts/build-data.mjs path/to/state-usage-2026-05.csv
```

To rebuild the map file:

```sh
npm install
curl -LO https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-albers-10m.json
node scripts/build-map.mjs states-albers-10m.json
```

To preview the page, serve the folder, for example with `python3 -m http.server`, and open <http://localhost:8000>.
Opening `index.html` straight from disk won't load the data files.

## Rank groups

The 51 places are ranked by index and split into four groups: Leading (top 25%), Upper middle, Lower middle and Emerging (bottom 25%).
Because 51 doesn't divide by four, the groups hold 13, 13, 13 and 12 places.
No tied values are split across two groups.

## Source

Data: [Anthropic Economic Index](https://www.anthropic.com/research/economic-index-june-2026-report), Claude.ai conversations on the Free, Pro and Max plans, May 2026, released June 26, 2026, under CC BY.

Map shapes: US Census Bureau, via [us-atlas](https://github.com/topojson/us-atlas).
