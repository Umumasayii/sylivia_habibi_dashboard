/* ==========================================================================
   pages.js — the dashboard pages, one question per page
     1 Summary              How clearly do adults understand themselves?
     2 Who answered         Who is in the data?
     3 Strengths & growth   Where are people clear, and where do they struggle?
     4 Themes in depth      What does each dimension look like?
     5 Who differs          Do groups differ?
     6 In their own words   What do people say about themselves?
     7 Data & methods       How the numbers are made, data quality, all responses
   Scores are shown as the Self-Clarity Index (0–100): higher = clearer.
   ========================================================================== */
(function (global) {
  "use strict";
  const K = global.K, S = K.stats;
  const P = (K.pages = {});

  const THEME_INFO = {
    identity: "Knowing who you are beyond your roles, responsibilities and achievements.",
    social: "Staying yourself with different people, and making choices that are your own.",
    feedback: "Seeing your strengths and limits, and handling criticism and mistakes calmly.",
    values: "Knowing what you value and acting in line with it.",
    reflect: "Understanding your emotions and taking time to reflect on your patterns.",
  };
  const OUTCOMES = () => [["overall", "Overall index"], ...K.THEMES.map((t) => [t.key, t.label])];
  const themeLabel = (k) => (k === "overall" ? "Overall index" : K.THEMES.find((t) => t.key === k).label);
  const labelsOn = () => K.state.labels;
  const needRows = (rows, html) => (rows.length ? html : K.empty("No analysed respondents match the current filters.", "fa-filter-circle-xmark"));
  const levelBadge = (l) => (l ? `<span class="badge ${l === "High" ? "b-good" : l === "Moderate" ? "b-warn" : "b-bad"}">${l}</span>` : "–");
  const plural = (n, w) => `${K.int(n)} ${w}${n === 1 ? "" : "s"}`;

  // ---------------------------------------------------------------- summaries
  const idxCI = (rows, k) => { const c = S.ci(rows.map((r) => r.idx[k])); return c; };
  const themeIdx = (rows) => K.THEMES.map((t) => Object.assign({ key: t.key, label: t.label }, idxCI(rows, t.key)));
  const levelShares = (rows, k) => {
    const v = rows.map((r) => K.level(r.idx[k])).filter(Boolean);
    const o = { n: v.length }; ["Low", "Moderate", "High"].forEach((l) => (o[l] = v.length ? v.filter((x) => x === l).length / v.length : null)); return o;
  };
  // per statement: share of each clarity code (4 strong clarity … 1 strong difficulty) among substantive answers
  const itemClarity = (rows, filterFn) => K.ITEMS.filter(filterFn || (() => true)).map((it) => {
    const codes = rows.map((r) => r.a[it.key]).filter((x) => x != null);
    const subs = codes.filter((c) => c !== 9), cnt = { 1: 0, 2: 0, 3: 0, 4: 0 };
    subs.forEach((c) => cnt[K.clearness(it, c)]++);
    const share = (k) => (subs.length ? cnt[k] / subs.length : null);
    return Object.assign({}, it, { n: codes.length, subs: subs.length, cnt,
      p: { 1: share(1), 2: share(2), 3: share(3), 4: share(4) },
      clear: subs.length ? (cnt[3] + cnt[4]) / subs.length : null,
      notSure: codes.length ? (codes.length - subs.length) / codes.length : null,
      // the plain-language answer that shows clarity / difficulty for this statement
      clearWord: it.reverse ? "disagree" : "agree", diffWord: it.reverse ? "agree" : "disagree" });
  });
  const groupsFor = (dim, rows) => {
    if (dim === "age") return K.AGE_VALID.map((a) => ({ g: a, rows: rows.filter((r) => r.age === a), rest: rows.filter((r) => r.age !== a) }));
    const field = dim, opts = dim === "act" ? K.D.activity_options : K.D.circumstance_options;
    return opts.map((o) => ({ g: o, rows: rows.filter((r) => r[field].includes(o)), rest: rows.filter((r) => !r[field].includes(o)) }));
  };
  const DIM_LABEL = { age: "Age group", act: "Main activity", circ: "Life circumstances" };
  const groupName = (dim, g) => (dim === "age" ? `Respondents aged ${g}` : dim === "act" ? `Respondents who are “${g}”` : `Respondents who are “${g}”`);
  // all group-vs-rest differences that are likely real (95% CI of the gap excludes 0)
  const realGaps = (rows, dims) => {
    const out = [];
    dims.forEach((dim) => groupsFor(dim, rows).forEach((G) => {
      if (G.rows.length < K.MIN_GROUP || G.rest.length < K.MIN_GROUP) return;
      OUTCOMES().forEach(([k]) => { const d = S.diff(G.rows.map((r) => r.idx[k]), G.rest.map((r) => r.idx[k])); if (d && d.real) out.push(Object.assign({ dim, g: G.g, k, n: G.rows.length }, d)); });
    }));
    return out.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  };
  const gapSentence = (x) => `<b>${K.esc(groupName(x.dim, x.g))}</b> score <b>${K.i0(Math.abs(x.d))} points ${x.d > 0 ? "higher" : "lower"}</b> than everyone else on <b>${x.k === "overall" ? "the overall index" : themeLabel(x.k)}</b> <span class="muted">(95% CI ${K.i0(Math.abs(x.d > 0 ? x.lo : x.hi))}–${K.i0(Math.abs(x.d > 0 ? x.hi : x.lo))} points; n = ${x.n})</span>`;

  // ---------------------------------------------------------------- charts
  // horizontal index bars (0–100) on Low / Moderate / High zones, with 95% CI
  function chartIndex(id, list, opts = {}) {
    const L = [...list].reverse();
    const zone = (x0, x1, c) => ({ type: "rect", xref: "x", yref: "paper", x0, x1, y0: 0, y1: 1, fillcolor: c, line: { width: 0 }, layer: "below" });
    const zl = (x, t) => ({ x, y: 1, yref: "paper", yanchor: "bottom", text: t, showarrow: false, font: { size: 11, color: K.css("--muted") } });
    K.plot(id, [{
      type: "bar", orientation: "h", y: L.map((d) => d.label), x: L.map((d) => d.mean),
      marker: { color: L.map((d) => d.color || K.css("--accent-2")), line: { color: K.css("--surface"), width: 1.5 } }, width: 0.55,
      error_x: { type: "data", symmetric: false, array: L.map((d) => (d.hi == null ? 0 : Math.min(100, d.hi) - d.mean)), arrayminus: L.map((d) => (d.lo == null ? 0 : d.mean - Math.max(0, d.lo))), color: K.css("--text-2"), thickness: 1.4, width: 4 },
      text: L.map((d) => `<b>${K.i0(d.mean)}</b>`), textposition: "inside", insidetextanchor: "start", textfont: { color: "#fff", size: 12.5 },
      customdata: L.map((d) => [d.n, K.i0(d.lo), K.i0(d.hi), K.level(d.mean)]),
      hovertemplate: "<b>%{y}</b><br>Index %{x:.0f} / 100 · %{customdata[3]}<br>95% CI %{customdata[1]}–%{customdata[2]} · n = %{customdata[0]}<extra></extra>",
    }], {
      xaxis: { range: [0, 108], tickvals: [0, 20, 40, 60, 70, 80, 100], title: { text: opts.xtitle || "Self-Clarity Index (0 = least, 100 = clearest)" } },
      yaxis: { automargin: true }, margin: { l: 10, t: 26, r: 26 },
      shapes: [zone(0, 40, K.css("--bad-soft")), zone(40, 70, K.css("--warn-soft")), zone(70, 100, K.css("--good-soft"))],
      annotations: [zl(20, "Low"), zl(55, "Moderate"), zl(85, "High")],
    }, { height: opts.height || 90 + 46 * L.length, onClick: opts.onClick });
  }
  // 100% stacked bar of Low / Moderate / High for one or more rows
  function chartLevels(id, rowsList, opts = {}) {
    const labels = rowsList.map((x) => x.label).reverse(), data = rowsList.map((x) => x.sh).reverse();
    K.plot(id, ["Low", "Moderate", "High"].map((l) => ({
      type: "bar", orientation: "h", name: l, y: labels, x: data.map((d) => 100 * (d[l] || 0)),
      marker: { color: K.levelColor(l), line: { color: K.css("--surface"), width: 2 } },
      text: data.map((d) => ((d[l] || 0) >= 0.1 ? Math.round(100 * d[l]) + "%" : "")), textposition: "inside", insidetextanchor: "middle", textangle: 0, constraintext: "none", textfont: { color: "#fff", size: 12 },
      customdata: data.map((d) => [Math.round((d[l] || 0) * d.n), d.n]),
      hovertemplate: `<b>%{y}</b><br>${l}: %{x:.0f}% (%{customdata[0]} of %{customdata[1]})<extra></extra>`,
    })), { barmode: "stack", legend: { traceorder: "normal" }, xaxis: { range: [0, 100], ticksuffix: "%", showgrid: false }, yaxis: { automargin: true }, margin: { l: 10, t: 30 } },
    { height: opts.height || 110 + 40 * labels.length });
  }
  // diverging bar: difficulty to the left, self-clarity to the right
  function chartClarity(id, items, opts = {}) {
    const ylab = items.map((i) => `Q${i.num} · ${i.short}`);
    const spec = [[2, -1], [1, -1], [3, 1], [4, 1]];
    K.plot(id, spec.map(([c, sgn]) => ({
      type: "bar", orientation: "h", name: K.CLEAR_LABEL[c], legendrank: c, y: ylab, x: items.map((i) => sgn * 100 * (i.p[c] || 0)),
      marker: { color: K.clearColor(c), line: { color: K.css("--surface"), width: 1 } },
      text: labelsOn() ? items.map((i) => ((i.p[c] || 0) >= 0.08 ? Math.round(100 * i.p[c]) + "%" : "")) : undefined,
      textposition: "inside", insidetextanchor: "middle", textfont: { color: c === 3 || c === 2 ? "#14201e" : "#fff", size: 11 },
      customdata: items.map((i) => [Math.round(100 * (i.p[c] || 0)), i.cnt[c], c >= 3 ? i.clearWord : i.diffWord, i.reverse ? "reverse-worded: disagreeing shows clarity" : "agreeing shows clarity"]),
      hovertemplate: `<b>%{y}</b><br>${K.CLEAR_LABEL[c]}: %{customdata[0]}% (%{customdata[1]} people)<br><span style="font-size:11px">%{customdata[3]}</span><extra></extra>`,
    })), {
      barmode: "relative", bargap: 0.25, legend: { traceorder: "normal" }, margin: { l: 10, t: 34 },
      xaxis: { range: [-100, 100], tickvals: [-100, -50, 0, 50, 100], ticktext: ["100%", "50%", "0", "50%", "100%"], title: { text: "←  difficulty      ·      self-clarity  →" } },
      yaxis: { autorange: "reversed", automargin: true, tickfont: { size: 11.5 } },
      shapes: [{ type: "line", x0: 0, x1: 0, y0: 0, y1: 1, yref: "paper", line: { color: K.css("--text-2"), width: 1.2 } }],
    }, { height: opts.height || 120 + 30 * items.length });
  }

  // ---------------------------------------------------------------- key findings (auto-written)
  function findings(rows, all) {
    const out = [];
    const oc = idxCI(rows, "overall"), sh = levelShares(rows, "overall");
    if (oc.mean != null) out.push(["info", "fa-gauge-high", `The average Self-Clarity Index is <b>${K.i0(oc.mean)} out of 100</b>${oc.lo != null ? ` (95% CI ${K.i0(oc.lo)}–${K.i0(oc.hi)})` : ""}, which is in the <b>${K.level(oc.mean).toLowerCase()}</b> range. ${K.pct(sh.High)} of respondents are High, ${K.pct(sh.Moderate)} Moderate and ${K.pct(sh.Low)} Low.`]);
    const ts = themeIdx(rows).filter((t) => t.mean != null).sort((a, b) => b.mean - a.mean);
    if (ts.length > 1) out.push(["up", "fa-arrow-trend-up", `The clearest area is <b>${ts[0].label}</b> (${K.i0(ts[0].mean)}); the area with most room to grow is <b>${ts[ts.length - 1].label}</b> (${K.i0(ts[ts.length - 1].mean)}), a gap of ${K.i0(ts[0].mean - ts[ts.length - 1].mean)} points.`]);
    const it = itemClarity(rows).filter((i) => i.clear != null).sort((a, b) => b.clear - a.clear);
    if (it.length) {
      const top = it[0], low = it[it.length - 1];
      out.push(["up", "fa-star", `Strongest statement: <b>${K.pct(top.clear)}</b> ${top.clearWord} that “${K.esc(K.D.statements[top.key])}”`]);
      out.push(["down", "fa-seedling", `Biggest growth area: <b>${K.pct(1 - low.clear)}</b> ${low.diffWord} that “${K.esc(K.D.statements[low.key])}”`]);
    }
    const gaps = realGaps(rows, ["age"]);
    out.push(gaps.length ? ["info", "fa-people-arrows", `Age makes a difference: ${gapSentence(gaps[0])}.`]
      : ["info", "fa-people-arrows", `No clear differences between age groups yet${rows.length < 60 ? `; with ${K.int(rows.length)} respondents only large gaps can be detected` : ""}.`]);
    const ns = rows.reduce((s, r) => s + r.nNS, 0), ans = rows.reduce((s, r) => s + r.nAns, 0);
    if (ans) out.push(["info", "fa-circle-question", `‘Not sure’ was chosen for ${K.pct(ns / ans, 1)} of answers; these are left out of the index.`]);
    return out;
  }
  const findingsHTML = (list) => `<ul class="insights">${list.map(([cls, ic, html]) => `<li><span class="dot ${cls}"><i class="fa-solid ${ic}"></i></span><div>${html}</div></li>`).join("")}</ul>`;

  // ======================================================================= 1 · SUMMARY
  P.summary = {
    title: "Summary", section: "Results", icon: "fa-gauge-high", q: "How clearly do adults understand themselves?",
    render(el) {
      const rows = K.analysed(), all = K.allFiltered();
      const oc = idxCI(rows, "overall"), sh = levelShares(rows, "overall");
      const ns = rows.reduce((s, r) => s + r.nNS, 0), ans = rows.reduce((s, r) => s + r.nAns, 0);
      const lastDate = all.map((r) => r.date).filter(Boolean).sort().pop();
      const headline = rows.length
        ? `Across <b>${plural(rows.length, "respondent")}</b>, the average <b>Self-Clarity Index is ${K.i0(oc.mean)} out of 100</b> (${K.level(oc.mean)}). It combines all 21 statements into one score where <b>higher always means a clearer sense of self</b>: 0–39 Low, 40–69 Moderate, 70–100 High. Data up to ${K.dateLabel(lastDate)}.`
        : "No analysed respondents match the current filters. Reset the filters in the sidebar to see all results.";
      el.innerHTML = `
        ${K.hero("How clearly do adults understand themselves?", "Results of the anonymous survey of adults aged 18–50 in Rwanda.", "fa-gauge-high")}
        ${K.about(headline, "In one sentence")}
        <div class="kpi-grid hero-k">
          ${K.kpi({ cls: "k1", icon: "fa-gauge-high", label: "Self-Clarity Index", value: `${K.i0(oc.mean)}<small>/100</small>`, sub: oc.lo != null ? `95% CI ${K.i0(oc.lo)}–${K.i0(oc.hi)} · ${K.level(oc.mean) || ""}` : K.level(oc.mean) || "", bar: oc.mean })}
          ${K.kpi({ cls: "k2", icon: "fa-star", label: "High self-clarity", value: K.pct(sh.High), sub: `${K.int(Math.round((sh.High || 0) * sh.n))} of ${K.int(sh.n)} score 70 or more`, bar: 100 * (sh.High || 0) })}
          ${K.kpi({ cls: "k3", icon: "fa-user-check", label: "Respondents analysed", value: K.int(rows.length), sub: `of ${K.int(all.length)} submissions (eligible and consenting)`, bar: all.length ? 100 * rows.length / all.length : 0 })}
          ${K.kpi({ cls: "k4", icon: "fa-circle-question", label: "‘Not sure’ answers", value: K.pct(ans ? ns / ans : null, 1), sub: "left out of the index", bar: ans ? 100 * ns / ans : 0 })}
        </div>
        <div class="grid">
          ${K.card({ span: 7, icon: "fa-chart-bar", title: "Self-Clarity Index by theme", sub: "Average 0–100 with 95% confidence interval · click a theme to open it", body: needRows(rows, K.chartDiv("c-themes")) })}
          ${K.card({ span: 5, icon: "fa-layer-group", title: "How many people are at each level", sub: "Overall index · Low 0–39 · Moderate 40–69 · High 70–100", body: needRows(rows, K.chartDiv("c-levels")) })}
        </div>
        <div class="grid">${K.card({ span: 12, icon: "fa-lightbulb", title: "Key findings", sub: "Written automatically from the data · they follow your filters", body: needRows(rows, findingsHTML(findings(rows, all))) })}</div>`;
      if (!rows.length) return;
      chartIndex("c-themes", themeIdx(rows).sort((a, b) => b.mean - a.mean), {
        onClick: (e) => { const t = K.THEMES.find((x) => x.label === e.points[0].y); if (t) { P.themes.theme = t.key; K.go("themes"); } } });
      chartLevels("c-levels", [{ label: "All respondents", sh }, ...K.AGE_VALID.map((a) => ({ label: a, sh: levelShares(rows.filter((r) => r.age === a), "overall") })).filter((x) => x.sh.n >= 1)]);
    },
  };

  // ======================================================================= 2 · WHO ANSWERED
  P.respondents = {
    title: "Who answered", section: "Results", icon: "fa-users", q: "Who is in the data?",
    render(el) {
      const rows = K.analysed(), all = K.allFiltered(), n = rows.length;
      const ageCounts = K.AGE_VALID.map((a) => rows.filter((r) => r.age === a).length);
      const opt = (list, field) => list.map((o) => ({ o, n: rows.filter((r) => r[field].includes(o)).length })).filter((d) => d.n > 0 || K.state[field] === d.o).sort((a, b) => a.n - b.n);
      const acts = opt(K.D.activity_options, "act"), circs = opt(K.D.circumstance_options, "circ");
      const others = rows.filter((r) => r.act_other).map((r) => ({ date: r.date, age: r.age, text: r.act_other }));
      const ageTop = ageCounts.indexOf(Math.max(...ageCounts));
      el.innerHTML = `
        ${K.hero("Who is in the data?", "The people whose answers are analysed: age, main activities and life circumstances.", "fa-users")}
        ${K.about(`<b>${K.int(n)}</b> of ${K.int(all.length)} submissions are analysed: people aged 18–50 who live in Rwanda and agreed to take part. Q4 and Q5 allow several answers, so percentages can add up to more than 100%. <b>Click any bar</b> to filter the whole dashboard by that group.`, "How to read this page")}
        <div class="kpi-grid small-k">
          ${K.stat({ label: "Respondents analysed", value: K.int(n), icon: "fa-user-check", sub: "eligible and consenting" })}
          ${K.stat({ label: "Largest age group", value: n ? K.AGE_VALID[ageTop] : "–", icon: "fa-cake-candles", color: K.series(0), sub: n ? `${K.pct(ageCounts[ageTop] / n)} of respondents` : "" })}
          ${K.stat({ label: "Most common activity", value: acts.length && acts[acts.length - 1].n ? K.esc(acts[acts.length - 1].o) : "–", icon: "fa-briefcase", color: K.series(1), sub: acts.length && n ? `${K.pct(acts[acts.length - 1].n / n)} of respondents` : "" })}
          ${K.stat({ label: "Most common circumstance", value: circs.length && circs[circs.length - 1].n ? K.esc(circs[circs.length - 1].o) : "–", icon: "fa-house-user", color: K.series(2), sub: circs.length && n ? `${K.pct(circs[circs.length - 1].n / n)} of respondents` : "" })}
        </div>
        <div class="grid">
          ${K.card({ span: 5, icon: "fa-cake-candles", title: "Age group", sub: "Number of respondents · click to filter", body: needRows(rows, K.chartDiv("c-age")) })}
          ${K.card({ span: 7, icon: "fa-briefcase", title: "Main activity (Q4)", sub: "% of respondents · several answers allowed · click to filter", body: needRows(rows, K.chartDiv("c-act")) })}
        </div>
        <div class="grid">
          ${K.card({ span: 7, icon: "fa-house-user", title: "Life circumstances (Q5)", sub: "% of respondents · several answers allowed · click to filter", body: needRows(rows, K.chartDiv("c-circ")) })}
          ${K.card({ span: 5, icon: "fa-filter", title: "From submissions to analysis", sub: "Who was screened out, and at which question", body: K.chartDiv("c-funnel") })}
        </div>
        ${others.length ? `<div class="grid">${K.card({ span: 12, icon: "fa-pen-to-square", title: "‘Other’ activities, as written", body: '<div id="t-other"></div>' })}</div>` : ""}`;
      const stages = [["All submissions", all.length], ["Aged 18–50", all.filter((r) => K.AGE_VALID.includes(r.age)).length],
        ["Living in Rwanda", all.filter((r) => K.AGE_VALID.includes(r.age) && r.lives === "Yes").length], ["Consented · analysed", n]];
      K.plot("c-funnel", [{ type: "funnel", y: stages.map((s) => s[0]), x: stages.map((s) => s[1]), textinfo: "value+percent initial", textfont: { color: "#fff" },
        marker: { color: ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab"] }, connector: { fillcolor: K.css("--surface-3"), line: { width: 0 } }, hovertemplate: "%{y}: %{x}<extra></extra>" }],
        { margin: { l: 10 }, yaxis: { automargin: true } }, { height: 300 });
      if (!n) return;
      K.plot("c-age", [{ type: "bar", x: K.AGE_VALID, y: ageCounts, marker: { color: K.AGE_VALID.map((a) => (K.state.age && K.state.age !== a ? K.css("--surface-3") : K.blue())) },
        text: ageCounts.map((c) => `${c} · ${K.pct(c / n)}`), textposition: "outside", cliponaxis: false, textfont: { color: K.css("--text-2") },
        hovertemplate: "<b>%{x}</b><br>%{y} respondents<extra></extra>" }],
        { yaxis: { title: { text: "Respondents" }, rangemode: "tozero" }, margin: { t: 24 } }, { height: 320, onClick: (e) => K.setFilter("age", e.points[0].x) });
      const hbar = (id, arr, field) => K.plot(id, [{ type: "bar", orientation: "h", y: arr.map((d) => d.o), x: arr.map((d) => 100 * d.n / n),
        marker: { color: arr.map((d) => (K.state[field] && K.state[field] !== d.o ? K.css("--surface-3") : K.blue())) },
        text: arr.map((d) => `${Math.round(100 * d.n / n)}% · ${d.n}`), textposition: "outside", cliponaxis: false, textfont: { color: K.css("--text-2") },
        hovertemplate: "<b>%{y}</b><br>%{x:.0f}% of respondents<extra></extra>" }],
        { xaxis: { ticksuffix: "%", title: { text: "% of respondents" }, rangemode: "tozero" }, margin: { l: 10, r: 60 } },
        { height: 80 + 34 * Math.max(arr.length, 3), onClick: (e) => K.setFilter(field, e.points[0].y) });
      hbar("c-act", acts, "act"); hbar("c-circ", circs, "circ");
      if (others.length) K.table("t-other", [{ title: "Date", data: "date" }, { title: "Age group", data: "age" }, { title: "Activity (as written)", data: "text", className: "wrap" }], others, { filename: "other_activities", pageLength: 5 });
    },
  };

  // ======================================================================= 3 · STRENGTHS & GROWTH
  P.strengths = {
    title: "Strengths & growth areas", section: "Results", icon: "fa-scale-unbalanced", q: "Where are people clear, and where do they struggle?",
    sort: "theme",
    render(el) {
      const me = this, rows = K.analysed();
      const items = itemClarity(rows);
      const ranked = items.filter((i) => i.clear != null).sort((a, b) => b.clear - a.clear);
      let shown = [...items];
      if (me.sort === "clear") shown = [...ranked, ...items.filter((i) => i.clear == null)];
      const card = (i, good) => `<div class="qcard ${good ? "good" : "grow"}"><div class="qc-top"><span class="qc-pct">${K.pct(good ? i.clear : 1 - i.clear)}</span><span class="qc-what">${good ? i.clearWord : i.diffWord}</span><span class="badge b-neutral">${themeLabel(i.theme)}</span></div>
          <p>“${K.esc(K.D.statements[i.key])}”</p><small>Q${i.num} · ${i.subs} answers${i.reverse ? " · reverse-worded: disagreeing shows clarity" : ""}</small></div>`;
      el.innerHTML = `
        ${K.hero("Where are people clear, and where do they struggle?", "Each of the 21 statements, read in the direction of self-clarity.", "fa-scale-unbalanced")}
        ${K.about(`Some statements are worded so that <b>agreeing</b> shows self-clarity (“I can name my values”), others so that <b>disagreeing</b> does (“I copy others to feel accepted”). Here every answer is turned the same way: <b style="color:${K.clearColor(4)}">green-blue to the right = self-clarity</b>, <b style="color:${K.clearColor(1)}">orange to the left = difficulty</b>. ‘Not sure’ is left out. Hover a bar to see how the statement is worded.`, "How to read this page")}
        <div class="grid">
          ${K.card({ span: 6, icon: "fa-star", title: "Top 3 strengths", sub: "Statements with the highest share of self-clear answers", body: needRows(rows, `<div class="qgrid">${ranked.slice(0, 3).map((i) => card(i, true)).join("")}</div>`) })}
          ${K.card({ span: 6, icon: "fa-seedling", title: "Top 3 growth areas", sub: "Statements with the highest share of answers showing difficulty", body: needRows(rows, `<div class="qgrid">${ranked.slice(-3).reverse().map((i) => card(i, false)).join("")}</div>`) })}
        </div>
        <div class="grid">${K.card({ span: 12, icon: "fa-chart-simple", title: "All 21 statements", sub: "% of answers showing self-clarity (right) or difficulty (left)",
          tools: `<div class="seg" id="seg-sort">${[["theme", "By theme"], ["clear", "Most clarity first"]].map(([k, l]) => `<button data-v="${k}" class="${me.sort === k ? "on" : ""}">${l}</button>`).join("")}</div>`,
          body: needRows(rows, K.chartDiv("c-clar")) })}</div>
        <div class="grid">${K.card({ span: 12, icon: "fa-table", title: "Statement table", sub: "Exact percentages · use Columns to show the original answer counts", body: '<div id="t-items"></div>' })}</div>`;
      el.querySelectorAll("#seg-sort button").forEach((b) => b.addEventListener("click", () => { me.sort = b.dataset.v; K.render(); }));
      if (rows.length) chartClarity("c-clar", shown);
      const pc = (v) => (v == null ? "–" : Math.round(100 * v) + "%");
      K.table("t-items", [
        { title: "Q", data: "num", render: (v) => `Q${v}`, className: "dt-type-numeric" },
        { title: "Statement", data: (r) => K.D.statements[r.key], className: "wrap" },
        { title: "Theme", data: (r) => themeLabel(r.theme), filter: "select" },
        { title: "Self-clarity", data: "clear", render: (v, t) => (t === "display" ? `<b>${pc(v)}</b>` : v ?? -1), className: "dt-type-numeric" },
        { title: "Difficulty", data: (r) => (r.clear == null ? null : 1 - r.clear), render: (v, t) => (t === "display" ? pc(v) : v ?? -1), className: "dt-type-numeric" },
        { title: "Not sure", data: "notSure", render: (v, t) => (t === "display" ? pc(v) : v ?? -1), className: "dt-type-numeric" },
        { title: "Answers", data: "n", className: "dt-type-numeric" },
        { title: "Clear answer is", data: "clearWord", visible: false },
        ...[4, 3, 2, 1].map((c) => ({ title: K.CLEAR_LABEL[c], data: (r) => r.cnt[c], className: "dt-type-numeric", visible: false })),
      ], items, { filename: "statements", pageLength: 25, order: [[3, "desc"]] });
    },
  };

  // ======================================================================= 4 · THEMES IN DEPTH
  P.themes = {
    title: "Themes in depth", section: "Results", icon: "fa-shapes", q: "What does each dimension look like?",
    theme: "identity",
    render(el) {
      const me = this, rows = K.analysed();
      const t = K.THEMES.find((x) => x.key === me.theme) || K.THEMES[0];
      const c = idxCI(rows, t.key), sh = levelShares(rows, t.key);
      const items = itemClarity(rows, (it) => it.theme === t.key);
      const best = items.filter((i) => i.clear != null).sort((a, b) => b.clear - a.clear);
      const tabs = `<div class="seg wide" id="seg-theme">${K.THEMES.map((x) => `<button data-v="${x.key}" class="${x.key === t.key ? "on" : ""}"><i class="fa-solid fa-circle" style="color:${K.themeColor(x.key)};font-size:8px"></i> ${x.label}</button>`).join("")}</div>`;
      const ages = K.AGE_VALID.map((a) => Object.assign({ label: a }, idxCI(rows.filter((r) => r.age === a), t.key))).filter((x) => x.n >= 1);
      el.innerHTML = `
        ${K.hero("What does each dimension look like?", "Five themes of self-understanding. Pick a theme to see its score, levels and statements.", "fa-shapes")}
        <div class="tabbar">${tabs}</div>
        ${K.about(`<b>${t.label}</b>: ${THEME_INFO[t.key]} ${rows.length ? `The average index is <b>${K.i0(c.mean)}/100</b> (${K.level(c.mean)}); ${K.pct(sh.High)} of respondents are High on this theme.${best.length > 1 ? ` People are clearest on <span class="qt">“${K.esc(best[0].short)}”</span> and struggle most with <span class="qt">“${K.esc(best[best.length - 1].short)}”</span>.` : ""}` : ""}`, t.label)}
        <div class="kpi-grid small-k">
          ${K.stat({ label: "Theme index", value: `${K.i0(c.mean)}<small>/100</small>`, icon: "fa-gauge", color: K.themeColor(t.key), sub: c.lo != null ? `95% CI ${K.i0(c.lo)}–${K.i0(c.hi)}` : `n = ${c.n}` })}
          ${["High", "Moderate", "Low"].map((l) => K.stat({ label: l, value: K.pct(sh[l]), icon: l === "High" ? "fa-arrow-up" : l === "Low" ? "fa-arrow-down" : "fa-minus", color: K.levelColor(l), sub: `${K.int(Math.round((sh[l] || 0) * sh.n))} people` })).join("")}
          ${K.stat({ label: "Statements", value: items.length, icon: "fa-list", color: K.themeColor(t.key), sub: "in this theme" })}
        </div>
        <div class="grid">${K.card({ span: 12, icon: "fa-chart-simple", title: `${t.label}: the statements`, sub: "% of answers showing self-clarity (right) or difficulty (left)", body: needRows(rows, K.chartDiv("c-tclar")) })}</div>
        <div class="grid">
          ${K.card({ span: 6, icon: "fa-layer-group", title: "Levels on this theme", sub: "Low 0–39 · Moderate 40–69 · High 70–100", body: needRows(rows, K.chartDiv("c-tlev")) })}
          ${K.card({ span: 6, icon: "fa-cake-candles", title: "By age group", sub: "Theme index with 95% CI · see ‘Who differs’ for tests", tools: `<button class="pill" id="go-diff"><i class="fa-solid fa-people-arrows"></i><span class="lbl">Compare groups</span></button>`, body: needRows(rows, K.chartDiv("c-tage")) })}
        </div>`;
      el.querySelectorAll("#seg-theme button").forEach((b) => b.addEventListener("click", () => { me.theme = b.dataset.v; K.render(); }));
      el.querySelector("#go-diff").addEventListener("click", () => { P.differences.outcome = t.key; K.go("differences"); });
      if (!rows.length) return;
      chartClarity("c-tclar", items, { height: 150 + 40 * items.length });
      chartLevels("c-tlev", [{ label: "All respondents", sh }, ...K.AGE_VALID.map((a) => ({ label: a, sh: levelShares(rows.filter((r) => r.age === a), t.key) })).filter((x) => x.sh.n >= 1)]);
      chartIndex("c-tage", ages, { xtitle: `${t.label} index (0–100)` });
    },
  };

  // ======================================================================= 5 · WHO DIFFERS
  P.differences = {
    title: "Who differs", section: "Results", icon: "fa-people-arrows", q: "Do groups differ?",
    dim: "age", outcome: "overall",
    render(el) {
      const me = this, rows = K.analysed();
      const G = groupsFor(me.dim, rows).filter((g) => g.rows.length > 0);
      const gaps = realGaps(rows, [me.dim]);
      const outs = OUTCOMES();
      const dimSeg = `<div class="seg" id="seg-dim">${Object.entries(DIM_LABEL).map(([k, l]) => `<button data-v="${k}" class="${me.dim === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
      const outSel = `<select class="sel" id="sel-out">${outs.map(([k, l]) => `<option value="${k}" ${me.outcome === k ? "selected" : ""}>${l}</option>`).join("")}</select>`;
      // heat table: group × outcome (index), ▲/▼ where the group differs from everyone else
      // shade each column from its lowest to its highest group (darker = higher index)
      const colRange = {}; outs.forEach(([k]) => { const v = G.filter((g) => g.rows.length >= K.MIN_GROUP).map((g) => S.mean(g.rows.map((r) => r.idx[k]))).filter((x) => x != null); colRange[k] = [Math.min(...v), Math.max(...v)]; });
      const shade = (k, m) => { const [lo, hi] = colRange[k]; const f = (m - lo) / Math.max(hi - lo, 15); return Math.round(10 + 45 * (isFinite(f) ? f : 0.5)); };
      const cell = (g, k) => {
        const m = S.mean(g.rows.map((r) => r.idx[k]));
        if (m == null) return `<td class="na">–</td>`;
        const small = g.rows.length < K.MIN_GROUP;
        const d = !small && g.rest.length >= K.MIN_GROUP ? S.diff(g.rows.map((r) => r.idx[k]), g.rest.map((r) => r.idx[k])) : null;
        const mark = d && d.real ? `<span class="mk ${d.d > 0 ? "up" : "down"}" title="Likely a real difference vs everyone else (${d.d > 0 ? "+" : "−"}${K.i0(Math.abs(d.d))} points)">${d.d > 0 ? "▲" : "▼"}</span>` : "";
        return `<td style="--p:${small ? 8 : shade(k, m)}%" class="${small ? "small" : ""}" title="${K.level(m)}"><span class="v">${K.i0(m)}</span>${mark}</td>`;
      };
      const table = `<div class="table-wrap"><table class="htable"><thead><tr><th>${DIM_LABEL[me.dim]}</th><th>n</th>${outs.map(([k, l]) => `<th>${l}</th>`).join("")}</tr></thead><tbody>
        ${G.map((g) => `<tr><th>${K.esc(g.g)}${g.rows.length < K.MIN_GROUP ? ' <span class="badge b-neutral" title="Fewer than 5 people: shown but not compared">small</span>' : ""}</th><td class="n">${g.rows.length}</td>${outs.map(([k]) => cell(g, k)).join("")}</tr>`).join("")}
        <tr class="all"><th>All respondents</th><td class="n">${rows.length}</td>${outs.map(([k]) => `<td class="allv"><span class="v">${K.i0(S.mean(rows.map((r) => r.idx[k])))}</span></td>`).join("")}</tr>
        </tbody></table></div>
        <div class="hnote">Darker cell = higher index within that column. <b><span style="color:var(--good)">▲</span> / <span style="color:var(--bad)">▼</span></b> = this group scores higher / lower than everyone else, and the 95% confidence interval of the gap excludes zero (likely a real difference). Groups with fewer than ${K.MIN_GROUP} people are shown faded and not compared.</div>`;
      el.innerHTML = `
        ${K.hero("Do groups differ?", "Compare the Self-Clarity Index between age groups, main activities and life circumstances.", "fa-people-arrows")}
        ${K.about(rows.length ? (gaps.length ? `<b>${gaps.length} likely real difference${gaps.length > 1 ? "s" : ""}</b> for ${DIM_LABEL[me.dim].toLowerCase()}:<ul class="plain">${gaps.slice(0, 4).map((x) => `<li>${gapSentence(x)}.</li>`).join("")}</ul>` : `No difference between ${DIM_LABEL[me.dim].toLowerCase()} groups is clear enough yet. With ${plural(rows.length, "respondent")}, small gaps cannot be told apart from chance; check again as more responses come in.`) : "No analysed respondents match the current filters.", "What stands out")}
        <div class="grid">${K.card({ span: 12, icon: "fa-chart-gantt", title: `${themeLabel(me.outcome)} by ${DIM_LABEL[me.dim].toLowerCase()}`, sub: "Average with 95% CI · dotted line = all respondents · grey = fewer than 5 people", tools: dimSeg + outSel, body: needRows(rows, K.chartDiv("c-grp")) })}</div>
        <div class="grid">${K.card({ span: 12, icon: "fa-table-cells", title: "All themes at a glance", sub: `Self-Clarity Index (0–100) per ${DIM_LABEL[me.dim].toLowerCase()} and theme`, body: needRows(rows, table) })}</div>`;
      el.querySelectorAll("#seg-dim button").forEach((b) => b.addEventListener("click", () => { me.dim = b.dataset.v; K.render(); }));
      el.querySelector("#sel-out").addEventListener("change", (e) => { me.outcome = e.target.value; K.render(); });
      if (!rows.length) return;
      const list = G.map((g) => Object.assign({ label: `${g.g} (n=${g.rows.length})`, small: g.rows.length < K.MIN_GROUP }, idxCI(g.rows, me.outcome))).filter((x) => x.mean != null).reverse();
      const allM = S.mean(rows.map((r) => r.idx[me.outcome]));
      const col = me.outcome === "overall" ? K.css("--accent") : K.themeColor(me.outcome);
      K.plot("c-grp", [{
        type: "scatter", mode: "markers+text", y: list.map((d) => d.label), x: list.map((d) => d.mean),
        marker: { size: 14, color: list.map((d) => (d.small ? K.css("--surface-3") : col)), line: { color: list.map((d) => (d.small ? K.css("--muted") : K.css("--surface"))), width: 2 } },
        error_x: { type: "data", symmetric: false, array: list.map((d) => (d.hi == null ? 0 : Math.min(100, d.hi) - d.mean)), arrayminus: list.map((d) => (d.lo == null ? 0 : d.mean - Math.max(0, d.lo))), color: K.css("--text-2"), thickness: 1.4, width: 5 },
        text: list.map((d) => K.i0(d.mean)), textposition: "top center", textfont: { color: K.css("--text-2"), size: 11.5 },
        customdata: list.map((d) => [K.i0(d.lo), K.i0(d.hi), K.level(d.mean)]),
        hovertemplate: "<b>%{y}</b><br>Index %{x:.0f} · %{customdata[2]}<br>95% CI %{customdata[0]}–%{customdata[1]}<extra></extra>",
      }], {
        xaxis: { range: [0, 100], tickvals: [0, 20, 40, 60, 70, 80, 100], title: { text: `${themeLabel(me.outcome)} (0–100)` } }, yaxis: { automargin: true }, margin: { l: 10, t: 26 },
        shapes: [
          { type: "rect", xref: "x", yref: "paper", x0: 0, x1: 40, y0: 0, y1: 1, fillcolor: K.css("--bad-soft"), line: { width: 0 }, layer: "below" },
          { type: "rect", xref: "x", yref: "paper", x0: 40, x1: 70, y0: 0, y1: 1, fillcolor: K.css("--warn-soft"), line: { width: 0 }, layer: "below" },
          { type: "rect", xref: "x", yref: "paper", x0: 70, x1: 100, y0: 0, y1: 1, fillcolor: K.css("--good-soft"), line: { width: 0 }, layer: "below" },
          ...(allM != null ? [{ type: "line", x0: allM, x1: allM, y0: 0, y1: 1, yref: "paper", line: { color: K.css("--text-2"), dash: "dot", width: 1.3 } }] : []),
        ],
        annotations: allM != null ? [{ x: allM, y: 1, yref: "paper", yanchor: "bottom", text: `All: ${K.i0(allM)}`, showarrow: false, font: { size: 11, color: K.css("--text-2") } }] : [],
      }, { height: 110 + 46 * Math.max(list.length, 2) });
    },
  };

  // ======================================================================= 6 · IN THEIR OWN WORDS
  const STOP = new Set("a about above after again all also am an and any are as at be because been being but by can could did do does doing don for from had has have having he her here him his how i if in into is it its just like me more most my myself no not of on once only or other our out over own people person same she should so some someone something still such than that the their them then there these they this those through to too try us very want was we were what when where which while who why will with would you your yourself always never really things thing life lot much many make makes".split(" "));
  P.voices = {
    title: "In their own words", section: "Results", icon: "fa-comments", q: "What do people say about themselves?",
    lvl: "",
    render(el) {
      const me = this, rows = K.analysed();
      const withC = rows.filter((r) => r.comment);
      const shown = withC.filter((r) => !me.lvl || r.lvl === me.lvl);
      const words = {}; withC.forEach((r) => String(r.comment).toLowerCase().replace(/[^a-z\s'-]/g, " ").split(/\s+/).forEach((w) => { w = w.replace(/^'+|'+$/g, ""); if (w.length > 2 && !STOP.has(w)) words[w] = (words[w] || 0) + 1; }));
      const topW = Object.entries(words).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 15).reverse();
      const avgW = withC.length ? S.mean(withC.map((r) => String(r.comment).trim().split(/\s+/).length)) : null;
      el.innerHTML = `
        ${K.hero("What do people say about themselves?", "Answers to Q27: “Tell us about yourself without telling us what you do.”", "fa-comments")}
        ${K.about(`Comments are optional and shown as written. They follow the sidebar filters; the buttons below also filter by each person's overall level. <b>Check for identifying details before sharing any quote.</b>`, "About these comments")}
        <div class="kpi-grid small-k">
          ${K.stat({ label: "Comments", value: K.int(withC.length), icon: "fa-comment-dots", sub: rows.length ? `${K.pct(withC.length / rows.length)} of respondents wrote one` : "" })}
          ${K.stat({ label: "Average length", value: avgW == null ? "–" : `${Math.round(avgW)} words`, icon: "fa-align-left", color: K.series(1), sub: "limit: 50 words" })}
          ${K.stat({ label: "Most used word", value: topW.length ? K.esc(topW[topW.length - 1][0]) : "–", icon: "fa-font", color: K.series(2), sub: topW.length ? `${topW[topW.length - 1][1]} times` : "needs 2+ uses" })}
        </div>
        <div class="grid">
          ${K.card({ span: 8, icon: "fa-quote-left", title: "Quotes", sub: `${K.int(shown.length)} shown`, tools: `<div class="seg" id="seg-lvl">${[["", "All"], ["High", "High"], ["Moderate", "Moderate"], ["Low", "Low"]].map(([k, l]) => `<button data-v="${k}" class="${me.lvl === k ? "on" : ""}">${l}</button>`).join("")}</div>`,
            body: shown.length ? `<div class="quotes">${shown.map((r) => `<figure class="quote"><blockquote>${K.esc(r.comment)}</blockquote><figcaption>${K.esc(r.age || "")} · ${K.esc(r.mainAct)} · ${levelBadge(r.lvl)}</figcaption></figure>`).join("")}</div>` : K.empty("No comments match.", "fa-comment-slash") })}
          ${K.card({ span: 4, icon: "fa-font", title: "Words used most", sub: "Common words such as ‘I’ and ‘the’ are left out", body: topW.length ? K.chartDiv("c-words") : K.empty("Word counts appear once words repeat across comments.", "fa-font") })}
        </div>`;
      el.querySelectorAll("#seg-lvl button").forEach((b) => b.addEventListener("click", () => { me.lvl = b.dataset.v; K.render(); }));
      if (topW.length) K.plot("c-words", [{ type: "bar", orientation: "h", y: topW.map((w) => w[0]), x: topW.map((w) => w[1]), marker: { color: K.css("--accent") },
        text: topW.map((w) => w[1]), textposition: "outside", cliponaxis: false, textfont: { color: K.css("--text-2") }, hovertemplate: "%{y}: %{x}<extra></extra>" }],
        { xaxis: { title: { text: "Comments using the word" }, nticks: 6, rangemode: "tozero" }, margin: { l: 10, r: 30 } }, { height: 80 + 26 * topW.length });
    },
  };

  // ======================================================================= 7 · DATA & METHODS
  P.methods = {
    title: "Data & methods", section: "For researchers", icon: "fa-microscope", q: "How are the numbers made, and can we trust them?",
    scope: "analysed",
    render(el) {
      const me = this, st = K.D.stats, rel = st.reliability || {}, rows = K.analysed(), all = K.allFiltered();
      const data = me.scope === "all" ? all : rows;
      const fl = (k) => all.filter((r) => r.flags && r.flags[k]).length;
      const relRows = [...K.THEMES.map((t) => Object.assign({ key: t.key, label: t.label }, rel[t.key] || {})), Object.assign({ key: "overall", label: "All 21 statements" }, rel.overall || {})];
      const interp = (a) => (a == null ? ["needs more data", "b-neutral"] : a >= 0.8 ? ["good", "b-good"] : a >= 0.7 ? ["acceptable", "b-good"] : a >= 0.6 ? ["questionable", "b-warn"] : ["low", "b-bad"]);
      const itemRel = []; K.THEMES.forEach((t) => ((rel[t.key] && rel[t.key].items) || []).forEach((x) => itemRel.push(Object.assign({}, x, K.ITEM[x.item], { themeAlpha: rel[t.key].alpha }))));
      const flagged = all.filter((r) => r.flags && Object.values(r.flags).some(Boolean));
      const flagNames = { speeder: "Under 3 min", straightline: "Same answer to all", not_sure: "6+ Not sure", incomplete: "Incomplete", duplicate: "Duplicate ID" };
      const tests = st.tests || [];
      el.innerHTML = `
        ${K.hero("How are the numbers made, and can we trust them?", "Every response, scoring rules, reliability and data-quality checks.", "fa-microscope")}
        <div class="kpi-grid small-k">
          ${K.stat({ label: "Submissions", value: K.int(all.length), icon: "fa-inbox" })}
          ${K.stat({ label: "Screened out", value: K.int(all.length - all.filter((r) => r.eligible).length), icon: "fa-user-xmark", color: K.series(7), sub: "age, residence or consent" })}
          ${K.stat({ label: "Under 3 minutes", value: K.int(fl("speeder")), icon: "fa-person-running", color: K.series(3) })}
          ${K.stat({ label: "Same answer to all", value: K.int(fl("straightline")), icon: "fa-grip-lines", color: K.series(1) })}
          ${K.stat({ label: "Reliability (α)", value: K.f(rel.overall && rel.overall.alpha), icon: "fa-scale-balanced", color: K.series(2), sub: rel.overall && rel.overall.lo != null ? `95% CI ${K.f(rel.overall.lo)}–${K.f(rel.overall.hi)}` : "needs more responses" })}
        </div>
        <div class="grid">${K.card({ span: 12, icon: "fa-table", title: "All responses", sub: `${K.int(data.length)} records · search, filter columns, export`,
          tools: `<div class="seg" id="seg-scope"><button data-v="analysed" class="${me.scope === "analysed" ? "on" : ""}">Analysed</button><button data-v="all" class="${me.scope === "all" ? "on" : ""}">All submissions</button></div>`, body: '<div id="t-data"></div>' })}</div>
        <div class="grid">
          ${K.card({ span: 6, icon: "fa-calculator", title: "How the Self-Clarity Index is calculated", body: `<div class="prose"><ol>
            <li><b>Who is analysed</b>: aged 18–50, living in Rwanda, and agreeing to take part.</li>
            <li><b>Answers</b>: Strongly disagree = 1, Disagree = 2, Agree = 3, Strongly agree = 4. ‘Not sure’ is left out.</li>
            <li><b>Direction</b>: for Q${K.ITEMS.filter((i) => i.reverse).map((i) => i.num).join(", Q")}, agreeing shows <em>less</em> self-clarity, so the score is flipped (5 − answer).</li>
            <li><b>Theme score</b>: average of the person's statements in that theme (1–4); <b>overall</b> = average of all 21.</li>
            <li><b>Index</b> = (score − 1) ÷ 3 × 100, so 0 is the least and 100 the clearest possible.</li>
            <li><b>Levels</b>: Low 0–39 · Moderate 40–69 · High 70–100.</li>
            <li><b>95% confidence intervals</b>: t-distribution. <b>Group differences</b>: each group vs everyone else (Welch), shown as ▲/▼ when the interval of the gap excludes zero; groups under ${K.MIN_GROUP} people are not compared. Findings follow the filters.</li>
            <li><b>Quality flags</b>: under 3 minutes, same answer to all statements, 6+ ‘Not sure’, incomplete, duplicate ID. Flagged responses are kept, not removed.</li></ol></div>` })}
          ${K.card({ span: 6, icon: "fa-scale-balanced", title: "Reliability by theme", sub: "Cronbach's α with bootstrap 95% CI (R, all analysed) · dotted line = 0.70 (acceptable)", body: relRows.some((r) => r.alpha != null) ? K.chartDiv("c-alpha") : K.empty("Reliability needs at least 3 complete responses per theme.", "fa-scale-balanced") })}
        </div>
        <div class="grid">${K.card({ span: 12, icon: "fa-list-ol", title: "Reliability and item diagnostics", sub: "Does each statement fit its theme?", body: `<div id="t-rel"></div>${itemRel.some((r) => r.item_total_r != null) ? '<div id="t-itemrel" style="margin-top:18px"></div>' : ""}` })}</div>
        <div class="grid">
          ${K.card({ span: 6, icon: "fa-stopwatch", title: "Time to complete", sub: "All submissions · dotted line = 3 minutes", body: all.some((r) => r.mins != null) ? K.chartDiv("c-mins") : K.empty("No timing data.") })}
          ${K.card({ span: 6, icon: "fa-flag", title: "Responses flagged for review", sub: `${K.int(flagged.length)} records`, body: flagged.length ? '<div id="t-flags"></div>' : K.empty("No responses flagged.", "fa-circle-check") })}
        </div>
        <div class="grid">${K.card({ span: 12, icon: "fa-flask", title: "Advanced: rank-based tests (R)", sub: `${tests.length} tests · Kruskal–Wallis (age) and Wilcoxon (each group vs others) · Benjamini–Hochberg adjusted · all analysed respondents, scores on the 1–4 scale`, body: tests.length ? '<div id="t-tests"></div>' : K.empty("Tests appear once groups have at least 3 people.", "fa-flask") })}</div>
        <div class="grid">
          ${K.card({ span: 8, icon: "fa-book", title: "Codebook", sub: "Full wording of the 21 statements", body: '<div id="t-codebook"></div>' })}
          ${K.card({ span: 4, icon: "fa-database", title: "Data source and updates", body: `<dl class="kv">
              <dt>Source</dt><dd>${K.esc(K.D.meta.data_file)}</dd>
              <dt>Built</dt><dd>${new Date(K.D.meta.built).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</dd>
              <dt>Records</dt><dd>${K.int(K.D.meta.n_all)} submissions · ${K.int(K.D.meta.n_valid)} analysed</dd>
              <dt>Engine</dt><dd>R (cleaning, scoring, statistics) → web app</dd>
              <dt>Downloads</dt><dd><a href="data/respondent_scores.csv" download>respondent_scores.csv</a> (with index columns) · <a href="data/dashboard.json" download>dashboard.json</a></dd></dl>
              <div class="prose"><p>New Microsoft Forms responses reach this dashboard within a few minutes: the responses workbook is checked every minute or two, and R rebuilds the analysis when it changes.</p></div>` })}
        </div>`;
      el.querySelectorAll("#seg-scope button").forEach((b) => b.addEventListener("click", () => { me.scope = b.dataset.v; K.render(); }));

      const num = (k, short) => ({ title: short, data: (r) => r.idx[k], render: (v, t) => (t === "display" ? K.i0(v) : v ?? -1), className: "dt-type-numeric" });
      const cols = [{ title: "ID", data: "id", filter: "text" }, { title: "Date", data: (r) => r.date || "", filter: "text" }, { title: "Age", data: (r) => r.age || "", filter: "select" }];
      if (me.scope === "all") cols.push({ title: "Status", data: (r) => (r.eligible ? "Analysed" : r.reason), filter: "select", render: (v) => `<span class="badge ${v === "Analysed" ? "b-good" : "b-neutral"}">${K.esc(v)}</span>` });
      cols.push(
        { title: "Main activity", data: "mainAct", filter: "select" },
        { title: "Circumstances", data: (r) => r.circ.join("; "), filter: "text", className: "wrap" },
        num("overall", "Index"), { title: "Level", data: (r) => r.lvl || "", render: (v, t) => (t === "display" ? levelBadge(v) : v), filter: "select" },
        ...K.THEMES.map((t) => num(t.key, t.label.split(" ")[0] === "Strengths," ? "Feedback" : t.label)),
        { title: "Not sure", data: "nNS", className: "dt-type-numeric" },
        { title: "Minutes", data: (r) => r.mins, render: (v, t) => (t === "display" ? K.f(v, 1) : v ?? -1), className: "dt-type-numeric" },
        { title: "Comment", data: (r) => r.comment || "", className: "wrap", visible: false },
        ...K.ITEMS.map((it) => ({ title: `Q${it.num}`, data: (r) => { const v = r.a[it.key]; return v == null ? "" : K.LEVELS.find((l) => l.code === v).label; }, visible: false })));
      K.table("t-data", cols, data, { filename: "responses", pageLength: 10, order: [[1, "desc"]] });

      const withA = relRows.filter((r) => r.alpha != null);
      if (withA.length) K.plot("c-alpha", [{ type: "scatter", mode: "markers+text", y: withA.map((r) => r.label), x: withA.map((r) => r.alpha),
        marker: { size: 13, color: withA.map((r) => (r.key === "overall" ? K.css("--accent") : K.themeColor(r.key))), line: { color: K.css("--surface"), width: 2 } },
        error_x: { type: "data", symmetric: false, array: withA.map((r) => (r.hi == null ? 0 : r.hi - r.alpha)), arrayminus: withA.map((r) => (r.lo == null ? 0 : r.alpha - r.lo)), color: K.css("--text-2"), thickness: 1.5, width: 5 },
        text: withA.map((r) => K.f(r.alpha)), textposition: "top center", textfont: { color: K.css("--text-2") }, hovertemplate: "<b>%{y}</b><br>α = %{x:.2f}<extra></extra>" }],
        { margin: { l: 10 }, xaxis: { range: [Math.min(0, ...withA.map((r) => r.lo ?? r.alpha)) - 0.05, 1], title: { text: "Cronbach's α" } }, yaxis: { autorange: "reversed", automargin: true },
          shapes: [{ type: "line", x0: 0.7, x1: 0.7, y0: 0, y1: 1, yref: "paper", line: { color: K.css("--text-2"), dash: "dot", width: 1.2 } }] }, { height: 300 });
      K.table("t-rel", [
        { title: "Theme", data: "label" }, { title: "Statements", data: "k", className: "dt-type-numeric" }, { title: "Complete n", data: "n", className: "dt-type-numeric" },
        { title: "α", data: "alpha", render: (v) => K.f(v), className: "dt-type-numeric" },
        { title: "95% CI", data: (r) => (r.lo == null ? "–" : `${K.f(r.lo)}–${K.f(r.hi)}`), className: "dt-type-numeric", orderable: false },
        { title: "Interpretation", data: "alpha", render: (v) => { const [t, c] = interp(v); return `<span class="badge ${c}">${t}</span>`; } },
      ], relRows, { filename: "reliability", noSearch: true, pageLength: 10 });
      if (itemRel.some((r) => r.item_total_r != null)) K.table("t-itemrel", [
        { title: "Q", data: "num", render: (v) => "Q" + v, className: "dt-type-numeric" },
        { title: "Statement", data: "short", className: "wrap" },
        { title: "Theme", data: "theme", render: themeLabel, filter: "select" },
        { title: "Item–total r", data: "item_total_r", render: (v) => K.f(v), className: "dt-type-numeric" },
        { title: "α if removed", data: "alpha_if_deleted", render: (v) => K.f(v), className: "dt-type-numeric" },
        { title: "Note", data: (r) => (r.item_total_r == null ? "" : r.item_total_r < 0 ? "Negative: check wording" : r.alpha_if_deleted != null && r.themeAlpha != null && r.alpha_if_deleted > r.themeAlpha + 0.02 ? "Removing would raise α" : r.item_total_r < 0.2 ? "Weak fit" : "OK"),
          render: (v) => (v ? `<span class="badge ${v === "OK" ? "b-good" : v.startsWith("Negative") ? "b-bad" : "b-warn"}">${v}</span>` : "–"), filter: "select" },
      ], itemRel, { filename: "item_diagnostics", pageLength: 10 });

      const mins = all.map((r) => r.mins).filter((x) => x != null).map((x) => Math.min(x, 60));
      if (mins.length) K.plot("c-mins", [{ type: "histogram", x: mins, nbinsx: 24, marker: { color: K.blue(), line: { color: K.css("--surface"), width: 1 } }, hovertemplate: "%{x} min: %{y}<extra></extra>" }],
        { xaxis: { title: { text: "Minutes (capped at 60)" } }, yaxis: { title: { text: "Submissions" } }, shapes: [{ type: "line", x0: 3, x1: 3, y0: 0, y1: 1, yref: "paper", line: { color: K.css("--bad"), dash: "dot", width: 1.5 } }] }, { height: 300 });
      if (flagged.length) K.table("t-flags", [
        { title: "ID", data: "id" }, { title: "Minutes", data: (r) => r.mins, render: (v, t) => (t === "display" ? K.f(v, 1) : v ?? -1), className: "dt-type-numeric" },
        { title: "Flags", data: (r) => Object.keys(r.flags).filter((k) => r.flags[k]).map((k) => flagNames[k]).join(", "), render: (v) => v.split(", ").filter(Boolean).map((x) => `<span class="badge b-warn">${x}</span>`).join(" "), filter: "text" },
      ], flagged, { filename: "flagged_responses", pageLength: 5, noSearch: true });
      if (tests.length) {
        const mag = { large: "b-bad", medium: "b-warn", small: "b-accent", negligible: "b-neutral" };
        K.table("t-tests", [
          { title: "Grouping", data: "family", filter: "select" }, { title: "Comparison", data: "comparison", className: "wrap" }, { title: "Outcome", data: "outcome", filter: "select" },
          { title: "n", data: "n", className: "dt-type-numeric" },
          { title: "p (adjusted)", data: "p_adj", render: (v, t) => (t === "display" ? `${K.p(v)}${v < 0.05 ? ' <span class="badge b-good">sig.</span>' : ""}` : v), className: "dt-type-numeric" },
          { title: "Effect", data: "effect", render: (v, t, r) => (t === "display" ? `${r.effect_name} = ${K.f(v)}` : v), className: "dt-type-numeric" },
          { title: "Magnitude", data: "magnitude", render: (v) => `<span class="badge ${mag[v] || "b-neutral"}">${v}</span>`, filter: "select" },
          { title: "Group means (1–4)", data: "detail", className: "wrap", visible: false },
        ], tests, { filename: "group_tests", pageLength: 10, order: [[4, "asc"]] });
      }
      K.table("t-codebook", [
        { title: "Q", data: "num", render: (v) => "Q" + v, className: "dt-type-numeric" },
        { title: "Statement", data: (r) => K.D.statements[r.key], className: "wrap" },
        { title: "Theme", data: "theme", render: themeLabel, filter: "select" },
        { title: "Self-clear answer", data: (r) => (r.reverse ? "Disagree (reverse-scored)" : "Agree"), filter: "select" },
      ], K.ITEMS, { filename: "codebook", pageLength: 10 });
    },
  };
})(window);
