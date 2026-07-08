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
    navy: "#1D428A", navy2: "#1D428A", baseline: "#1D428A",
    progress: "#007A3E", inkSoft: "#4a4a4a", inkMute: "#767676",
    rule: "#d6d7d9", goalLine: "rgba(0,0,0,0.5)", goalLabelBg: "rgba(214,215,217,0.92)", lightBlue: "#4ba4d6"
  };
 
  // ---- Inject styles once -------------------------------------------
  function injectStyles() {
    if (document.getElementById("bbc-dash-styles")) return;
    var css = "\
  .bbc-dash{width:100%;max-width:960px;margin:0 auto;overflow:hidden;background:#fff;font-family:Arial,sans-serif;color:#1b1b1b;font-size:15px;line-height:1.5}\
.bbc-dash *{box-sizing:border-box}\
.bbc-dash .bbc-head{background:linear-gradient(90deg,#1D428A 0%,#1D428A 35%,#4ba4d6 100%);color:#fff;padding:16px 24px;text-align:center}\
.bbc-dash .bbc-head h1{font-size:22px;font-weight:700;margin:0}\
.bbc-dash .bbc-body{padding:20px 24px 16px}\
.bbc-dash .bbc-ctitle{text-align:center;margin-bottom:14px}\
.bbc-dash .bbc-resource{font-size:18px;font-weight:700;color:#1D428A;margin-bottom:2px}\
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
.bbc-dash .bbc-tab{flex:1 1 0;min-width:110px;max-width:180px;padding:10px 18px;border:1.5px solid #1D428A;background:#fff;color:#1D428A;border-radius:999px;font:600 14px inherit;font-family:inherit;cursor:pointer;transition:background .12s,color .12s}\
.bbc-dash .bbc-tab:hover:not(.bbc-active):not(:disabled){background:rgba(29,66,138,.06)}\
.bbc-dash .bbc-tab.bbc-active{background:#1D428A;color:#fff}\
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
        // Render a light tag behind GOAL text so it stays readable over bars/lines.
        var t = "GOAL";
        ctx.font = '700 12px Arial,sans-serif';
        var textW = ctx.measureText(t).width;
        var padX = 6;
        var boxW = Math.ceil(textW + padX * 2);
        var boxH = 16;
        var x = ca.right - boxW - 2;
        var yTop = y - boxH - 3;
        if (yTop < ca.top + 2) yTop = y + 3;
        if (yTop + boxH > ca.bottom - 1) yTop = Math.max(ca.top + 2, y - boxH - 3);
        ctx.fillStyle = BB.goalLabelBg;
        ctx.fillRect(x, yTop, boxW, boxH);
        ctx.fillStyle = "#000";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(t, x + padX, yTop + boxH / 2);
        ctx.restore();
      }
    }, {
      id: "bbcSavingsBadge",
      afterDatasetsDraw: function (chart, args, opts) {
        if (!opts || !opts.text) return;
        var ca = chart.chartArea, ctx = chart.ctx;
        if (!ca) return;
        ctx.save();
        ctx.font = '700 12px Arial,sans-serif';
        var text = String(opts.text);
        var textW = ctx.measureText(text).width;
        var padX = 8;
        var boxH = 18;
        var boxW = Math.ceil(textW + padX * 2);
        var x = ca.left + 8;
        var y = ca.top + 6;
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillRect(x, y, boxW, boxH);
        ctx.fillStyle = BB.navy;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x + padX, y + boxH / 2);
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
    var order = ["energy", "water", "waste"];
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
    var availableResources = order.filter(function (res) {
      var rd = self.data.resources ? self.data.resources[res] : null;
      return !!(rd && rd.available);
    });

    if (!availableResources.length) {
      this.el.querySelector(".bbc-resource").textContent = "Performance Data";
      this.el.querySelector(".bbc-sub").textContent = "";
      var narr = this.el.querySelector(".bbc-narr");
      narr.classList.add("bbc-empty");
      narr.textContent = "No active performance data is currently available for this partner.";
      this.el.querySelector(".bbc-chartwrap").style.display = "none";
      this.el.querySelector(".bbc-sronly").innerHTML = "";
      tabsNav.style.display = "none";
      this.updateFade();
      return;
    }

    if (availableResources.length === 1) {
      tabsNav.style.display = "none";
    }

    availableResources.forEach(function (res) {
      var btn = document.createElement("button");
      btn.className = "bbc-tab"; btn.type = "button"; btn.setAttribute("role", "tab");
      btn.textContent = labelMap[res];
      btn.addEventListener("click", function () { self.select(res); });
      btn.dataset.res = res;
      tabsNav.appendChild(btn);
    });
 
    this.select(availableResources[0]);
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
    this.renderChart(d, res);
    this.renderTable(d, labelMap[res]);
    this.updateFade();
  };
 
  Dashboard.prototype.renderChart = function (d, res) {
    var canvas = this.el.querySelector("canvas");
    var colors = d.series.map(function (p) { return p.is_baseline ? BB.baseline : BB.progress; });
    var isStandardEnergy = d.chart_type === "bar_goal" && d.metric_label === "Energy Use Intensity";
    var isStandardWater = d.chart_type === "bar_goal" && d.metric_label === "Water Use Intensity";
    var isAapi = d.chart_type === "aapi_combo";
    var isLineTrend = d.chart_type === "line_trend";
    var baselinePoint = d.series.filter(function (p) { return p.is_baseline; })[0] || null;
    var baselineValue = baselinePoint ? Number(baselinePoint.value) : null;
    var latestPoint = d.series.length ? d.series[d.series.length - 1] : null;
    var latestValue = latestPoint ? Number(latestPoint.value) : null;
    var showSavingsBadge = (res === "energy" || res === "water") && (isStandardEnergy || isStandardWater)
      && baselineValue != null && isFinite(baselineValue) && baselineValue !== 0
      && latestValue != null && isFinite(latestValue);
    var savingsPct = showSavingsBadge ? ((baselineValue - latestValue) / baselineValue) * 100 : null;
    var savingsText = showSavingsBadge
      ? "Total Savings: " + fmt(Math.abs(savingsPct), 1) + "%" + (savingsPct < 0 ? " increase" : "")
      : "";
    var yAxisTitle = isStandardEnergy
      ? "Source EUI (kBtu/sq. ft.)"
      : d.metric_label + " (" + d.unit + ")";

    var datasets;
    if (isAapi) {
      datasets = [
        {
          type: "bar",
          data: d.series.map(function (p) { return p.value; }),
          backgroundColor: BB.progress,
          borderRadius: 0,
          borderSkipped: false,
          maxBarThickness: 40,
          categoryPercentage: 0.8,
          barPercentage: 0.9,
        },
        {
          type: "line",
          data: d.series.map(function (p) { return p.value; }),
          borderColor: BB.navy,
          backgroundColor: BB.navy,
          pointBackgroundColor: BB.navy,
          pointRadius: 3,
          borderWidth: 2,
          tension: 0.2,
          fill: false,
        }
      ];
    } else if (isLineTrend) {
      datasets = [
        {
          type: "line",
          data: d.series.map(function (p) { return p.value; }),
          borderColor: BB.progress,
          backgroundColor: BB.progress,
          pointBackgroundColor: BB.progress,
          pointRadius: 3,
          borderWidth: 2,
          tension: 0.2,
          fill: false,
        }
      ];
    } else {
      datasets = [{
        data: d.series.map(function (p) { return p.value; }),
        backgroundColor: colors, borderRadius: 0, borderSkipped: false,
        maxBarThickness: 40, categoryPercentage: 0.8, barPercentage: 0.9
      }];
    }

    this.chart = new Chart(canvas, {
      type: isLineTrend ? "line" : "bar",
      data: {
        labels: d.series.map(function (p) { return p.year; }),
        datasets: datasets
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: BB.navy, padding: 10, cornerRadius: 2,
            callbacks: { label: function (i) {
              var pt = d.series[i.dataIndex], tag = pt.is_baseline ? " (baseline)" : "";
              var valueLabel = " " + fmt(i.parsed.y) + " " + d.unit + tag;
              if (!isStandardEnergy || baselineValue == null || !isFinite(baselineValue) || baselineValue === 0) {
                return valueLabel;
              }
              var pctImprovement = ((baselineValue - Number(pt.value)) / baselineValue) * 100;
              return valueLabel + " | " + fmt(pctImprovement, 1) + "% Improvement from baseline";
            } }
          },
          bbcGoalLine: { value: d.goal_value },
          bbcSavingsBadge: showSavingsBadge ? { text: savingsText } : { text: null }
        },
        scales: {
          x: { grid: { display: false }, border: { color: BB.rule },
               title: { display: true, text: "Reporting Period", color: BB.inkSoft, font: { size: 12, weight: "600" }, padding: { top: 6 } } },
          y: { beginAtZero: true, suggestedMax: d.y_max || undefined,
               grid: { display: false }, border: { color: BB.rule },
               title: { display: true, text: yAxisTitle, color: BB.inkSoft, font: { size: 12, weight: "600" } } }
        }
      }
    });
  };
 
  Dashboard.prototype.renderTable = function (d, label) {
    var rows = d.series.map(function (p) {
      return "<tr><td>" + p.year + (p.is_baseline ? " (baseline)" : "") + "</td><td>" + fmt(p.value, 1) + "</td></tr>";
    }).join("");
    var goalText = (d.goal_value == null)
      ? "Goal: Not specified."
      : "Goal: " + fmt(d.goal_value, 1) + " " + d.unit + ".";
    this.el.querySelector(".bbc-sronly").innerHTML =
      "<caption>" + label + " performance: " + d.metric_label + " (" + d.unit + ") by reporting period. " + goalText + "</caption>" +
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
