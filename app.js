// Draws the map, legend, small-state buttons, top 10 and table from two small files:
//   data/states.json  index, rank and group for the 50 states and D.C. (built from the CSV)
//   data/us-map.json  one SVG path per state
(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const SMALL = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"];
  const SHORT_NAME = { DC: "D.C." };

  const $ = (id) => document.getElementById(id);
  const tooltip = $("tooltip");
  const fmt = (v) => v.toFixed(2);

  Promise.all([getJSON("data/states.json"), getJSON("data/us-map.json")])
    .then(([data, map]) => render(data, map))
    .catch((err) => {
      console.error(err);
      $("map-status").textContent =
        "The map could not load. If you opened this file directly, serve the folder with a local web server instead.";
    });

  function getJSON(url) {
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.json();
    });
  }

  function render(data, map) {
    const states = data.states;
    const groups = data.groups;
    const byCode = new Map(states.map((s) => [s.code, s]));
    const total = states.length;
    const tiedRanks = new Set(
      states.filter((s, i) => states.some((t, j) => j !== i && t.rank === s.rank)).map((s) => s.rank)
    );

    // Hover, tap and keyboard share one state: the lit code, and the code a tap pinned open.
    const hot = { code: null, pinned: null };
    let lastPointer = "mouse";
    document.addEventListener("pointerdown", (e) => { lastPointer = e.pointerType; }, true);
    const linked = new Map(); // code -> elements to light up together

    function link(code, el) {
      if (!linked.has(code)) linked.set(code, []);
      linked.get(code).push(el);
    }

    renderLegend();
    const svg = renderMap();
    renderChips();
    renderTop10();
    renderTable();

    document.addEventListener("click", (e) => {
      if (hot.pinned && !e.target.closest("[data-code]")) clear();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") clear();
    });
    window.addEventListener("scroll", () => { if (hot.pinned) clear(); }, { passive: true });

    // ---------- Legend ----------
    function renderLegend() {
      const legend = $("legend");
      groups.forEach((name, g) => {
        const members = states.filter((s) => s.group === g);
        const hi = Math.max(...members.map((s) => s.index));
        const lo = Math.min(...members.map((s) => s.index));
        const li = el("li");
        li.append(
          el("span", { class: `swatch sw-g${g}` }),
          el("span", { class: "name" }, name),
          el("span", { class: "range" }, `${fmt(lo)}–${fmt(hi)}`)
        );
        legend.append(li);
      });
    }

    // ---------- Map ----------
    function renderMap() {
      const box = $("map");
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("viewBox", "-60 10 1020 600");
      svg.setAttribute("role", "group");
      svg.setAttribute("aria-label", "Map of the United States colored by usage per capita index group");

      const shapes = document.createElementNS(SVG_NS, "g");
      const labels = document.createElementNS(SVG_NS, "g");
      labels.setAttribute("aria-hidden", "true");

      for (const [code, shape] of Object.entries(map.states)) {
        const s = byCode.get(code);
        if (!s) continue;
        const p = document.createElementNS(SVG_NS, "path");
        p.setAttribute("d", shape.d);
        p.setAttribute("class", `state g${s.group}`);
        p.setAttribute("data-code", code);
        p.setAttribute("tabindex", SMALL.includes(code) ? "-1" : "0");
        p.setAttribute("role", "img");
        p.setAttribute("aria-label", describe(s));
        bindTarget(p, code);
        link(code, p);
        shapes.append(p);

        if (shape.label) {
          const t = document.createElementNS(SVG_NS, "text");
          t.setAttribute("x", shape.label[0]);
          t.setAttribute("y", shape.label[1]);
          t.setAttribute("class", shape.beside ? "state-label beside" : `state-label g${s.group}`);
          t.textContent = code;
          labels.append(t);
        }
      }

      const outline = document.createElementNS(SVG_NS, "path");
      outline.setAttribute("class", "highlight");
      outline.setAttribute("d", "");

      svg.append(shapes, labels, outline);
      box.replaceChildren(svg);
      svg.outline = outline;
      return svg;
    }

    // ---------- Small states ----------
    function renderChips() {
      const chips = $("chips");
      for (const code of SMALL) {
        const s = byCode.get(code);
        const b = el("button", { type: "button", class: `chip g${s.group}`, "data-code": code, "aria-label": describe(s) }, code);
        bindTarget(b, code);
        link(code, b);
        chips.append(b);
      }
    }

    // ---------- Top 10 ----------
    function renderTop10() {
      const top = states.slice(0, 10);
      const max = top[0].index;
      const list = $("top10");
      const ref = (1 / max).toFixed(4);
      $("top10-axis").style.setProperty("--ref", ref);
      $("top10-axis").append(el("span", { class: "ref-label" }, "1.0"));

      for (const s of top) {
        const li = el("li", { "data-code": s.code });
        const track = el("span", { class: "track" });
        track.style.setProperty("--ref", ref);
        const bar = el("span", { class: "bar" });
        bar.style.setProperty("--f", (s.index / max).toFixed(4));
        track.append(bar, el("span", { class: "value" }, fmt(s.index)));
        li.append(
          el("span", { class: "rank" }, String(s.rank)),
          el("span", { class: "name", title: s.name }, SHORT_NAME[s.code] || s.name),
          track
        );
        li.addEventListener("pointerenter", () => light(s.code));
        li.addEventListener("pointerleave", () => { if (!hot.pinned) clear(); });
        link(s.code, li);
        list.append(li);
      }
    }

    // ---------- Table ----------
    function renderTable() {
      const body = $("table-body");
      for (const s of states) {
        const tr = el("tr");
        const group = el("span", { class: "group-cell" });
        group.append(el("span", { class: `swatch sw-g${s.group}` }), document.createTextNode(groups[s.group]));
        tr.append(
          el("td", {}, rankText(s)),
          el("td", {}, s.name),
          el("td", { class: "num" }, fmt(s.index)),
          wrap("td", group)
        );
        body.append(tr);
      }
    }

    // ---------- Interaction ----------
    function bindTarget(node, code) {
      node.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse" || hot.pinned) return;
        show(code, e.clientX, e.clientY);
      });
      node.addEventListener("pointerleave", (e) => {
        if (e.pointerType === "mouse" && !hot.pinned) clear();
      });
      node.addEventListener("click", (e) => {
        e.stopPropagation();
        const keyboard = e.detail === 0;
        if (!keyboard && lastPointer === "mouse") return; // hover already shows it
        if (hot.pinned === code) return clear();
        const r = node.getBoundingClientRect();
        const x = keyboard ? r.left + r.width / 2 : e.clientX;
        const y = keyboard ? r.top + r.height / 2 : e.clientY;
        show(code, x, y);
        hot.pinned = code;
      });
      node.addEventListener("focus", () => {
        if (hot.pinned !== code) hot.pinned = null;
        const r = node.getBoundingClientRect();
        show(code, r.left + r.width / 2, r.top + r.height / 2);
      });
      node.addEventListener("blur", () => { if (!hot.pinned) clear(); });
    }

    function light(code) {
      if (hot.code === code) return;
      unlight();
      hot.code = code;
      for (const n of linked.get(code) || []) n.classList.add("is-hot");
      svg.outline.setAttribute("d", map.states[code] ? map.states[code].d : "");
    }

    function unlight() {
      if (hot.code) for (const n of linked.get(hot.code) || []) n.classList.remove("is-hot");
      hot.code = null;
      svg.outline.setAttribute("d", "");
    }

    function show(code, x, y) {
      const s = byCode.get(code);
      light(code);
      const meta = el("div", { class: "tt-meta" });
      meta.append(el("span", { class: `swatch sw-g${s.group}` }), document.createTextNode(`${groups[s.group]} · rank ${rankText(s)} of ${total}`));
      tooltip.replaceChildren(
        el("div", { class: "tt-name" }, s.name),
        el("div", { class: "tt-value" }, fmt(s.index)),
        el("div", { class: "tt-gloss" }, gloss(s.index)),
        meta
      );
      tooltip.hidden = false;
      place(x, y);
    }

    function place(x, y) {
      const pad = 12;
      const w = tooltip.offsetWidth;
      const h = tooltip.offsetHeight;
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      let left = x + 14;
      let top = y + 14;
      if (left + w > vw - pad) left = x - w - 14;
      if (left < pad) left = Math.max(pad, Math.min(vw - w - pad, x - w / 2));
      if (top + h > vh - pad) top = y - h - 14;
      if (top < pad) top = pad;
      tooltip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    }

    function clear() {
      hot.pinned = null;
      unlight();
      tooltip.hidden = true;
    }

    function rankText(s) {
      return tiedRanks.has(s.rank) ? `${s.rank} (tie)` : String(s.rank);
    }

    function describe(s) {
      return `${s.name}: ${fmt(s.index)}, ${groups[s.group]}, rank ${rankText(s)} of ${total}`;
    }
  }

  // Plain-language reading of an index value.
  function gloss(v) {
    const pct = Math.round(Math.abs(v - 1) * 100);
    if (pct === 0) return "Use matches its population share";
    if (v >= 2) return `${v.toFixed(1)} times its expected use`;
    return v > 1 ? `${pct}% more use than expected` : `${pct}% less use than expected`;
  }

  function el(tag, attrs = {}, text) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function wrap(tag, child) {
    const node = document.createElement(tag);
    node.append(child);
    return node;
  }
})();
