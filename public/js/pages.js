/* ==========================================================================
   pages.js — the six dashboard pages
   ========================================================================== */
(function (global) {
  "use strict";
  const K = global.K, S = K.stats;
  const P = (K.pages = {});

  // ---------------------------------------------------------------- shared summaries
  const themeSummary = (rows) => K.THEMES.map((t) => Object.assign({ key: t.key, label: t.label }, S.ci(rows.map((r) => r.s[t.key]))));
  const itemSummary = (rows) => K.ITEMS.map((it) => {
    const v = rows.map((r) => r.a[it.key]).filter((x) => x != null);
    const cnt = { 1: 0, 2: 0, 3: 0, 4: 0, 9: 0 }; v.forEach((x) => cnt[x]++);
    const subs = cnt[1] + cnt[2] + cnt[3] + cnt[4];
    const c = S.ci(rows.map((r) => r.r[it.key]));
    return Object.assign({}, it, { label: `Q${it.num} · ${it.short}`, n: v.length, subs, cnt,
      pct: Object.fromEntries([1, 2, 3, 4, 9].map((k) => [k, v.length ? cnt[k] / v.length : null])),
      pctSub: Object.fromEntries([1, 2, 3, 4].map((k) => [k, subs ? cnt[k] / subs : null])),
      agree: subs ? (cnt[3] + cnt[4]) / subs : null, notSure: v.length ? cnt[9] / v.length : null,
      mean: c.mean, lo: c.lo, hi: c.hi, sd: c.sd });
  });
  const themeLabel = (k) => (k === "overall" ? "Overall score" : K.THEMES.find((t) => t.key === k).label);
  const labelsOn = () => K.state.labels;
  const needRows = (rows, html) => (rows.length ? html : K.empty("No analysed respondents match the current filters.", "fa-filter-circle-xmark"));
  const errX = (arr, lo, hi, color) => ({ type: "data", symmetric: false, array: arr.map((d) => (d[hi] == null ? 0 : d[hi] - d.mean)),
    arrayminus: arr.map((d) => (d[lo] == null ? 0 : d.mean - d[lo])), color, thickness: 1.6, width: 5 });

  // reusable charts -------------------------------------------------------
  function chartThemeMeans(id, rows) {
    const t = themeSummary(rows).reverse();
    K.plot(id, [{
      type: "bar", orientation: "h", y: t.map((d) => d.label), x: t.map((d) => d.mean),
      marker: { color: t.map((d) => K.themeColor(d.key)), line: { color: K.css("--surface"), width: 2 } },
      error_x: errX(t, "lo", "hi", K.css("--text-2")),
      text: labelsOn() ? t.map((d) => K.f(d.mean)) : undefined, textposition: "inside", insidetextanchor: "start",
      textfont: { color: "#fff", size: 12 }, customdata: t.map((d) => [d.n, K.f(d.lo), K.f(d.hi)]),
      hovertemplate: "<b>%{y}</b><br>Mean %{x:.2f} (95% CI %{customdata[1]}–%{customdata[2]})<br>n = %{customdata[0]}<extra></extra>",
    }], { xaxis: { range: [0, 4.2], dtick: 1, title: { text: "Mean score (1–4) with 95% CI" } }, yaxis: { automargin: true }, margin: { l: 10 } },
    { height: 300 });
  }
  function chartLevels(id, rows) {
    const keys = [...K.THEMES.map((t) => t.key), "overall"].reverse();
    const traces = ["Low", "Moderate", "High"].map((lvl) => {
      const vals = keys.map((k) => { const v = rows.map((r) => r.s[k]).filter((x) => x != null); return v.length ? v.filter((x) => K.scoreLevel(x) === lvl).length / v.length : 0; });
      return { type: "bar", orientation: "h", name: lvl, y: keys.map(themeLabel), x: vals.map((v) => 100 * v),
        marker: { color: K.levelColor(lvl), line: { color: K.css("--surface"), width: 2 } },
        text: labelsOn() ? vals.map((v) => (v >= 0.06 ? Math.round(100 * v) + "%" : "")) : undefined, textposition: "inside", textfont: { color: "#fff" },
        hovertemplate: `<b>%{y}</b><br>${lvl}: %{x:.0f}%<extra></extra>` };
    });
    K.plot(id, traces, { barmode: "stack", legend: { traceorder: "normal" }, xaxis: { range: [0, 100], ticksuffix: "%", title: { text: "% of respondents" } }, margin: { l: 10 } }, { height: 300 });
  }

  // ======================================================================= 1 · OVERVIEW
  P.overview = {
    title: "Overview", section: "Summary", icon: "fa-gauge-high",
    render(el) {
      const rows = K.analysed(), all = K.allFiltered();
      const oc = S.ci(rows.map((r) => r.s.overall));
      const high = rows.filter((r) => r.s.overall != null && r.s.overall >= 3).length;
      const scored = rows.filter((r) => r.s.overall != null).length;
      const ts = themeSummary(rows).filter((t) => t.mean != null).sort((a, b) => b.mean - a.mean);
      const items = itemSummary(rows).filter((i) => i.mean != null);
      const byMean = [...items].sort((a, b) => b.mean - a.mean);
      const nsAll = rows.reduce((s, r) => s + r.nNS, 0), ansAll = rows.reduce((s, r) => s + r.nAns, 0);
      const mins = S.median(rows.map((r) => r.mins));
      const lastDate = all.map((r) => r.date).filter(Boolean).sort().pop();

      const about = rows.length
        ? `As of <b>${K.dateLabel(lastDate)}</b>, <b>${K.int(all.length)}</b> people submitted the survey and <b>${K.int(rows.length)}</b> (${K.pct(all.length ? rows.length / all.length : null)}) were aged 18–50, living in Rwanda and gave consent, so they are analysed here.
           Their average overall self-understanding score is <b>${K.f(oc.mean)}</b> out of 4${oc.lo != null ? ` (95% CI ${K.f(oc.lo)}–${K.f(oc.hi)})` : ""}, and <b>${K.pct(scored ? high / scored : null)}</b> score 3.0 or higher.
           ${ts.length ? `The strongest theme is <b>${ts[0].label}</b> (${K.f(ts[0].mean)}); the area with most room to grow is <b>${ts[ts.length - 1].label}</b> (${K.f(ts[ts.length - 1].mean)}).` : ""}
           Click any bar on the Respondents page to filter the whole dashboard.`
        : "No analysed respondents match the current filters. Reset the filters in the sidebar to see all results.";

      el.innerHTML = `
        ${K.hero("Overview", "How adults aged 18–50 in Rwanda understand themselves, respond to feedback and live by their values.", "fa-gauge-high")}
        ${K.about(about)}
        <div class="kpi-grid hero-k">
          ${K.kpi({ cls: "k1", icon: "fa-inbox", label: "Submissions", value: K.int(all.length), sub: "All forms received" })}
          ${K.kpi({ cls: "k2", icon: "fa-user-check", label: "Analysed respondents", value: K.int(rows.length), sub: `${K.pct(all.length ? rows.length / all.length : null)} eligible and consenting`, bar: all.length ? 100 * rows.length / all.length : 0 })}
          ${K.kpi({ cls: "k3", icon: "fa-brain", label: "Mean overall score", value: K.f(oc.mean), sub: "1 = least, 4 = clearest self-understanding", bar: oc.mean != null ? 100 * (oc.mean - 1) / 3 : 0 })}
          ${K.kpi({ cls: "k4", icon: "fa-star", label: "High self-understanding", value: K.pct(scored ? high / scored : null), sub: `${K.int(high)} of ${K.int(scored)} score 3.0 or more`, bar: scored ? 100 * high / scored : 0 })}
        </div>
        <div class="kpi-grid small-k">
          ${themeSummary(rows).map((t) => K.stat({ label: t.label, value: K.f(t.mean), sub: t.lo != null ? `95% CI ${K.f(t.lo)}–${K.f(t.hi)}` : `n = ${t.n}`, color: K.themeColor(t.key), icon: "fa-circle-half-stroke" })).join("")}
          ${K.stat({ label: "Median time", value: mins == null ? "–" : K.f(mins, 1) + " min", sub: "to complete the survey", icon: "fa-stopwatch", color: "var(--accent)" })}
        </div>
        <div class="grid">
          ${K.card({ span: 7, icon: "fa-chart-bar", title: "Theme scores", sub: "Mean score with 95% confidence interval · higher = clearer self-understanding", body: needRows(rows, K.chartDiv("c-themes")) })}
          ${K.card({ span: 5, icon: "fa-layer-group", title: "Score levels", sub: "Low < 2 · Moderate 2–2.99 · High ≥ 3", body: needRows(rows, K.chartDiv("c-levels")) })}
        </div>
        <div class="grid">
          ${K.card({ span: 7, icon: "fa-lightbulb", title: "Key findings", sub: "Statements with the highest and lowest scores", body: needRows(rows, `<ul class="insights">
            ${byMean.slice(0, 3).map((i) => `<li><span class="dot up"><i class="fa-solid fa-arrow-trend-up"></i></span><div><b>Strength · Q${i.num}</b> ${K.esc(i.short)}<small>Mean score ${K.f(i.mean)} · ${K.pct(i.agree)} agree${i.reverse ? " (reverse-scored: disagreement is positive)" : ""}</small></div></li>`).join("")}
            ${byMean.slice(-3).reverse().map((i) => `<li><span class="dot down"><i class="fa-solid fa-arrow-trend-down"></i></span><div><b>Growth area · Q${i.num}</b> ${K.esc(i.short)}<small>Mean score ${K.f(i.mean)} · ${K.pct(i.agree)} agree${i.reverse ? " (reverse-scored: agreement is the concern)" : ""}</small></div></li>`).join("")}
            <li><span class="dot info"><i class="fa-solid fa-circle-question"></i></span><div><b>‘Not sure’ answers</b> make up ${K.pct(ansAll ? nsAll / ansAll : null, 1)} of all answers${items.length ? `; most often for Q${[...items].sort((a, b) => b.notSure - a.notSure)[0].num} (${K.pct([...items].sort((a, b) => b.notSure - a.notSure)[0].notSure)})` : ""}.<small>Treated as missing when scores are calculated.</small></div></li>
          </ul>`) })}
          ${K.card({ span: 5, icon: "fa-filter", title: "Who reached the analysis", sub: "Eligibility checks, from all submissions to analysed respondents", body: K.chartDiv("c-funnel") })}
        </div>`;

      if (rows.length) { chartThemeMeans("c-themes", rows); chartLevels("c-levels", rows); }
      const stages = [["All submissions", all.length], ["Aged 18–50", all.filter((r) => K.AGE_VALID.includes(r.age)).length],
        ["Living in Rwanda", all.filter((r) => K.AGE_VALID.includes(r.age) && r.lives === "Yes").length], ["Consented · analysed", rows.length]];
      K.plot("c-funnel", [{ type: "funnel", y: stages.map((s) => s[0]), x: stages.map((s) => s[1]), textinfo: "value+percent initial",
        textfont: { color: "#fff" }, marker: { color: K.dark() ? ["#86b6ef", "#5598e7", "#3987e5", "#1c5cab"] : ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab"] },
        connector: { fillcolor: K.css("--surface-3"), line: { width: 0 } }, hovertemplate: "%{y}: %{x}<extra></extra>" }],
        { margin: { l: 10 }, yaxis: { automargin: true } }, { height: 300 });
    },
  };

  // ======================================================================= 2 · RESPONDENTS
  P.respondents = {
    title: "Respondents", section: "Summary", icon: "fa-users",
    render(el) {
      const rows = K.analysed();
      const n = rows.length;
      const ageCounts = K.AGE_VALID.map((a) => rows.filter((r) => r.age === a).length);
      const opt = (list, field) => list.map((o) => ({ o, n: rows.filter((r) => r[field].includes(o)).length })).filter((d) => d.n > 0 || K.state[field === "act" ? "act" : "circ"] === d.o).sort((a, b) => a.n - b.n);
      const acts = opt(K.D.activity_options, "act"), circs = opt(K.D.circumstance_options, "circ");
      const top = (arr) => (arr.length ? arr[arr.length - 1] : null);
      const others = rows.filter((r) => r.act_other).map((r) => ({ date: r.date, age: r.age, text: r.act_other }));
      const comments = rows.filter((r) => r.comment);
      const ageTop = ageCounts.indexOf(Math.max(...ageCounts));

      el.innerHTML = `
        ${K.hero("Respondents", "Who took part: age, main activities and current life circumstances of the analysed respondents.", "fa-users")}
        ${K.about(`These charts describe the <b>${K.int(n)}</b> analysed respondents. Q4 and Q5 allow several answers, so percentages can add up to more than 100%. <b>Click a bar</b> to filter the whole dashboard by that group; click the filter chip above to remove it.`)}
        <div class="kpi-grid small-k">
          ${K.stat({ label: "Analysed respondents", value: K.int(n), icon: "fa-user-check", sub: "after eligibility and consent" })}
          ${K.stat({ label: "Largest age group", value: n ? K.AGE_VALID[ageTop] : "–", icon: "fa-cake-candles", color: K.series(0), sub: n ? `${K.pct(ageCounts[ageTop] / n)} of respondents` : "" })}
          ${K.stat({ label: "Most common activity", value: top(acts) && top(acts).n ? K.esc(top(acts).o) : "–", icon: "fa-briefcase", color: K.series(1), sub: top(acts) && n ? `${K.pct(top(acts).n / n)} of respondents` : "" })}
          ${K.stat({ label: "Most common circumstance", value: top(circs) && top(circs).n ? K.esc(top(circs).o) : "–", icon: "fa-house-user", color: K.series(2), sub: top(circs) && n ? `${K.pct(top(circs).n / n)} of respondents` : "" })}
          ${K.stat({ label: "Left a comment", value: K.int(comments.length), icon: "fa-comment-dots", color: K.series(4), sub: n ? `${K.pct(comments.length / n)} of respondents` : "" })}
        </div>
        <div class="grid">
          ${K.card({ span: 5, icon: "fa-cake-candles", title: "Age group", sub: "Click a bar to filter", body: needRows(rows, K.chartDiv("c-age")) })}
          ${K.card({ span: 7, icon: "fa-briefcase", title: "Primary activity (Q4)", sub: "% of respondents · select all that apply · click to filter", body: needRows(rows, K.chartDiv("c-act")) })}
        </div>
        <div class="grid">
          ${K.card({ span: 6, icon: "fa-house-user", title: "Current circumstances (Q5)", sub: "% of respondents · select all that apply · click to filter", body: needRows(rows, K.chartDiv("c-circ")) })}
          ${K.card({ span: 6, icon: "fa-table-cells", title: "Circumstances by age group", sub: "% of each age group reporting each circumstance", body: needRows(rows, K.chartDiv("c-heat")) })}
        </div>
        ${others.length ? `<div class="grid">${K.card({ span: 12, icon: "fa-pen-to-square", title: "‘Other’ activities, as written", body: '<div id="t-other"></div>' })}</div>` : ""}`;
      if (!n) return;

      const lab = (vals) => (labelsOn() ? { text: vals, textposition: "outside", textfont: { color: K.css("--text-2") }, cliponaxis: false } : {});
      K.plot("c-age", [Object.assign({ type: "bar", x: K.AGE_VALID, y: ageCounts,
        marker: { color: K.AGE_VALID.map((a) => (K.state.age && K.state.age !== a ? K.css("--surface-3") : K.blue())) },
        customdata: ageCounts.map((c) => K.pct(c / n)), hovertemplate: "<b>%{x}</b><br>%{y} respondents (%{customdata})<extra></extra>" },
        lab(ageCounts.map((c) => `${c} · ${K.pct(c / n)}`)))],
        { yaxis: { title: { text: "Respondents" } }, margin: { t: 24 } }, { height: 320, onClick: (e) => K.setFilter("age", e.points[0].x) });

      const hbar = (id, arr, field) => K.plot(id, [Object.assign({ type: "bar", orientation: "h", y: arr.map((d) => d.o), x: arr.map((d) => 100 * d.n / n),
        marker: { color: arr.map((d) => (K.state[field] && K.state[field] !== d.o ? K.css("--surface-3") : K.blue())) },
        customdata: arr.map((d) => d.n), hovertemplate: "<b>%{y}</b><br>%{x:.0f}% (%{customdata} people)<extra></extra>" },
        lab(arr.map((d) => `${Math.round(100 * d.n / n)}%`)))],
        { xaxis: { ticksuffix: "%", title: { text: "% of respondents" }, rangemode: "tozero" }, margin: { l: 10, r: 40 } },
        { height: 80 + 34 * Math.max(arr.length, 3), onClick: (e) => K.setFilter(field, e.points[0].y) });
      hbar("c-act", acts, "act"); hbar("c-circ", circs, "circ");

      const ages = K.AGE_VALID.filter((a) => rows.some((r) => r.age === a));
      const cs = K.D.circumstance_options.filter((c) => rows.some((r) => r.circ.includes(c)));
      const z = cs.map((c) => ages.map((a) => { const g = rows.filter((r) => r.age === a); return g.length ? 100 * g.filter((r) => r.circ.includes(c)).length / g.length : null; }));
      K.plot("c-heat", [{ type: "heatmap", x: ages, y: cs, z, zmin: 0, zmax: 100, colorscale: K.seqScale(), xgap: 2, ygap: 2,
        text: z.map((r) => r.map((v) => (v == null ? "" : Math.round(v) + "%"))), texttemplate: "%{text}",
        textfont: { size: 11 }, colorbar: { ticksuffix: "%", thickness: 10, outlinewidth: 0, tickfont: { color: K.css("--text-2") } },
        hovertemplate: "<b>%{y}</b><br>Age %{x}: %{z:.0f}%<extra></extra>" }],
        { margin: { l: 10 }, xaxis: { side: "bottom", showgrid: false }, yaxis: { showgrid: false, autorange: "reversed" } }, { height: 80 + 36 * Math.max(cs.length, 3) });

      if (others.length) K.table("t-other", [{ title: "Date", data: "date" }, { title: "Age group", data: "age" }, { title: "Activity (as written)", data: "text", className: "wrap" }], others, { filename: "other_activities", pageLength: 5 });
    },
  };

  // ======================================================================= 3 · STATEMENTS
  P.statements = {
    title: "Statements", section: "Results", icon: "fa-list-check",
    sort: "order", theme: "", pick: "q6",
    render(el) {
      const me = this, rows = K.analysed();
      let items = itemSummary(rows).filter((i) => !me.theme || i.theme === me.theme);
      if (me.sort === "agree") items.sort((a, b) => (b.agree ?? -1) - (a.agree ?? -1));
      else if (me.sort === "score") items.sort((a, b) => (b.mean ?? -1) - (a.mean ?? -1));
      const tools = `<div class="seg" id="seg-sort">${[["order", "Question order"], ["agree", "Most agreement"], ["score", "Highest score"]].map(([k, l]) => `<button data-v="${k}" class="${me.sort === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <select class="sel" id="sel-theme"><option value="">All themes</option>${K.THEMES.map((t) => `<option value="${t.key}" ${me.theme === t.key ? "selected" : ""}>${t.label}</option>`).join("")}</select>`;
      const pickItem = K.ITEM[me.pick];

      el.innerHTML = `
        ${K.hero("Statements", "How respondents answered each of the 21 statements (Q6–Q26) about identity, influence, feedback, values and reflection.", "fa-list-check")}
        ${K.about(`The first chart shows raw answers: disagreement to the left of the centre line, agreement to the right (‘Not sure’ is excluded and shown in the table). The <b>score</b> chart applies reverse-scoring, so a higher score always means clearer self-understanding. Ten statements (marked <span class="badge b-warn">R</span>) are reverse-scored because agreeing with them signals less self-clarity.`)}
        <div class="grid">${K.card({ span: 12, icon: "fa-chart-simple", title: "Answer distribution", sub: "% of answers excluding ‘Not sure’", tools, body: needRows(rows, `<div class="legend-row">${[1, 2, 3, 4].map((c) => `<span><i style="background:${K.likertColor(c)}"></i>${K.LEVELS[c - 1].label}</span>`).join("")}</div>${K.chartDiv("c-likert")}`) })}</div>
        <div class="grid">${K.card({ span: 12, icon: "fa-bullseye", title: "Score per statement", sub: "Mean score after reverse-scoring, with 95% CI · colour = theme", body: needRows(rows, K.chartDiv("c-means")) })}</div>
        <div class="grid">${K.card({ span: 12, icon: "fa-table", title: "Statement summary table", sub: "Shaded cells: darker = larger share. Use Columns to show or hide fields.", body: '<div id="t-items"></div>' })}</div>
        <div class="grid">${K.card({ span: 12, icon: "fa-magnifying-glass-chart", title: "Look closer at one statement", sub: "Full wording and answers by age group",
          tools: `<select class="sel" id="sel-item">${K.ITEMS.map((i) => `<option value="${i.key}" ${i.key === me.pick ? "selected" : ""}>Q${i.num} · ${K.esc(i.short)}</option>`).join("")}</select>`,
          body: `<p style="margin:2px 0 10px;font-size:15px"><b>Q${pickItem.num}.</b> ${K.esc(K.D.statements[pickItem.key])} ${pickItem.reverse ? '<span class="badge b-warn">Reverse-scored</span>' : ""} <span class="badge b-neutral">${themeLabel(pickItem.theme)}</span></p>${needRows(rows, K.chartDiv("c-pick"))}` })}</div>`;

      el.querySelectorAll("#seg-sort button").forEach((b) => b.addEventListener("click", () => { me.sort = b.dataset.v; K.render(); }));
      el.querySelector("#sel-theme").addEventListener("change", (e) => { me.theme = e.target.value; K.render(); });
      el.querySelector("#sel-item").addEventListener("change", (e) => { me.pick = e.target.value; K.render(); });

      const H = 110 + 27 * items.length, ylab = items.map((i) => (i.reverse ? `${i.label} (R)` : i.label));
      if (rows.length) {
        const spec = [[2, -1], [1, -1], [3, 1], [4, 1]];
        K.plot("c-likert", spec.map(([c, sgn]) => ({ type: "bar", orientation: "h", name: K.LEVELS[c - 1].label, showlegend: false,
          y: ylab, x: items.map((i) => sgn * 100 * (i.pctSub[c] || 0)), marker: { color: K.likertColor(c), line: { color: K.css("--surface"), width: 1 } },
          customdata: items.map((i) => [Math.round(100 * (i.pctSub[c] || 0)), i.cnt[c]]),
          text: labelsOn() ? items.map((i) => ((i.pctSub[c] || 0) >= 0.08 ? Math.round(100 * i.pctSub[c]) + "%" : "")) : undefined,
          textposition: "inside", insidetextanchor: "middle", textfont: { color: c === 2 || c === 3 ? "#0b0b0b" : "#fff", size: 11 },
          hovertemplate: `<b>%{y}</b><br>${K.LEVELS[c - 1].label}: %{customdata[0]}% (%{customdata[1]})<extra></extra>` })),
          { barmode: "relative", bargap: 0.22, margin: { l: 10 }, xaxis: { range: [-100, 100], tickvals: [-100, -75, -50, -25, 0, 25, 50, 75, 100],
            ticktext: ["100%", "75%", "50%", "25%", "0", "25%", "50%", "75%", "100%"], title: { text: "← disagree · agree →" } },
            yaxis: { autorange: "reversed", automargin: true, tickfont: { size: 11.5 } },
            shapes: [{ type: "line", x0: 0, x1: 0, y0: 0, y1: 1, yref: "paper", line: { color: K.css("--text-2"), width: 1.2 } }] }, { height: H });

        const traces = K.THEMES.map((t) => { const its = items.filter((i) => i.theme === t.key && i.mean != null); return {
          type: "scatter", mode: labelsOn() ? "markers+text" : "markers", name: t.label, y: its.map((i) => (i.reverse ? `${i.label} (R)` : i.label)), x: its.map((i) => i.mean),
          marker: { color: K.themeColor(t.key), size: 12, line: { color: K.css("--surface"), width: 2 } },
          error_x: errX(its, "lo", "hi", K.themeColor(t.key)), text: its.map((i) => K.f(i.mean)), textposition: "top center", textfont: { size: 10.5, color: K.css("--text-2") },
          customdata: its.map((i) => [K.f(i.lo), K.f(i.hi), i.subs]),
          hovertemplate: "<b>%{y}</b><br>Mean %{x:.2f} (95% CI %{customdata[0]}–%{customdata[1]}), n = %{customdata[2]}<extra></extra>" }; });
        K.plot("c-means", traces, { margin: { l: 10 }, xaxis: { range: [0.8, 4.2], dtick: 0.5, title: { text: "Mean score (1 = least, 4 = clearest self-understanding)" } },
          yaxis: { autorange: "reversed", automargin: true, categoryorder: "array", categoryarray: ylab, tickfont: { size: 11.5 } },
          shapes: [{ type: "line", x0: 2.5, x1: 2.5, y0: 0, y1: 1, yref: "paper", line: { color: K.css("--axis"), width: 1, dash: "dot" } }] }, { height: H + 30 });

        // answers to one statement by age group (100% stacked)
        const ages = K.AGE_VALID.filter((a) => rows.some((r) => r.age === a && r.a[me.pick] != null));
        const groups = ["All respondents", ...ages];
        const share = (g, c) => { const v = rows.filter((r) => (g === "All respondents" || r.age === g) && r.a[me.pick] != null).map((r) => r.a[me.pick]); return v.length ? v.filter((x) => x === c).length / v.length : 0; };
        K.plot("c-pick", [1, 2, 3, 4, 9].map((c) => ({ type: "bar", orientation: "h", name: K.LEVELS.find((l) => l.code === c).label, y: groups, x: groups.map((g) => 100 * share(g, c)),
          marker: { color: K.likertColor(c), line: { color: K.css("--surface"), width: 1 } },
          text: groups.map((g) => (share(g, c) >= 0.07 ? Math.round(100 * share(g, c)) + "%" : "")), textposition: "inside", textfont: { color: c === 2 || c === 3 || c === 9 ? "#0b0b0b" : "#fff", size: 11 },
          hovertemplate: "<b>%{y}</b><br>%{fullData.name}: %{x:.0f}%<extra></extra>" })),
          { barmode: "stack", legend: { traceorder: "normal" }, margin: { l: 10 }, xaxis: { range: [0, 100], ticksuffix: "%" }, yaxis: { autorange: "reversed", automargin: true } }, { height: 120 + 40 * groups.length });
      }

      // summary table with heat shading
      const heat = (v, rgb) => (v == null ? "" : `background: rgba(${rgb}, ${0.08 + 0.55 * v}) !important;`);
      const pc = (v) => (v == null ? "–" : Math.round(100 * v) + "%");
      K.table("t-items", [
        { title: "Q", data: "num", render: (v) => `Q${v}`, className: "dt-type-numeric" },
        { title: "Statement", data: "short", className: "wrap", render: (v, t, r) => `${K.esc(v)}${r.reverse ? ' <span class="badge b-warn" title="Reverse-scored">R</span>' : ""}` },
        { title: "Theme", data: "theme", render: (v) => themeLabel(v), className: "theme-col" },
        { title: "Answered", data: "n", className: "dt-type-numeric" },
        { title: "Strongly disagree", data: (r) => r.pct[1], render: pc, className: "heat h-neg2" },
        { title: "Disagree", data: (r) => r.pct[2], render: pc, className: "heat h-neg1" },
        { title: "Agree", data: (r) => r.pct[3], render: pc, className: "heat h-pos1" },
        { title: "Strongly agree", data: (r) => r.pct[4], render: pc, className: "heat h-pos2" },
        { title: "Not sure", data: (r) => r.pct[9], render: pc, className: "heat h-ns" },
        { title: "Mean score", data: "mean", render: (v) => K.f(v), className: "heat h-score" },
        { title: "95% CI", data: (r) => (r.lo == null ? "–" : `${K.f(r.lo)}–${K.f(r.hi)}`), className: "dt-type-numeric", orderable: false },
        { title: "SD", data: "sd", render: (v) => K.f(v), className: "dt-type-numeric", visible: false },
        { title: "Full wording", data: (r) => K.D.statements[r.key], className: "wrap", visible: false },
      ], items, { filename: "statement_summary", pageLength: 25, noSearch: false,
        createdRow: (tr, r) => {
          const tds = tr.querySelectorAll("td.heat"); const vals = [r.pct[1], r.pct[2], r.pct[3], r.pct[4], r.pct[9], r.mean == null ? null : (r.mean - 1) / 3];
          const rgb = K.dark() ? ["240,113,113", "240,113,113", "92,157,240", "92,157,240", "148,160,180", "44,196,178"] : ["194,59,59", "194,59,59", "42,120,214", "28,92,171", "120,130,150", "14,147,132"];
          tds.forEach((td, i) => td.setAttribute("style", heat(vals[i], rgb[i])));
        } });
    },
  };

  // ======================================================================= 4 · THEMES
  P.themes = {
    title: "Themes", section: "Results", icon: "fa-shapes",
    group: "age", outcome: "overall", xs: "identity", ys: "social",
    render(el) {
      const me = this, rows = K.analysed();
      const tests = (K.D.stats.tests || []);
      const sig = tests.filter((t) => t.p_adj < 0.05);
      const outcomes = [["overall", "Overall score"], ...K.THEMES.map((t) => [t.key, t.label])];
      const oSel = (id, val, list) => `<select class="sel" id="${id}">${list.map(([k, l]) => `<option value="${k}" ${val === k ? "selected" : ""}>${l}</option>`).join("")}</select>`;
      el.innerHTML = `
        ${K.hero("Themes", "Five themes of self-understanding, each scored 1–4 from its statements, and how they differ between groups.", "fa-shapes")}
        ${K.about(`Each theme score is the mean of a respondent's reverse-scored statements in that theme (‘Not sure’ excluded). Group comparisons below are <b>descriptive and live</b>: they follow your filters. The statistical tests table is computed in R on <b>all analysed respondents</b> (filters do not apply) and uses Benjamini–Hochberg adjusted p-values.`)}
        <div class="grid">
          ${K.card({ span: 6, icon: "fa-chart-bar", title: "Mean score by theme", sub: "with 95% confidence interval", body: needRows(rows, K.chartDiv("c-tm")) })}
          ${K.card({ span: 6, icon: "fa-chart-area", title: "Spread of scores", sub: "Distribution, box (median and quartiles) and each respondent", body: needRows(rows, K.chartDiv("c-violin")) })}
        </div>
        <div class="grid">
          ${K.card({ span: 7, icon: "fa-people-group", title: "Compare groups", sub: "Mean with 95% CI per group (people can belong to several activity or circumstance groups)",
            tools: oSel("sel-group", me.group, [["age", "Age group"], ["act", "Primary activity"], ["circ", "Circumstances"]]) + oSel("sel-out", me.outcome, outcomes),
            body: needRows(rows, K.chartDiv("c-group")) })}
          ${K.card({ span: 5, icon: "fa-layer-group", title: "Score levels by theme", sub: "Low < 2 · Moderate 2–2.99 · High ≥ 3", body: needRows(rows, K.chartDiv("c-lv")) })}
        </div>
        <div class="grid">
          ${K.card({ span: 6, icon: "fa-border-all", title: "How the themes relate", sub: "Pearson correlation between theme scores", body: rows.length >= 3 ? K.chartDiv("c-cor") : K.empty("Correlations need at least 3 respondents.") })}
          ${K.card({ span: 6, icon: "fa-braille", title: "Two themes side by side", sub: "Each dot is a respondent",
            tools: oSel("sel-x", me.xs, K.THEMES.map((t) => [t.key, t.label])) + oSel("sel-y", me.ys, K.THEMES.map((t) => [t.key, t.label])),
            body: needRows(rows, K.chartDiv("c-scatter")) })}
        </div>
        <div class="grid">${K.card({ span: 12, icon: "fa-flask", title: "Statistical tests of group differences",
          sub: `${tests.length} tests run in R · ${sig.length} significant after adjustment (p<sub>adj</sub> < 0.05) · all analysed respondents`,
          body: tests.length ? '<div id="t-tests"></div>' : K.empty("Tests need at least 3 respondents in each group being compared. They will appear as more responses come in.", "fa-flask") })}</div>`;

      ["sel-group:group", "sel-out:outcome", "sel-x:xs", "sel-y:ys"].forEach((s) => { const [id, k] = s.split(":"); el.querySelector("#" + id).addEventListener("change", (e) => { me[k] = e.target.value; K.render(); }); });

      if (rows.length) {
        chartThemeMeans("c-tm", rows); chartLevels("c-lv", rows);
        K.plot("c-violin", K.THEMES.map((t) => ({ type: "violin", name: t.label, y: rows.map((r) => r.s[t.key]).filter((x) => x != null),
          box: { visible: true, width: 0.25 }, meanline: { visible: true }, points: "all", jitter: 0.35, pointpos: 0, spanmode: "hard",
          line: { color: K.themeColor(t.key), width: 1.5 }, fillcolor: K.themeColor(t.key) + "33", marker: { color: K.themeColor(t.key), size: 5, opacity: 0.6 },
          hoveron: "points+kde", hovertemplate: `<b>${t.label}</b><br>%{y:.2f}<extra></extra>` })),
          { showlegend: false, yaxis: { range: [0.8, 4.2], title: { text: "Score (1–4)" } }, xaxis: { tickfont: { size: 11 } }, violingap: 0.15 }, { height: 330 });

        // group comparison (live)
        let groups;
        if (me.group === "age") groups = K.AGE_VALID.map((a) => [a, rows.filter((r) => r.age === a)]);
        else if (me.group === "act") groups = K.D.activity_options.map((o) => [o, rows.filter((r) => r.act.includes(o))]);
        else groups = K.D.circumstance_options.map((o) => [o, rows.filter((r) => r.circ.includes(o))]);
        groups = groups.filter((g) => g[1].length).map(([g, rr]) => Object.assign({ g }, S.ci(rr.map((r) => r.s[me.outcome])))).filter((g) => g.mean != null);
        const all = S.ci(rows.map((r) => r.s[me.outcome]));
        const col = me.outcome === "overall" ? K.blue() : K.themeColor(me.outcome);
        K.plot("c-group", [{ type: "scatter", mode: labelsOn() ? "markers+text" : "markers", y: groups.map((g) => g.g), x: groups.map((g) => g.mean),
          marker: { color: col, size: 13, line: { color: K.css("--surface"), width: 2 } }, error_x: errX(groups, "lo", "hi", col),
          text: groups.map((g) => K.f(g.mean)), textposition: "top center", textfont: { color: K.css("--text-2") },
          customdata: groups.map((g) => [g.n, K.f(g.lo), K.f(g.hi)]), hovertemplate: "<b>%{y}</b><br>Mean %{x:.2f} (95% CI %{customdata[1]}–%{customdata[2]})<br>n = %{customdata[0]}<extra></extra>" }],
          { margin: { l: 10 }, xaxis: { range: [0.8, 4.2], title: { text: themeLabel(me.outcome) + " (1–4)" } }, yaxis: { autorange: "reversed", automargin: true },
            shapes: all.mean != null ? [{ type: "line", x0: all.mean, x1: all.mean, y0: 0, y1: 1, yref: "paper", line: { color: K.css("--text-2"), dash: "dot", width: 1.2 } }] : [],
            annotations: all.mean != null ? [{ x: all.mean, y: 1.04, yref: "paper", text: `All: ${K.f(all.mean)}`, showarrow: false, font: { size: 11, color: K.css("--text-2") } }] : [] },
          { height: 110 + 44 * Math.max(groups.length, 2) });

        if (rows.length >= 3) {
          const m = K.THEMES.map((a) => K.THEMES.map((b) => S.pearson(rows.map((r) => r.s[a.key]), rows.map((r) => r.s[b.key]))));
          const lb = K.THEMES.map((t) => t.label);
          K.plot("c-cor", [{ type: "heatmap", x: lb, y: lb, z: m, zmin: -1, zmax: 1, colorscale: K.divScale(), xgap: 2, ygap: 2,
            text: m.map((r) => r.map((v) => (v == null ? "" : v.toFixed(2)))), texttemplate: "%{text}", colorbar: { thickness: 10, outlinewidth: 0, tickfont: { color: K.css("--text-2") } },
            hovertemplate: "%{y} × %{x}<br>r = %{z:.2f}<extra></extra>" }],
            { margin: { l: 10, b: 10 }, xaxis: { showgrid: false, tickangle: -25 }, yaxis: { showgrid: false, autorange: "reversed" } }, { height: 360 });
        }
        const xs = rows.map((r) => r.s[me.xs]), ys = rows.map((r) => r.s[me.ys]), rr = S.pearson(xs, ys);
        K.plot("c-scatter", [{ type: "scatter", mode: "markers", x: xs, y: ys, text: rows.map((r) => r.age || ""),
          marker: { color: K.blue(), size: 10, opacity: 0.75, line: { color: K.css("--surface"), width: 1.5 } },
          hovertemplate: "%{xaxis.title.text}: %{x:.2f}<br>%{yaxis.title.text}: %{y:.2f}<br>Age %{text}<extra></extra>" }],
          { xaxis: { range: [0.8, 4.2], title: { text: themeLabel(me.xs) } }, yaxis: { range: [0.8, 4.2], title: { text: themeLabel(me.ys) } },
            annotations: rr != null ? [{ xref: "paper", yref: "paper", x: 1, y: 1.06, xanchor: "right", showarrow: false, text: `r = ${rr.toFixed(2)}, n = ${xs.filter((x, i) => x != null && ys[i] != null).length}`, font: { color: K.css("--text-2"), size: 12 } }] : [] },
          { height: 360 });
      }

      if (tests.length) {
        const mag = { large: "b-bad", medium: "b-warn", small: "b-accent", negligible: "b-neutral" };
        K.table("t-tests", [
          { title: "Grouping", data: "family", filter: "select" },
          { title: "Comparison", data: "comparison", className: "wrap" },
          { title: "Outcome", data: "outcome", filter: "select" },
          { title: "Test", data: "test", visible: false },
          { title: "n", data: "n", className: "dt-type-numeric" },
          { title: "Statistic", data: "statistic", render: (v) => K.f(v), className: "dt-type-numeric" },
          { title: "p", data: "p", render: (v, t) => (t === "display" ? K.p(v) : v), className: "dt-type-numeric" },
          { title: "p (adjusted)", data: "p_adj", render: (v, t) => (t === "display" ? `${K.p(v)}${v < 0.05 ? ' <span class="badge b-good">sig.</span>' : ""}` : v), className: "dt-type-numeric" },
          { title: "Effect size", data: "effect", render: (v, t, r) => (t === "display" ? `${r.effect_name} = ${K.f(v)}` : v), className: "dt-type-numeric" },
          { title: "Magnitude", data: "magnitude", render: (v) => `<span class="badge ${mag[v] || "b-neutral"}">${v}</span>`, filter: "select" },
          { title: "Group means", data: "detail", className: "wrap" },
        ], tests, { filename: "group_tests", pageLength: 10, order: [[7, "asc"]] });
      }
    },
  };

  // ======================================================================= 5 · DATA EXPLORER
  P.explorer = {
    title: "Data explorer", section: "Data", icon: "fa-table",
    scope: "analysed",
    render(el) {
      const me = this;
      const data = me.scope === "all" ? K.allFiltered() : K.analysed();
      const comments = K.analysed().filter((r) => r.comment);
      el.innerHTML = `
        ${K.hero("Data explorer", "Every response in one searchable, sortable table, plus the open comments.", "fa-table")}
        ${K.about(`Search the whole table, filter single columns in the row under the headers, sort by clicking a header and choose fields with <b>Columns</b>. Answers to Q6–Q26 are hidden by default. Exports (Copy, CSV, Excel, Print) include only the rows you can see after filtering.`)}
        <div class="grid">${K.card({ span: 12, icon: "fa-table", title: "Responses", sub: `${K.int(data.length)} records`,
          tools: `<div class="seg" id="seg-scope"><button data-v="analysed" class="${me.scope === "analysed" ? "on" : ""}">Analysed</button><button data-v="all" class="${me.scope === "all" ? "on" : ""}">All submissions</button></div>`,
          body: '<div id="t-data"></div>' })}</div>
        <div class="grid">${K.card({ span: 12, icon: "fa-comments", title: "Open comments (Q27)", sub: "As written by respondents · check for identifying details before sharing",
          body: comments.length ? '<div id="t-comments"></div>' : K.empty("No comments yet.", "fa-comment-slash") })}</div>`;
      el.querySelectorAll("#seg-scope button").forEach((b) => b.addEventListener("click", () => { me.scope = b.dataset.v; K.render(); }));

      const lvlBadge = (v) => { const l = K.scoreLevel(v); return l ? `<span class="badge ${l === "High" ? "b-good" : l === "Moderate" ? "b-warn" : "b-bad"}">${l}</span>` : "–"; };
      const num = (k) => ({ title: themeLabel(k).replace("Strengths, criticism and mistakes", "Feedback").replace("Emotions and reflection", "Reflection").replace("Myself among others", "Among others").replace("Values and actions", "Values").replace("Overall score", "Overall"),
        data: (r) => r.s[k], render: (v, t) => (t === "display" ? K.f(v) : v ?? -1), className: "dt-type-numeric" });
      const cols = [
        { title: "ID", data: "id", filter: "text" },
        { title: "Date", data: (r) => r.date || "", filter: "text" },
        { title: "Age", data: (r) => r.age || "", filter: "select" },
      ];
      if (me.scope === "all") cols.push({ title: "Status", data: (r) => (r.eligible ? "Analysed" : r.reason), filter: "select",
        render: (v) => `<span class="badge ${v === "Analysed" ? "b-good" : "b-neutral"}">${K.esc(v)}</span>` });
      cols.push(
        { title: "Main activity", data: "mainAct", filter: "select" },
        { title: "All activities", data: (r) => r.act.join("; "), visible: false, filter: "text" },
        { title: "Circumstances", data: (r) => r.circ.join("; "), filter: "text", className: "wrap" },
        ...K.THEMES.map((t) => num(t.key)), num("overall"),
        { title: "Level", data: (r) => K.scoreLevel(r.s.overall) || "", render: (v, t, r) => (t === "display" ? lvlBadge(r.s.overall) : v), filter: "select" },
        { title: "Not sure", data: "nNS", className: "dt-type-numeric" },
        { title: "Minutes", data: (r) => r.mins, render: (v, t) => (t === "display" ? K.f(v, 1) : v ?? -1), className: "dt-type-numeric" },
        ...K.ITEMS.map((it) => ({ title: `Q${it.num}`, data: (r) => { const v = r.a[it.key]; return v == null ? "" : K.LEVELS.find((l) => l.code === v).label; }, visible: false })),
      );
      K.table("t-data", cols, data, { filename: "responses", pageLength: 25, order: [[1, "desc"]] });
      if (comments.length) K.table("t-comments", [{ title: "Date", data: (r) => r.date || "" }, { title: "Age", data: (r) => r.age || "", filter: "select" },
        { title: "Comment", data: "comment", className: "wrap", render: (v) => K.esc(v) }], comments, { filename: "comments", pageLength: 10 });
    },
  };

  // ======================================================================= 6 · METHODS & QUALITY
  P.methods = {
    title: "Methods & quality", section: "Data", icon: "fa-microscope",
    render(el) {
      const st = K.D.stats, rel = st.reliability || {}, rows = K.analysed(), all = K.allFiltered();
      const fl = (k) => all.filter((r) => r.flags && r.flags[k]).length;
      const relRows = [...K.THEMES.map((t) => Object.assign({ key: t.key, label: t.label }, rel[t.key] || {})), Object.assign({ key: "overall", label: "All 21 statements" }, rel.overall || {})];
      relRows.forEach((r) => { const its = r.key === "overall" ? K.ITEMS.map((i) => i.key) : K.THEMES.find((t) => t.key === r.key).items;
        r.live = S.cronbach(rows.map((x) => its.map((q) => x.r[q]))).alpha; });
      const interp = (a) => (a == null ? ["needs ≥3 complete", "b-neutral"] : a >= 0.8 ? ["good", "b-good"] : a >= 0.7 ? ["acceptable", "b-good"] : a >= 0.6 ? ["questionable", "b-warn"] : ["low", "b-bad"]);
      const itemRel = [];
      K.THEMES.forEach((t) => ((rel[t.key] && rel[t.key].items) || []).forEach((x) => itemRel.push(Object.assign({}, x, K.ITEM[x.item], { themeAlpha: rel[t.key].alpha }))));
      const flagged = all.filter((r) => r.flags && Object.values(r.flags).some(Boolean));
      const flagNames = { speeder: "Under 3 min", straightline: "Same answer to all", not_sure: "6+ Not sure", incomplete: "Incomplete", duplicate: "Duplicate ID" };

      el.innerHTML = `
        ${K.hero("Methods & quality", "How scores are calculated, how reliable the themes are, and checks on response quality.", "fa-microscope")}
        ${K.about(`Reliability (Cronbach's α with a 1,000-sample bootstrap 95% CI) is computed in R on all analysed respondents; the ‘live α’ column follows your filters. Quality checks flag responses for review; they are <b>not</b> removed automatically.`)}
        <div class="kpi-grid small-k">
          ${K.stat({ label: "Submissions", value: K.int(all.length), icon: "fa-inbox" })}
          ${K.stat({ label: "Not eligible / no consent", value: K.int(all.length - all.filter((r) => r.eligible).length), icon: "fa-user-xmark", color: K.series(7) })}
          ${K.stat({ label: "Completed under 3 min", value: K.int(fl("speeder")), icon: "fa-person-running", color: K.series(3) })}
          ${K.stat({ label: "Same answer to all", value: K.int(fl("straightline")), icon: "fa-grip-lines", color: K.series(1) })}
          ${K.stat({ label: "6 or more ‘Not sure’", value: K.int(fl("not_sure")), icon: "fa-circle-question", color: K.series(6) })}
          ${K.stat({ label: "Overall α", value: K.f(rel.overall && rel.overall.alpha), icon: "fa-scale-balanced", color: K.series(2), sub: rel.overall && rel.overall.lo != null ? `95% CI ${K.f(rel.overall.lo)}–${K.f(rel.overall.hi)}` : "needs more responses" })}
        </div>
        <div class="grid">
          ${K.card({ span: 5, icon: "fa-scale-balanced", title: "Reliability by theme", sub: "Cronbach's α with bootstrap 95% CI · dotted line = 0.70", body: relRows.some((r) => r.alpha != null) ? K.chartDiv("c-alpha") : K.empty("Reliability needs at least 3 complete responses per theme.", "fa-scale-balanced") })}
          ${K.card({ span: 7, icon: "fa-table", title: "Reliability table", body: '<div id="t-rel"></div>' })}
        </div>
        <div class="grid">${K.card({ span: 12, icon: "fa-list-ol", title: "Item diagnostics", sub: "Corrected item–total correlation and α if the item were removed", body: itemRel.some((r) => r.item_total_r != null) ? '<div id="t-itemrel"></div>' : K.empty("Item diagnostics need at least 3 complete responses per theme.", "fa-list-ol") })}</div>
        <div class="grid">
          ${K.card({ span: 6, icon: "fa-stopwatch", title: "Time to complete", sub: "All submissions · dotted line = 3 minutes", body: all.some((r) => r.mins != null) ? K.chartDiv("c-mins") : K.empty("No timing data.") })}
          ${K.card({ span: 6, icon: "fa-user-xmark", title: "Why submissions were not analysed", body: all.some((r) => !r.eligible) ? K.chartDiv("c-reason") : K.empty("All submissions were eligible and consented.", "fa-circle-check") })}
        </div>
        <div class="grid">${K.card({ span: 12, icon: "fa-flag", title: "Responses flagged for review", sub: `${K.int(flagged.length)} records`, body: flagged.length ? '<div id="t-flags"></div>' : K.empty("No responses flagged.", "fa-circle-check") })}</div>
        <div class="grid">
          ${K.card({ span: 6, icon: "fa-calculator", title: "How the numbers are calculated", body: `<div class="prose"><ol>
            <li><b>Analysed respondents</b>: aged 18–24, 25–34, 35–44 or 45–50, living in Rwanda, and agreeing to take part.</li>
            <li><b>Answer codes</b>: Strongly disagree = 1, Disagree = 2, Agree = 3, Strongly agree = 4. ‘Not sure’ is treated as missing.</li>
            <li><b>Reverse-scoring</b>: for Q${K.ITEMS.filter((i) => i.reverse).map((i) => i.num).join(", Q")}, agreeing signals less self-clarity, so score = 5 − code.</li>
            <li><b>Theme score</b>: mean of the respondent's available statement scores in that theme (1–4). <b>Overall</b> = mean of all 21.</li>
            <li><b>Levels</b>: Low &lt; 2, Moderate 2–2.99, High ≥ 3.</li>
            <li><b>Confidence intervals</b>: 95%, t-distribution (needs n ≥ 2).</li>
            <li><b>Group tests</b> (R): Kruskal–Wallis across age groups (effect size ε²) and Wilcoxon rank-sum for each activity or circumstance vs. everyone else (effect size r). p-values adjusted with Benjamini–Hochberg.</li>
            <li><b>Quality flags</b>: under 3 minutes; the same answer to all statements (15+ answered); 6 or more ‘Not sure’; incomplete; duplicate ID.</li></ol></div>` })}
          ${K.card({ span: 6, icon: "fa-database", title: "Data source and refresh", body: `<dl class="kv">
              <dt>Source file</dt><dd><code>${K.esc(K.D.meta.data_file)}</code></dd>
              <dt>Built</dt><dd>${new Date(K.D.meta.built).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</dd>
              <dt>Records</dt><dd>${K.int(K.D.meta.n_all)} submissions · ${K.int(K.D.meta.n_valid)} analysed</dd>
              <dt>Engine</dt><dd>R (cleaning, scoring, statistics) → static web app</dd>
              <dt>Downloads</dt><dd><a href="data/respondent_scores.csv" download>respondent_scores.csv</a> · <a href="data/dashboard.json" download>dashboard.json</a></dd></dl>
              <div class="prose"><h4>Updating</h4><p>Every 5 minutes GitHub Actions downloads the Microsoft Forms responses workbook from SharePoint, R rebuilds the analysis when responses changed, and Vercel publishes the new version a few minutes later.</p></div>` })}
        </div>
        <div class="grid">${K.card({ span: 12, icon: "fa-book", title: "Codebook", sub: "Full wording of the 21 statements", body: '<div id="t-codebook"></div>' })}</div>`;

      // reliability chart + table
      const withA = relRows.filter((r) => r.alpha != null);
      if (withA.length) K.plot("c-alpha", [{ type: "scatter", mode: labelsOn() ? "markers+text" : "markers", y: withA.map((r) => r.label), x: withA.map((r) => r.alpha),
        marker: { size: 13, color: withA.map((r) => (r.key === "overall" ? K.blue() : K.themeColor(r.key))), line: { color: K.css("--surface"), width: 2 } },
        error_x: { type: "data", symmetric: false, array: withA.map((r) => (r.hi == null ? 0 : r.hi - r.alpha)), arrayminus: withA.map((r) => (r.lo == null ? 0 : r.alpha - r.lo)), color: K.css("--text-2"), thickness: 1.5, width: 5 },
        text: withA.map((r) => K.f(r.alpha)), textposition: "top center", textfont: { color: K.css("--text-2") },
        hovertemplate: "<b>%{y}</b><br>α = %{x:.2f}<extra></extra>" }],
        { margin: { l: 10 }, xaxis: { range: [Math.min(0, ...withA.map((r) => r.lo ?? r.alpha)) - 0.05, 1], title: { text: "Cronbach's α" } }, yaxis: { autorange: "reversed", automargin: true },
          shapes: [{ type: "line", x0: 0.7, x1: 0.7, y0: 0, y1: 1, yref: "paper", line: { color: K.css("--text-2"), dash: "dot", width: 1.2 } }] }, { height: 300 });
      K.table("t-rel", [
        { title: "Theme", data: "label" }, { title: "Items", data: "k", className: "dt-type-numeric" },
        { title: "Complete n", data: "n", className: "dt-type-numeric" },
        { title: "α", data: "alpha", render: (v) => K.f(v), className: "dt-type-numeric" },
        { title: "95% CI", data: (r) => (r.lo == null ? "–" : `${K.f(r.lo)}–${K.f(r.hi)}`), className: "dt-type-numeric", orderable: false },
        { title: "Mean inter-item r", data: "mean_r", render: (v) => K.f(v), className: "dt-type-numeric" },
        { title: "Live α (filters)", data: "live", render: (v) => K.f(v), className: "dt-type-numeric" },
        { title: "Interpretation", data: "alpha", render: (v) => { const [t, c] = interp(v); return `<span class="badge ${c}">${t}</span>`; } },
      ], relRows, { filename: "reliability", noSearch: true, pageLength: 10 });
      if (itemRel.some((r) => r.item_total_r != null)) K.table("t-itemrel", [
        { title: "Q", data: "num", render: (v) => "Q" + v, className: "dt-type-numeric" },
        { title: "Statement", data: "short", className: "wrap", render: (v, t, r) => `${K.esc(v)}${r.reverse ? ' <span class="badge b-warn">R</span>' : ""}` },
        { title: "Theme", data: "theme", render: themeLabel, filter: "select" },
        { title: "Item–total r", data: "item_total_r", render: (v) => K.f(v), className: "dt-type-numeric" },
        { title: "α if removed", data: "alpha_if_deleted", render: (v) => K.f(v), className: "dt-type-numeric" },
        { title: "Theme α", data: "themeAlpha", render: (v) => K.f(v), className: "dt-type-numeric" },
        { title: "Note", data: (r) => (r.item_total_r == null ? "" : r.item_total_r < 0 ? "Negative: check keying" : r.alpha_if_deleted != null && r.themeAlpha != null && r.alpha_if_deleted > r.themeAlpha + 0.02 ? "Removing would raise α" : r.item_total_r < 0.2 ? "Weak" : "OK"),
          render: (v) => (v ? `<span class="badge ${v === "OK" ? "b-good" : v.startsWith("Negative") ? "b-bad" : "b-warn"}">${v}</span>` : "–"), filter: "select" },
      ], itemRel, { filename: "item_diagnostics", pageLength: 25 });

      const mins = all.map((r) => r.mins).filter((x) => x != null).map((x) => Math.min(x, 60));
      if (mins.length) K.plot("c-mins", [{ type: "histogram", x: mins, nbinsx: 24, marker: { color: K.blue(), line: { color: K.css("--surface"), width: 1 } },
        hovertemplate: "%{x} min: %{y}<extra></extra>" }],
        { xaxis: { title: { text: "Minutes (capped at 60)" } }, yaxis: { title: { text: "Submissions" } },
          shapes: [{ type: "line", x0: 3, x1: 3, y0: 0, y1: 1, yref: "paper", line: { color: K.css("--bad"), dash: "dot", width: 1.5 } }] }, { height: 300 });
      const reasons = {}; all.filter((r) => !r.eligible).forEach((r) => (reasons[r.reason] = (reasons[r.reason] || 0) + 1));
      const rk = Object.keys(reasons).sort((a, b) => reasons[a] - reasons[b]);
      if (rk.length) K.plot("c-reason", [{ type: "bar", orientation: "h", y: rk, x: rk.map((k) => reasons[k]), marker: { color: K.series(7) },
        text: rk.map((k) => reasons[k]), textposition: "outside", cliponaxis: false, textfont: { color: K.css("--text-2") }, hovertemplate: "%{y}: %{x}<extra></extra>" }],
        { margin: { l: 10, r: 30 }, xaxis: { title: { text: "Submissions" }, rangemode: "tozero" } }, { height: 80 + 40 * Math.max(rk.length, 3) });
      if (flagged.length) K.table("t-flags", [
        { title: "ID", data: "id" }, { title: "Date", data: (r) => r.date || "" },
        { title: "Status", data: (r) => (r.eligible ? "Analysed" : r.reason), filter: "select" },
        { title: "Minutes", data: (r) => r.mins, render: (v, t) => (t === "display" ? K.f(v, 1) : v ?? -1), className: "dt-type-numeric" },
        { title: "Answered", data: "nAns", className: "dt-type-numeric" }, { title: "Not sure", data: "nNS", className: "dt-type-numeric" },
        { title: "Flags", data: (r) => Object.keys(r.flags).filter((k) => r.flags[k]).map((k) => flagNames[k]).join(", "),
          render: (v) => v.split(", ").filter(Boolean).map((x) => `<span class="badge b-warn">${x}</span>`).join(" "), filter: "text" },
      ], flagged, { filename: "flagged_responses", pageLength: 10 });
      K.table("t-codebook", [
        { title: "Q", data: "num", render: (v) => "Q" + v, className: "dt-type-numeric" },
        { title: "Statement", data: (r) => K.D.statements[r.key], className: "wrap" },
        { title: "Theme", data: "theme", render: themeLabel, filter: "select" },
        { title: "Scoring", data: (r) => (r.reverse ? "Reverse (5 − code)" : "As answered"), filter: "select" },
      ], K.ITEMS, { filename: "codebook", pageLength: 25 });
    },
  };
})(window);
