/* =====================================================================
   bbc-dashboard.js  —  Better Buildings Partner Performance Dashboard
   ---------------------------------------------------------------------
   ONE shared file referenced by every partner page. Contains all chart
   logic and styling — NO partner data. Update this file to fix bugs or
   add new graph types; every page that references it picks up the change.

   HOW A PAGE USES IT (the per-page snippet):
     <div class="bbc-dash" data-partner='{ ...partner JSON... }'></div>
     <script src="https://[your-host]/bbc-dashboard.js"></script>

   The script finds every .bbc-dash element on the page, reads its
   data-partner JSON, and renders the dashboard into it. Multiple
   dashboards per page are supported.

   Requires Chart.js (loaded automatically from CDN if not already present).
   ===================================================================== */
(function () {
  "use strict";

  var CHARTJS_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";

  var BB = {
    navy: "#112e51", navy2: "#1a4480", baseline: "#1a4480",
    progress: "#3a7d44", inkSoft: "#4a4a4a", inkMute: "#767676",
    rule: "#d6d7d9", goalLine: "#1a4480", lightBlue: "#4ba4d6"
  };

  // ---- Inject styles once -------------------------------------------
  function injectStyles() {
    if (document.getElementById("bbc-dash-styles")) return;
    var css = "\
.bbc-dash{max-width:700px;margin:0 auto;overflow:hidden;background:#fff;font-family:'Source Sans 3',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1b1b1b;font-size:15px;line-height:1.5}\
.bbc-dash *{box-sizing:border-box}\
.bbc-dash .bbc-head{background:linear-gradient(90deg,#112e51 0%,#1a4480 35%,#4ba4d6 100%);color:#fff;padding:16px 24px;text-align:center}\
.bbc-dash .bbc-head h1{font-size:22px;font-weight:700;margin:0}\
.bbc-dash .bbc-body{padding:20px 24px 16px}\
.bbc-dash .bbc-ctitle{text-align:center;margin-bottom:14px}\
.bbc-dash .bbc-resource{font-size:18px;font-weight:700;color:#112e51;margin-bottom:2px}\
.bbc-dash .bbc-sub{font-size:14px;color:#4a4a4a}\
.bbc-dash .bbc-chartwrap{position:relative;height:280px;margin-bottom:14px}\
.bbc-dash .bbc-narrwrap{position:relative;margin-top:4px}\
.bbc-dash .bbc-narr{font-size:14px;color:#1b1b1b;line-height:1.55;padding:0 4px 8px;max-height:110px;overflow-y:auto;scrollbar-width:thin;overflow-wrap:break-word}\
.bbc-dash .bbc-narr::-webkit-scrollbar{width:8px}\
.bbc-dash .bbc-narr::-webkit-scrollbar-thumb{background:#d6d7d9;border-radius:4px}\
.bbc-dash .bbc-narr strong{font-weight:700}\
.bbc-dash .bbc-narrwrap.bbc-scrollable::after{content:'';position:absolute;left:0;right:8px;bottom:0;height:28px;background:linear-gradient(to bottom,rgba(255,255,255,0),#fff);pointer-events:none}\
.bbc-dash .bbc-narrwrap.bbc-atbottom::after{opacity:0}\
.bbc-dash .bbc-narr.bbc-empty{color:#767676;font-style:italic;text-align:center;padding:20px;max-height:none;overflow:visible}\
.bbc-dash .bbc-tabs{border-top:1px solid #d6d7d9;padding:16px 24px 20px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap}\
.bbc-dash .bbc-tab{flex:1 1 0;min-width:110px;max-width:180px;padding:10px 18px;border:1.5px solid #112e51;background:#fff;color:#112e51;border-radius:999px;font:600 14px inherit;font-family:inherit;cursor:pointer;transition:background .12s,color .12s}\
.bbc-dash .bbc-tab:hover:not(.bbc-active):not(:disabled){background:rgba(26,68,128,.06)}\
.bbc-dash .bbc-tab.bbc-active{background:#112e51;color:#fff}\
.bbc-dash .bbc-tab:disabled{opacity:.4;cursor:not-allowed;border-color:#767676;color:#767676}\
.bbc-dash .bbc-tab:focus-visible{outline:2px solid #4ba4d6;outline-offset:2px}\
.bbc-dash .bbc-sronly{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}\
@media(max-width:480px){.bbc-dash .bbc-head h1{font-size:18px}.bbc-dash .bbc-resource{font-size:16px}.bbc-dash .bbc-chartwrap{height:240px}.bbc-dash .bbc-tabs{padding:14px 16px 16px;gap:8px}.bbc-dash .bbc-tab{padding:8px 12px;font-size:13px;min-width:0}.bbc-dash .bbc-body{padding:14px 16px 12px}}\
@media(prefers-reduced-motion:reduce){.bbc-dash *{animation:none!important;transition:none!important}}";
    var s = document.createElement("style");
    s.id = "bbc-dash-styles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  var fmt = function (n, d) {
    d = d || 0;
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  // ---- Goal line plugin ---------------------------------------------
  function registerGoalLine() {
    if (registerGoalLine.done) return;
    Chart.register({
      id: "bbcGoalLine",
      afterDatasetsDraw: function (chart, args, opts) {
        if (opts.value == null) return;
        var sc = chart.scales, ca = chart.chartArea, ctx = chart.ctx;
        var y = sc.y.getPixelForValue(opts.value);
        if (y < ca.top || y > ca.bottom) return;
        ctx.save();
        ctx.strokeStyle = BB.goalLine; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.25;
        ctx.beginPath(); ctx.moveTo(ca.left, y); ctx.lineTo(ca.right, y); ctx.stroke();
        ctx.setLineDash([]);
        // Plain navy "GOAL" label sitting just above the line at the right edge
        var t = "GOAL";
        ctx.font = '700 12px "Source Sans 3",sans-serif';
        ctx.fillStyle = BB.navy; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
        ctx.fillText(t, ca.right - 2, y - 3);
        ctx.restore();
      }
    });
    registerGoalLine.done = true;
  }

  // ---- One dashboard instance ---------------------------------------
  function Dashboard(el, data) {
    this.el = el;
    this.data = data;
    this.chart = null;
    this.render();
  }

  Dashboard.prototype.render = function () {
    var labelMap = { energy: "Energy", water: "Water", waste: "Waste" };
    var self = this;
    // The page template usually already shows a "Performance Data" header bar,
    // so by default the card does NOT render its own (avoids a doubled header).
    // Set "show_header": true in the partner data to render the card's own bar
    // (useful when the dashboard stands alone on a page without one).
    var headerHTML = (this.data.show_header === true)
      ? '<div class="bbc-head"><h1>Performance Data</h1></div>'
      : '';
    this.el.innerHTML =
      headerHTML +
      '<div class="bbc-body">' +
        '<div class="bbc-ctitle"><div class="bbc-resource"></div><div class="bbc-sub"></div></div>' +
        '<div class="bbc-chartwrap"><canvas role="img"></canvas></div>' +
        '<div class="bbc-narrwrap"><p class="bbc-narr"></p></div>' +
        '<table class="bbc-sronly"></table>' +
      '</div>' +
      '<nav class="bbc-tabs" role="tablist"></nav>';

    var tabsNav = this.el.querySelector(".bbc-tabs");
    ["energy", "water", "waste"].forEach(function (res) {
      var btn = document.createElement("button");
      btn.className = "bbc-tab"; btn.type = "button"; btn.setAttribute("role", "tab");
      btn.textContent = labelMap[res];
      var rd = self.data.resources ? self.data.resources[res] : null;
      if (!rd) btn.disabled = true;
      btn.addEventListener("click", function () { self.select(res); });
      btn.dataset.res = res;
      tabsNav.appendChild(btn);
    });

    var order = ["energy", "water", "waste"];
    var first = order.filter(function (r) {
      return self.data.resources && self.data.resources[r] && self.data.resources[r].available;
    })[0] || "energy";
    this.select(first);
  };

  Dashboard.prototype.select = function (res) {
    var labelMap = { energy: "Energy", water: "Water", waste: "Waste" };
    var self = this;
    this.el.querySelectorAll(".bbc-tab").forEach(function (t) {
      var active = t.dataset.res === res;
      t.classList.toggle("bbc-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });

    var d = this.data.resources ? this.data.resources[res] : null;
    this.el.querySelector(".bbc-resource").textContent = labelMap[res];
    if (this.chart) { this.chart.destroy(); this.chart = null; }

    var narr = this.el.querySelector(".bbc-narr");
    var wrap = this.el.querySelector(".bbc-narrwrap");
    var chartwrap = this.el.querySelector(".bbc-chartwrap");

    if (!d || !d.available) {
      this.el.querySelector(".bbc-sub").textContent = "";
      narr.classList.add("bbc-empty");
      narr.textContent = (d && d.narrative) || (labelMap[res] + " reporting is not currently active for this partner.");
      chartwrap.style.display = "none";
      this.el.querySelector(".bbc-sronly").innerHTML = "";
      this.updateFade();
      return;
    }
    chartwrap.style.display = "block";
    this.el.querySelector(".bbc-sub").textContent = d.metric_label + " by Reporting Period";
    narr.classList.remove("bbc-empty");
    narr.innerHTML = d.narrative || "";
    this.renderChart(d);
    this.renderTable(d, labelMap[res]);
    this.updateFade();
  };

  Dashboard.prototype.renderChart = function (d) {
    var canvas = this.el.querySelector("canvas");
    var colors = d.series.map(function (p) { return p.is_baseline ? BB.baseline : BB.progress; });
    this.chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: d.series.map(function (p) { return p.year; }),
        datasets: [{
          data: d.series.map(function (p) { return p.value; }),
          backgroundColor: colors, borderRadius: 0, borderSkipped: false,
          maxBarThickness: 40, categoryPercentage: 0.8, barPercentage: 0.9
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: BB.navy, padding: 10, cornerRadius: 2,
            callbacks: { label: function (i) {
              var pt = d.series[i.dataIndex], tag = pt.is_baseline ? " (baseline)" : "";
              return " " + fmt(i.parsed.y) + " " + d.unit + tag;
            } }
          },
          bbcGoalLine: { value: d.goal_value }
        },
        scales: {
          x: { grid: { display: false }, border: { color: BB.rule },
               title: { display: true, text: "Reporting Period", color: BB.inkSoft, font: { size: 12, weight: "600" }, padding: { top: 6 } } },
          y: { beginAtZero: true, suggestedMax: d.y_max || undefined,
               grid: { display: false }, border: { color: BB.rule },
               title: { display: true, text: d.metric_label + " (" + d.unit + ")", color: BB.inkSoft, font: { size: 12, weight: "600" } } }
        }
      }
    });
  };

  Dashboard.prototype.renderTable = function (d, label) {
    var rows = d.series.map(function (p) {
      return "<tr><td>" + p.year + (p.is_baseline ? " (baseline)" : "") + "</td><td>" + fmt(p.value, 1) + "</td></tr>";
    }).join("");
    this.el.querySelector(".bbc-sronly").innerHTML =
      "<caption>" + label + " performance: " + d.metric_label + " (" + d.unit + ") by reporting period. Goal: " + fmt(d.goal_value, 1) + " " + d.unit + ".</caption>" +
      "<thead><tr><th>Reporting Period</th><th>" + d.metric_label + " (" + d.unit + ")</th></tr></thead><tbody>" + rows + "</tbody>";
  };

  Dashboard.prototype.updateFade = function () {
    var narr = this.el.querySelector(".bbc-narr");
    var wrap = this.el.querySelector(".bbc-narrwrap");
    narr.scrollTop = 0;
    var overflows = narr.scrollHeight > narr.clientHeight + 1;
    wrap.classList.toggle("bbc-scrollable", overflows);
    wrap.classList.remove("bbc-atbottom");
    if (!narr.dataset.fadeBound) {
      narr.addEventListener("scroll", function () {
        var atB = narr.scrollTop + narr.clientHeight >= narr.scrollHeight - 2;
        wrap.classList.toggle("bbc-atbottom", atB);
      });
      narr.dataset.fadeBound = "true";
    }
  };

  // ---- Boot: find all .bbc-dash elements and render ------------------
  function boot() {
    injectStyles();
    registerGoalLine();
    var nodes = document.querySelectorAll(".bbc-dash:not([data-bbc-ready])");
    nodes.forEach(function (el) {
      el.setAttribute("data-bbc-ready", "1");
      var raw = el.getAttribute("data-partner");
      if (!raw) { el.innerHTML = '<div style="padding:40px;text-align:center;color:#b50909">No partner data found.</div>'; return; }
      var data;
      try { data = JSON.parse(raw); }
      catch (e) { el.innerHTML = '<div style="padding:40px;text-align:center;color:#b50909">Could not read partner data (' + e.message + ').</div>'; return; }
      new Dashboard(el, data);
    });
  }

  function ensureChartThenBoot() {
    if (window.Chart) { boot(); return; }
    var existing = document.querySelector('script[data-bbc-chartjs]');
    if (existing) { existing.addEventListener("load", boot); return; }
    var s = document.createElement("script");
    s.src = CHARTJS_CDN;
    s.setAttribute("data-bbc-chartjs", "1");
    s.onload = boot;
    s.onerror = function () {
      document.querySelectorAll(".bbc-dash").forEach(function (el) {
        el.innerHTML = '<div style="padding:40px;text-align:center;color:#b50909">Chart library failed to load.</div>';
      });
    };
    document.head.appendChild(s);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureChartThenBoot);
  } else {
    ensureChartThenBoot();
  }
})();