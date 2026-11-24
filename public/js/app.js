/* ==========================================================================
   app.js — navigation, global filters, routing, theme, share & print
   ========================================================================== */
(function () {
  "use strict";
  const K = window.K, P = K.pages, $ = (s) => document.querySelector(s);
  const NAV = [
    ["Summary", ["overview", "respondents"]],
    ["Results", ["statements", "themes"]],
    ["Data", ["explorer", "methods"]],
  ];
  const FILTER_LABEL = { age: "Age", act: "Activity", circ: "Circumstance", from: "From", to: "To" };

  // ---------------------------------------------------------------- sidebar
  $("#nav").innerHTML = NAV.map(([g, ids]) => `<div class="nav-group">${g}</div>` +
    ids.map((id) => `<a href="#${id}" data-page="${id}"><i class="fa-solid ${P[id].icon}"></i>${P[id].title}</a>`).join("")).join("");

  const fillSelect = (sel, label, opts) => { $(sel).innerHTML = `<option value="">All ${label}</option>` + opts.map((o) => `<option>${K.esc(o)}</option>`).join(""); };
  fillSelect("#f-age", "ages", K.AGE_VALID);
  fillSelect("#f-act", "activities", K.D.activity_options);
  fillSelect("#f-circ", "circumstances", K.D.circumstance_options);
  ["#f-from", "#f-to"].forEach((s) => { $(s).min = K.dateMin; $(s).max = K.dateMax; });

  const m = K.D.meta;
  const live = m.source === "kobo" || m.source === "forms";
  const liveName = m.source === "forms" ? "Live from Microsoft Forms" : "Live from KoBoToolbox";
  $("#sidebar-foot").innerHTML = `<div class="live-row"><span class="live-dot ${live ? "on" : ""}"></span> ${live ? liveName : `<i class="fa-regular fa-file-excel"></i> ${K.esc(m.data_file)}`}</div>
    <div><i class="fa-regular fa-clock"></i> Updated ${new Date(m.built).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
    <div><i class="fa-solid fa-database"></i> ${K.int(m.n_all)} submissions · ${K.int(m.n_valid)} analysed</div>`;
  $("#page-foot").innerHTML = `<span>Knowing and Living the Self · anonymous survey of adults aged 18–50 in Rwanda</span>
    <span>Analysis in R · charts by Plotly · tables by DataTables</span>`;

  // ---------------------------------------------------------------- URL state
  const readHash = () => {
    const [page, q] = location.hash.replace(/^#/, "").split("?");
    K.state.page = P[page] ? page : "overview";
    const p = new URLSearchParams(q || "");
    ["age", "act", "circ", "from", "to"].forEach((k) => (K.state[k] = p.get(k) || ""));
  };
  const writeHash = () => {
    const p = new URLSearchParams(); ["age", "act", "circ", "from", "to"].forEach((k) => K.state[k] && p.set(k, K.state[k]));
    const h = "#" + K.state.page + (p.toString() ? "?" + p.toString() : "");
    if (location.hash !== h) history.replaceState(null, "", h);
  };

  // ---------------------------------------------------------------- render
  K.render = () => {
    const s = K.state, page = P[s.page];
    K.cleanup();
    document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.page === s.page));
    $("#crumb-section").textContent = page.section; $("#crumb-title").textContent = page.title;
    document.title = `${page.title} · Knowing and Living the Self`;
    $("#f-age").value = s.age; $("#f-act").value = s.act; $("#f-circ").value = s.circ; $("#f-from").value = s.from; $("#f-to").value = s.to;
    const act = K.activeFilters();
    $("#filter-status").className = "filter-status" + (act.length ? " on" : "");
    $("#filter-status").innerHTML = act.length ? `<i class="fa-solid fa-filter"></i> ${act.length} filter${act.length > 1 ? "s" : ""} active` : '<i class="fa-regular fa-circle-check"></i> No filters active';
    $("#chips").innerHTML = act.map((k) => `<span class="chip">${FILTER_LABEL[k]}: ${K.esc(k === "from" || k === "to" ? K.dateLabel(s[k]) : s[k])}<button data-k="${k}" title="Remove filter" aria-label="Remove filter"><i class="fa-solid fa-xmark"></i></button></span>`).join("");
    $("#chips").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => K.setFilter(b.dataset.k, "")));
    const n = K.analysed().length;
    $("#n-badge").innerHTML = `<i class="fa-solid fa-user-check"></i> ${K.int(n)}${act.length ? ` / ${K.int(K.D.meta.n_valid)}` : ""}`;
    const el = $("#content");
    el.innerHTML = "";
    const wrap = document.createElement("div"); wrap.className = "fade-in"; el.appendChild(wrap);
    try { page.render(wrap); } catch (e) { console.error(e); wrap.innerHTML = K.empty("Something went wrong drawing this page: " + K.esc(e.message), "fa-triangle-exclamation"); }
    writeHash();
  };

  K.setFilter = (k, v) => { K.state[k] = K.state[k] === v ? "" : v; K.render(); if (v) K.toast(`Filter applied: ${FILTER_LABEL[k]} = ${v}`); };
  K.go = (page) => { K.state.page = page; K.render(); window.scrollTo({ top: 0, behavior: "smooth" }); document.body.classList.remove("nav-open"); };

  // ---------------------------------------------------------------- events
  document.querySelectorAll(".nav a").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); K.go(a.dataset.page); }));
  [["#f-age", "age"], ["#f-act", "act"], ["#f-circ", "circ"], ["#f-from", "from"], ["#f-to", "to"]].forEach(([sel, k]) =>
    $(sel).addEventListener("change", (e) => { K.state[k] = e.target.value; K.render(); }));
  $("#btn-reset").addEventListener("click", () => { ["age", "act", "circ", "from", "to"].forEach((k) => (K.state[k] = "")); K.render(); K.toast("Filters reset"); });
  $("#btn-menu").addEventListener("click", () => {
    if (window.innerWidth <= 900) document.body.classList.toggle("nav-open"); else document.body.classList.toggle("collapsed");
    setTimeout(() => window.dispatchEvent(new Event("resize")), 280);
  });
  $("#overlay").addEventListener("click", () => document.body.classList.remove("nav-open"));

  const setThemeBtn = () => { const d = K.dark(); $("#btn-theme").innerHTML = `<i class="fa-solid ${d ? "fa-sun" : "fa-moon"}"></i><span class="lbl">${d ? "Light" : "Dark"}</span>`; };
  $("#btn-theme").addEventListener("click", () => {
    const t = K.dark() ? "light" : "dark"; document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("klts-theme", t); } catch (e) {}
    setThemeBtn(); K.render();
  });
  $("#btn-labels").addEventListener("click", () => {
    K.state.labels = !K.state.labels; $("#btn-labels").classList.toggle("on", K.state.labels);
    try { localStorage.setItem("klts-labels", K.state.labels ? "1" : "0"); } catch (e) {}
    K.render();
  });
  $("#btn-share").addEventListener("click", async () => {
    writeHash();
    try { await navigator.clipboard.writeText(location.href); K.toast("Link copied: it opens this page with the same filters"); }
    catch (e) { prompt("Copy this link:", location.href); }
  });
  $("#btn-pdf").addEventListener("click", () => { K.toast("Choose ‘Save as PDF’ in the print dialog"); setTimeout(() => window.print(), 400); });
  window.addEventListener("hashchange", () => { readHash(); K.render(); });
  window.addEventListener("beforeprint", () => document.querySelectorAll(".js-plotly-plot").forEach((p) => Plotly.Plots.resize(p)));

  // ---------------------------------------------------------------- live refresh
  // Every 2 minutes, check whether a newer build has been published; if so, reload
  // (the URL keeps the current page and filters).
  if (location.protocol.startsWith("http")) {
    setInterval(async () => {
      try {
        const r = await fetch("data/dashboard.json?t=" + Date.now(), { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (j.meta && j.meta.built && j.meta.built !== K.D.meta.built) {
          K.toast(`New data: ${K.int(j.meta.n_all)} submissions. Updating…`);
          setTimeout(() => location.reload(), 2500);
        }
      } catch (e) { /* offline: try again next time */ }
    }, 120000);
  }

  // ---------------------------------------------------------------- start
  try { K.state.labels = localStorage.getItem("klts-labels") === "1"; } catch (e) {}
  $("#btn-labels").classList.toggle("on", K.state.labels);
  setThemeBtn(); readHash(); K.render();
})();
