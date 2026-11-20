// Tab switching + make charts resize when a hidden tab becomes visible
(function () {
  var tabs = document.querySelectorAll(".tab");
  var panels = document.querySelectorAll(".tab-panel");

  function show(id, push) {
    var target = document.getElementById("panel-" + id) ? id : "overview";
    panels.forEach(function (p) { p.classList.toggle("active", p.getAttribute("data-tab") === target); });
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-target") === target;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (push) { history.replaceState(null, "", "#" + target); window.scrollTo({ top: 0 }); }
    // plotly + DT size themselves on resize
    setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 30);
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () { show(t.getAttribute("data-target"), true); });
  });
  window.addEventListener("hashchange", function () { show(location.hash.slice(1), false); });
  show(location.hash.slice(1) || "overview", false);
})();
