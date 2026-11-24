/* ==========================================================================
   core.js — data preparation, statistics, filters, chart & table helpers
   ========================================================================== */
(function (global) {
  "use strict";
  const D = global.DASHBOARD_DATA;
  const K = (global.K = {});
  K.D = D;
  K.ITEMS = D.items;
  K.THEMES = D.themes;
  K.ITEM = Object.fromEntries(D.items.map((i) => [i.key, i]));
  K.AGE_VALID = ["18–24", "25–34", "35–44", "45–50"];
  K.LEVELS = [
    { code: 1, label: "Strongly disagree" }, { code: 2, label: "Disagree" },
    { code: 3, label: "Agree" }, { code: 4, label: "Strongly agree" }, { code: 9, label: "Not sure" },
  ];

  // ------------------------------------------------------------------ stats
  const S = (K.stats = {});
  S.clean = (a) => a.filter((x) => x !== null && x !== undefined && !Number.isNaN(x));
  S.mean = (a) => { a = S.clean(a); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  S.sd = (a) => { a = S.clean(a); if (a.length < 2) return null; const m = S.mean(a);
    return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
  S.quantile = (a, p) => { a = S.clean(a).sort((x, y) => x - y); if (!a.length) return null;
    const h = (a.length - 1) * p, lo = Math.floor(h); return a[lo] + (h - lo) * ((a[lo + 1] ?? a[lo]) - a[lo]); };
  S.median = (a) => S.quantile(a, 0.5);
  const T975 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145,
    2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  S.tcrit = (df) => (df < 1 ? NaN : df <= 30 ? T975[df - 1] : 1.96 + 2.4 / df);
  S.ci = (a) => { a = S.clean(a); const n = a.length, m = S.mean(a);
    if (n < 2) return { mean: m, lo: null, hi: null, n, sd: null };
    const sd = S.sd(a), h = S.tcrit(n - 1) * sd / Math.sqrt(n); return { mean: m, lo: m - h, hi: m + h, n, sd }; };
  S.wilson = (k, n) => { if (!n) return { p: null, lo: null, hi: null };
    const z = 1.96, p = k / n, den = 1 + z * z / n, c = (p + z * z / (2 * n)) / den,
      h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / den; return { p, lo: Math.max(0, c - h), hi: Math.min(1, c + h) }; };
  S.pearson = (x, y) => { const p = []; x.forEach((v, i) => { if (v != null && y[i] != null) p.push([v, y[i]]); });
    if (p.length < 3) return null; const mx = S.mean(p.map((q) => q[0])), my = S.mean(p.map((q) => q[1]));
    let sxy = 0, sxx = 0, syy = 0; p.forEach(([a, b]) => { sxy += (a - mx) * (b - my); sxx += (a - mx) ** 2; syy += (b - my) ** 2; });
    return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null; };
  S.cronbach = (rows) => { rows = rows.filter((r) => r.every((v) => v != null)); const k = rows[0] ? rows[0].length : 0;
    if (rows.length < 3 || k < 2) return { alpha: null, n: rows.length };
    const vi = [...Array(k).keys()].map((j) => S.sd(rows.map((r) => r[j])) ** 2), vt = S.sd(rows.map((r) => r.reduce((s, x) => s + x, 0))) ** 2;
    return { alpha: vt > 0 ? (k / (k - 1)) * (1 - vi.reduce((s, x) => s + x, 0) / vt) : null, n: rows.length }; };

  // Welch difference of means (a − b) with 95% CI; "likely real" when the CI excludes 0
  S.diff = (a, b) => {
    a = S.clean(a); b = S.clean(b);
    if (a.length < 2 || b.length < 2) return null;
    const ma = S.mean(a), mb = S.mean(b), va = S.sd(a) ** 2 / a.length, vb = S.sd(b) ** 2 / b.length;
    const se = Math.sqrt(va + vb); if (!(se > 0)) return { d: ma - mb, lo: null, hi: null, real: false };
    const df = (va + vb) ** 2 / ((va ** 2) / (a.length - 1) + (vb ** 2) / (b.length - 1));
    const h = S.tcrit(Math.max(1, Math.floor(df))) * se;
    return { d: ma - mb, lo: ma - mb - h, hi: ma - mb + h, real: ma - mb - h > 0 || ma - mb + h < 0 };
  };

  // ------------------------------------------------------------------ Self-Clarity Index
  // index = (mean score − 1) / 3 × 100, so 0 = least and 100 = clearest self-understanding
  K.toIdx = (x) => (x == null ? null : ((x - 1) / 3) * 100);
  K.LEVEL_CUTS = { low: 40, high: 70 };
  K.level = (i) => (i == null ? null : i >= K.LEVEL_CUTS.high ? "High" : i >= K.LEVEL_CUTS.low ? "Moderate" : "Low");
  K.MIN_GROUP = 5;                                   // smaller groups are not compared
  // does this answer code show self-clarity? (reverse-worded items: disagreeing is the clear answer)
  K.clearness = (it, code) => {
    if (code == null || code === 9) return null;
    const pos = it.reverse ? 5 - code : code;        // 4 = strong clarity … 1 = strong difficulty
    return pos;
  };

  // ------------------------------------------------------------------ records
  K.records = D.records.map((r) => {
    const ans = {};
    K.ITEMS.forEach((it, i) => { const v = Array.isArray(r.a) ? r.a[i] : r.a ? r.a[it.key] : null; ans[it.key] = v == null ? null : +v; });
    const sc = {};
    K.ITEMS.forEach((it) => { const v = ans[it.key]; sc[it.key] = v >= 1 && v <= 4 ? (it.reverse ? 5 - v : v) : null; });
    const s = {};
    K.THEMES.forEach((t) => (s[t.key] = S.mean(t.items.map((q) => sc[q]))));
    s.overall = S.mean(K.ITEMS.map((it) => sc[it.key]));
    const idx = {}; Object.keys(s).forEach((k) => (idx[k] = K.toIdx(s[k])));
    const act = [].concat(r.act || []), circ = [].concat(r.circ || []);
    return Object.assign({}, r, {
      a: ans, r: sc, s, idx, lvl: K.level(idx.overall), act, circ, mainAct: act[0] || "(none)",
      nNS: K.ITEMS.filter((it) => ans[it.key] === 9).length,
      nAns: K.ITEMS.filter((it) => ans[it.key] != null).length,
      flags: r.flags || {},
    });
  });
  const dates = K.records.map((r) => r.date).filter(Boolean).sort();
  K.dateMin = dates[0] || ""; K.dateMax = dates[dates.length - 1] || "";

  // ------------------------------------------------------------------ state + filters
  K.state = { page: "summary", age: "", act: "", circ: "", from: "", to: "", labels: false };
  K.match = (r) => {
    const s = K.state;
    if (s.age && r.age !== s.age) return false;
    if (s.act && !r.act.includes(s.act)) return false;
    if (s.circ && !r.circ.includes(s.circ)) return false;
    if (s.from && (!r.date || r.date < s.from)) return false;
    if (s.to && (!r.date || r.date > s.to)) return false;
    return true;
  };
  K.analysed = () => K.records.filter((r) => r.eligible && K.match(r));
  K.allFiltered = () => K.records.filter((r) => K.match(r));
  K.activeFilters = () => ["age", "act", "circ", "from", "to"].filter((k) => K.state[k]);

  // ------------------------------------------------------------------ formatting
  K.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  K.f = (x, d = 2) => (x == null || Number.isNaN(x) ? "–" : Number(x).toFixed(d));
  K.pct = (x, d = 0) => (x == null || Number.isNaN(x) ? "–" : (100 * x).toFixed(d) + "%");
  K.int = (x) => (x == null ? "–" : Number(x).toLocaleString("en-GB"));
  K.p = (p) => (p == null ? "–" : p < 0.001 ? "< 0.001" : p.toFixed(3));
  K.dateLabel = (s) => (s ? new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–");
  K.i0 = (x) => (x == null || Number.isNaN(x) ? "–" : Math.round(x).toString());

  // ------------------------------------------------------------------ colours
  K.css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  K.dark = () => document.documentElement.getAttribute("data-theme") === "dark";
  const SERIES = {
    light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
    dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"],
  };
  K.series = (i) => SERIES[K.dark() ? "dark" : "light"][i % 8];
  K.themeColor = (key) => K.series(K.THEMES.findIndex((t) => t.key === key));
  K.blue = () => (K.dark() ? "#5598e7" : "#2a78d6");
  K.likertColor = (code) => (K.dark()
    ? { 1: "#f07171", 2: "#8f4646", 3: "#35619a", 4: "#7fb2f0", 9: "#5b6577" }
    : { 1: "#c23b3b", 2: "#ec9a95", 3: "#86b6ef", 4: "#1c5cab", 9: "#b9bfca" })[code];
  K.clearColor = (code) => (K.dark()
    ? { 4: "#2cc4b2", 3: "#1f7f74", 2: "#a3662b", 1: "#f08a4b", 9: "#5b6577" }
    : { 4: "#0b7d70", 3: "#7fcdbf", 2: "#f3b48a", 1: "#c4561c", 9: "#c3c8d1" })[code];
  K.CLEAR_LABEL = { 4: "Strong self-clarity", 3: "Some self-clarity", 2: "Some difficulty", 1: "Strong difficulty", 9: "Not sure" };
  K.levelColor = (lvl) => (K.dark() ? { Low: "#f07171", Moderate: "#c9a13b", High: "#3fd17a" } : { Low: "#d03b3b", Moderate: "#eda100", High: "#0a8f3c" })[lvl];
  K.seqScale = () => (K.dark()
    ? [[0, "#0d1a33"], [0.5, "#1c5cab"], [1, "#9ec5f4"]]
    : [[0, "#eef5fe"], [0.5, "#5598e7"], [1, "#0d366b"]]);
  K.divScale = () => (K.dark()
    ? [[0, "#e66767"], [0.5, "#1a263d"], [1, "#5c9df0"]]
    : [[0, "#c23b3b"], [0.5, "#f3f4f6"], [1, "#1c5cab"]]);

  // ------------------------------------------------------------------ charts
  const isObj = (o) => o && typeof o === "object" && !Array.isArray(o);
  const merge = (a, b) => { Object.keys(b || {}).forEach((k) => { if (isObj(b[k]) && isObj(a[k])) merge(a[k], b[k]); else a[k] = b[k]; }); return a; };
  K.axis = () => ({ gridcolor: K.css("--grid"), linecolor: K.css("--axis"), zerolinecolor: K.css("--axis"),
    tickfont: { color: K.css("--text-2"), size: 11.5 }, title: { font: { color: K.css("--text-2"), size: 12 } }, automargin: true });
  K.plot = (id, traces, layout = {}, opts = {}) => {
    const el = document.getElementById(id); if (!el) return;
    const base = {
      font: { family: "Inter, system-ui, sans-serif", size: 12, color: K.css("--text-2") },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 56, r: 18, t: 8, b: 44 }, height: opts.height || 340,
      hoverlabel: { bgcolor: K.css("--surface"), bordercolor: K.css("--border-strong"), font: { family: "Inter, sans-serif", color: K.css("--text"), size: 12 } },
      legend: { orientation: "h", x: 0, y: 1.02, yanchor: "bottom", font: { color: K.css("--text-2"), size: 11.5 }, bgcolor: "rgba(0,0,0,0)" },
      xaxis: K.axis(), yaxis: K.axis(), bargap: 0.3, hovermode: "closest",
    };
    merge(base, layout);
    Plotly.react(el, traces, base, {
      displaylogo: false, responsive: true,
      modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d", "toggleSpikelines"],
      toImageButtonOptions: { format: "png", scale: 2, filename: "klts_" + id },
    });
    if (opts.onClick) { el.removeAllListeners && el.removeAllListeners("plotly_click"); el.on("plotly_click", opts.onClick); el.style.cursor = "pointer"; }
    K._charts.push(el);
  };
  K._charts = []; K._tables = [];
  K.cleanup = () => {
    K._charts.forEach((el) => { try { Plotly.purge(el); } catch (e) {} });
    K._tables.forEach((t) => { try { t.destroy(); } catch (e) {} });
    K._charts = []; K._tables = [];
  };

  // ------------------------------------------------------------------ tables
  // columns: [{title, data, render, className, visible, filter:'text'|'select'}]
  K.table = (id, columns, rows, opts = {}) => {
    const el = document.getElementById(id); if (!el) return;
    const withFilters = columns.some((c) => c.filter);
    el.innerHTML = `<table class="display cell-border compact hover" style="width:100%">${withFilters
      ? `<tfoot class="col-filters"><tr>${columns.map(() => "<th></th>").join("")}</tr></tfoot>` : ""}</table>`;
    const fname = opts.filename || "klts_table";
    const dt = new DataTable(el.querySelector("table"), {
      data: rows, columns: columns.map((c) => ({ title: c.title, data: c.data, render: c.render, className: c.className || "",
        visible: c.visible !== false, orderable: c.orderable !== false, type: c.type, width: c.width })),
      pageLength: opts.pageLength || 10, lengthMenu: [5, 10, 25, 50, 100], order: opts.order || [], autoWidth: false,
      language: { search: "", searchPlaceholder: "Search table…", emptyTable: "No records match the current filters." },
      layout: {
        topStart: { buttons: [
          { extend: "copy", text: '<i class="fa-regular fa-copy"></i> Copy' },
          { extend: "csv", text: '<i class="fa-solid fa-file-csv"></i> CSV', filename: fname },
          { extend: "excel", text: '<i class="fa-regular fa-file-excel"></i> Excel', filename: fname },
          { extend: "print", text: '<i class="fa-solid fa-print"></i> Print' },
          { extend: "colvis", text: '<i class="fa-solid fa-table-columns"></i> Columns' },
        ] },
        topEnd: opts.noSearch ? null : "search",
        bottomStart: ["pageLength", "info"], bottomEnd: "paging",
      },
      createdRow: opts.createdRow,
      initComplete: function () {
        if (!withFilters) return;
        const api = this.api();
        api.columns().every(function (i) {
          const col = columns[i]; const cell = el.querySelectorAll("tfoot th")[i];
          if (!col || !col.filter || !cell) return;
          const column = this;
          if (col.filter === "select") {
            const vals = [...new Set(rows.map((r) => (typeof col.data === "function" ? col.data(r) : r[col.data])).flat().filter((v) => v != null && v !== ""))].sort();
            cell.innerHTML = `<select><option value="">All</option>${vals.map((v) => `<option>${K.esc(v)}</option>`).join("")}</select>`;
            cell.querySelector("select").addEventListener("change", (e) => column.search(e.target.value ? e.target.value : "", { regex: false, smart: false }).draw());
          } else {
            cell.innerHTML = `<input type="search" placeholder="Filter…">`;
            cell.querySelector("input").addEventListener("input", (e) => column.search(e.target.value).draw());
          }
        });
      },
    });
    K._tables.push(dt);
    return dt;
  };

  // ------------------------------------------------------------------ html snippets
  K.card = (o) => `
    <section class="card ${o.cls || ""}" style="grid-column: span ${o.span || 12}">
      <div class="card-h"><div class="ic"><i class="fa-solid ${o.icon || "fa-chart-simple"}"></i></div>
        <div><h3>${o.title}</h3>${o.sub ? `<div class="sub">${o.sub}</div>` : ""}</div>
        ${o.tools ? `<div class="tools">${o.tools}</div>` : ""}</div>
      <div class="card-b">${o.body}</div>
    </section>`;
  K.chartDiv = (id) => `<div class="chart" id="${id}"></div>`;
  K.empty = (msg, icon = "fa-hourglass-half") => `<div class="empty"><i class="fa-solid ${icon}"></i>${msg}</div>`;
  K.hero = (title, text, icon) => `<div class="hero fade-in"><h1>${title}</h1><p>${text}</p><i class="fa-solid ${icon} hero-icon"></i></div>`;
  K.about = (html, title = "About this page") => `<div class="about fade-in"><i class="fa-solid fa-circle-info"></i><div><h4>${title}</h4><p>${html}</p></div></div>`;
  K.kpi = (o) => `<div class="kpi ${o.cls}"><div class="k-icon"><i class="fa-solid ${o.icon}"></i></div>
      <div class="k-label">${o.label}</div><div class="k-value">${o.value}</div><div class="k-sub">${o.sub || "&nbsp;"}</div>
      ${o.bar != null ? `<div class="k-bar"><span style="width:${Math.max(0, Math.min(100, o.bar))}%"></span></div>` : ""}</div>`;
  K.stat = (o) => `<div class="stat" style="--c:${o.color || "var(--accent)"}"><div class="s-label"><span>${o.label}</span><i class="fa-solid ${o.icon || "fa-circle"}"></i></div>
      <div class="s-value">${o.value}</div><div class="s-sub">${o.sub || "&nbsp;"}</div></div>`;
  K.toast = (msg) => { const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(K._tt); K._tt = setTimeout(() => t.classList.remove("show"), 2200); };
})(window);
