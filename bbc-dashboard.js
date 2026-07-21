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
    progress: "#007A3E", inkSoft: "#4a4a4a", inkAxis: "#2f2f2f", inkMute: "#767676",
    rule: "#d6d7d9", goalLine: "rgba(125,125,125,0.9)", goalLabelBg: "rgba(214,215,217,0.92)", lightBlue: "#4ba4d6"
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
.bbc-dash .bbc-resource{font-size:20px;font-weight:700;color:#1D428A;margin-bottom:2px}\
.bbc-dash .bbc-sub{font-size:14px;color:#4a4a4a}\
.bbc-dash .bbc-info{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;margin-left:5px;border:0;border-radius:50%;background:#1D428A;color:#fff;font:700 11px/1 Arial,sans-serif;vertical-align:middle;cursor:help}\
.bbc-dash .bbc-info:focus-visible{outline:2px solid #4ba4d6;outline-offset:2px}\
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
@media(max-width:480px){.bbc-dash .bbc-head h1{font-size:18px}.bbc-dash .bbc-resource{font-size:17px}.bbc-dash .bbc-chartwrap{height:240px}.bbc-dash .bbc-tabs{padding:14px 16px 16px;gap:8px}.bbc-dash .bbc-tab{padding:8px 12px;font-size:13px;min-width:0}.bbc-dash .bbc-body{padding:14px 16px 12px}}\
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

  function removeCustomPartnerText(value) {
    return String(value || "")
      .replace(/\[(?:inset|insert)\s+custom\s+partner\s+text\](?:\s*<br\s*\/?\s*>\s*)*/ig, "")
      .replace(/^(?:\s*<br\s*\/?\s*>\s*)+|(?:\s*<br\s*\/?\s*>\s*)+$/ig, "")
      .trim();
  }
 
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
        ctx.strokeStyle = BB.goalLine; ctx.setLineDash([6, 5]); ctx.lineWidth = 2.25;
        ctx.beginPath(); ctx.moveTo(ca.left, y); ctx.lineTo(ca.right, y); ctx.stroke();
        ctx.setLineDash([]);
        // Render a GOAL chip; background is only drawn when overlap is detected.
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
        var overlap = false;
        chart.getSortedVisibleDatasetMetas().forEach(function (meta) {
          if (overlap || meta.type !== "bar") return;
          meta.data.forEach(function (bar) {
            if (overlap || !bar || typeof bar.getProps !== "function") return;
            var p = bar.getProps(["x", "y", "base", "width"], true);
            var left = p.x - (p.width / 2);
            var right = p.x + (p.width / 2);
            var top = Math.min(p.y, p.base);
            var bottom = Math.max(p.y, p.base);
            if (right >= x && left <= x + boxW && bottom >= yTop && top <= yTop + boxH) {
              overlap = true;
            }
          });
        });
        if (overlap) {
          ctx.fillStyle = BB.goalLabelBg;
          ctx.fillRect(x, yTop, boxW, boxH);
        }
        ctx.fillStyle = BB.navy;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(t, x + (boxW / 2), yTop + boxH / 2);
        ctx.restore();
      }
    }, {
      id: "bbcZeroLine",
      afterDatasetsDraw: function (chart, args, opts) {
        if (!opts || opts.enabled !== true) return;
        var sc = chart.scales, ca = chart.chartArea, ctx = chart.ctx;
        if (!sc.y) return;
        var y = sc.y.getPixelForValue(0);
        if (y < ca.top || y > ca.bottom) return;
        ctx.save();
        ctx.strokeStyle = BB.inkAxis; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ca.left, y); ctx.lineTo(ca.right, y); ctx.stroke();
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
        var x = ca.right - boxW - 8;
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
    var subEl = this.el.querySelector(".bbc-sub");
    subEl.textContent = d.metric_label + " by Reporting Period";
    var infoEl = subEl.querySelector(".bbc-info");
    var metricTooltip = removeCustomPartnerText(d.metric_tooltip);
    if (metricTooltip) {
      infoEl = document.createElement("button");
      infoEl.className = "bbc-info";
      infoEl.type = "button";
      infoEl.setAttribute("aria-label", metricTooltip);
      infoEl.title = metricTooltip;
      infoEl.textContent = "i";
      subEl.appendChild(infoEl);
    } else {
      if (infoEl) infoEl.remove();
    }
    subEl.style.fontWeight = d.metric_label === "Energy Use Intensity" ? "700" : "400";
    narr.classList.remove("bbc-empty");
    narr.innerHTML = removeCustomPartnerText(d.narrative);
    this.renderChart(d, res);
    this.renderTable(d, labelMap[res]);
    this.updateFade();
  };
 
  Dashboard.prototype.renderChart = function (d, res) {
    var canvas = this.el.querySelector("canvas");
    var colors = d.series.map(function (p) { return p.is_baseline ? BB.baseline : BB.progress; });
    var isStandardEnergy = d.chart_type === "bar_goal" && d.metric_label === "Energy Use Intensity";
    var isStandardWater = d.chart_type === "bar_goal" && d.metric_label === "Water Use Intensity";
    var isIndustrialEnergy = d.chart_type === "bar_goal" && d.metric_label === "Cumulative Improvement as a % of Baseline";
    var isAapi = d.chart_type === "aapi_combo";
    var isLineTrend = d.chart_type === "line_trend";
    var isWasteCombo = d.chart_type === "waste_combo";
    var baselinePoint = d.series.filter(function (p) { return p.is_baseline; })[0] || null;
    var baselineValue = baselinePoint ? Number(baselinePoint.value) : null;
    var latestPoint = d.series.length ? d.series[d.series.length - 1] : null;
    var latestValue = latestPoint ? Number(latestPoint.value) : null;
    var showSavingsBadge = res === "water" && isStandardWater
      && baselineValue != null && isFinite(baselineValue) && baselineValue !== 0
      && latestValue != null && isFinite(latestValue);
    var savingsPct = showSavingsBadge ? ((baselineValue - latestValue) / baselineValue) * 100 : null;
    var savingsText = showSavingsBadge
      ? "Total Savings: " + fmt(Math.abs(savingsPct), 1) + "%" + (savingsPct < 0 ? " increase" : "")
      : "";
    var yAxisTitle = isStandardEnergy
      ? "Source EUI (kBtu/sq. ft.)"
      : isIndustrialEnergy
      ? "Percent of Baseline (%)"
      : isWasteCombo
      ? "Volume of Waste (tons)"
      : d.metric_label + " (" + d.unit + ")";
    var seriesCount = Math.max(1, d.series.length);
    var barSizing = seriesCount <= 2
      ? { maxBarThickness: 88, categoryPercentage: 0.9, barPercentage: 0.92 }
      : seriesCount <= 4
        ? { maxBarThickness: 60, categoryPercentage: 0.82, barPercentage: 0.9 }
        : { maxBarThickness: 40, categoryPercentage: 0.8, barPercentage: 0.9 };

    // AAPI values are stored as fractions. Use a stable whole-percentage grid
    // rather than data-dependent fractional padding, so the labels stay readable.
    var yAxisMin, yAxisMax, aapiHasNegative = false, aapiTickStep = 0.01;
    if (isAapi) {
      var values = d.series.map(function (p) { return Number(p.value); }).filter(function (v) { return isFinite(v); });
      if (values.length > 0) {
        var goalVal = (d.goal_value != null && isFinite(d.goal_value)) ? Number(d.goal_value) : 0;
        var dataMin = Math.min.apply(null, values.concat([goalVal]));
        var dataMax = Math.max.apply(null, values.concat([goalVal]));
        aapiHasNegative = dataMin < 0;
        yAxisMin = aapiHasNegative ? Math.floor(dataMin / aapiTickStep) * aapiTickStep : 0;
        yAxisMax = Math.ceil(dataMax / aapiTickStep) * aapiTickStep;
        // Leave one grid interval above a value or goal that lands on the top edge.
        if (dataMax >= yAxisMax - 0.000001) yAxisMax += aapiTickStep;
      } else {
        yAxisMin = 0;
        yAxisMax = aapiTickStep;
      }
    } else {
      yAxisMin = 0;
      yAxisMax = d.y_max || undefined;
    }

    var datasets;
    if (isAapi) {
      datasets = [
        {
          type: "bar",
          data: d.series.map(function (p) { return p.value; }),
          backgroundColor: BB.progress,
          borderRadius: 0,
          borderSkipped: false,
          maxBarThickness: barSizing.maxBarThickness,
          categoryPercentage: barSizing.categoryPercentage,
          barPercentage: barSizing.barPercentage,
        }
      ];
    } else if (isWasteCombo) {
      datasets = [
        {
          type: "bar",
          label: "Waste Not Diverted",
          data: d.series.map(function (p) { return Number(p.landfill_tons) || 0; }),
          backgroundColor: BB.navy,
          order: 2,
          borderRadius: 0,
          borderSkipped: false,
          stack: "waste",
          maxBarThickness: barSizing.maxBarThickness,
          categoryPercentage: barSizing.categoryPercentage,
          barPercentage: barSizing.barPercentage
        },
        {
          type: "bar",
          label: "Waste Diverted",
          data: d.series.map(function (p) { return Number(p.diverted_tons) || 0; }),
          backgroundColor: BB.progress,
          order: 2,
          borderRadius: 0,
          borderSkipped: false,
          stack: "waste",
          maxBarThickness: barSizing.maxBarThickness,
          categoryPercentage: barSizing.categoryPercentage,
          barPercentage: barSizing.barPercentage
        },
        {
          type: "line",
          label: "Diversion Rate",
          data: d.series.map(function (p) {
            var v = Number(p.diversion_rate);
            return isFinite(v) ? v : null;
          }),
          yAxisID: "y1",
          borderColor: BB.lightBlue,
          backgroundColor: BB.lightBlue,
          order: 0,
          pointBackgroundColor: BB.lightBlue,
          pointBorderColor: BB.lightBlue,
          pointRadius: 3,
          pointHoverRadius: 4,
          spanGaps: true,
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
        maxBarThickness: barSizing.maxBarThickness,
        categoryPercentage: barSizing.categoryPercentage,
        barPercentage: barSizing.barPercentage
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
          legend: {
            display: isWasteCombo,
            position: "bottom",
            align: "center",
            labels: {
              color: BB.inkAxis,
              boxWidth: 12,
              boxHeight: 12,
              padding: 12,
              font: { size: 11, weight: "600" },
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: BB.navy, padding: 10, cornerRadius: 2,
            callbacks: { label: function (i) {
              if (isWasteCombo) {
                if (i.datasetIndex === 2) {
                  return " " + fmt(i.parsed.y, 1) + "%";
                }
                return " " + fmt(i.parsed.y, 1) + " tons";
              }
              var pt = d.series[i.dataIndex], tag = pt.is_baseline ? " (baseline)" : "";
              var valueLabel = isAapi
                ? (" " + fmt(i.parsed.y * 100, 1) + "%" + tag)
                : (" " + fmt(i.parsed.y) + " " + d.unit + tag);
              if (!isStandardEnergy || baselineValue == null || !isFinite(baselineValue) || baselineValue === 0) {
                return valueLabel;
              }
              var pctImprovement = ((baselineValue - Number(pt.value)) / baselineValue) * 100;
              return valueLabel + " | " + fmt(pctImprovement, 1) + "% Improvement from baseline";
            } }
          },
          bbcGoalLine: { value: isWasteCombo ? null : d.goal_value },
          bbcZeroLine: { enabled: isAapi && aapiHasNegative },
          bbcSavingsBadge: showSavingsBadge ? { text: savingsText } : { text: null }
        },
        scales: {
          x: { stacked: isWasteCombo, grid: { display: false }, border: { color: BB.rule },
               ticks: { color: BB.inkAxis },
               title: { display: true, text: "Reporting Period", color: BB.inkAxis, font: { size: 12, weight: "600" }, padding: { top: 6 } } },
          y: { stacked: isWasteCombo,
               min: yAxisMin,
               max: yAxisMax,
               grid: { display: false }, border: { color: BB.rule },
               ticks: {
                 color: BB.inkAxis,
                 stepSize: isAapi ? aapiTickStep : undefined,
                 callback: function (value) {
                   return isAapi ? (fmt(value * 100, 1) + "%") : fmt(value, 0);
                 }
               },
               title: { display: true, text: yAxisTitle, color: BB.inkAxis, font: { size: 12, weight: "600" } } },
          y1: {
               display: isWasteCombo,
               position: "right",
               min: 0,
               suggestedMax: 100,
               grid: { drawOnChartArea: false },
               ticks: {
                 color: BB.inkAxis,
                 callback: function (value) { return fmt(value, 0) + "%"; }
               },
               title: {
                 display: isWasteCombo,
                 text: "Diversion Rate (%)",
                 color: BB.inkAxis,
                 font: { size: 12, weight: "600" }
               }
          }
        }
      }
    });
  };
 
  Dashboard.prototype.renderTable = function (d, label) {
    var isAapi = d.chart_type === "aapi_combo";
    var isWasteCombo = d.chart_type === "waste_combo";
    if (isWasteCombo) {
      var wasteRows = d.series.map(function (p) {
        var diverted = fmt(Number(p.diverted_tons) || 0, 1);
        var landfill = fmt(Number(p.landfill_tons) || 0, 1);
        var diversion = (p.diversion_rate == null || !isFinite(Number(p.diversion_rate)))
          ? "N/A"
          : fmt(Number(p.diversion_rate), 1) + "%";
        return "<tr><td>" + p.year + (p.is_baseline ? " (baseline)" : "") + "</td><td>" + landfill + "</td><td>" + diverted + "</td><td>" + diversion + "</td></tr>";
      }).join("");
      this.el.querySelector(".bbc-sronly").innerHTML =
        "<caption>" + label + " performance by reporting period. Stacked bars show landfill and diverted waste, and line marks diversion rate.</caption>" +
        "<thead><tr><th>Reporting Period</th><th>Waste Not Diverted (tons)</th><th>Waste Diverted (tons)</th><th>Diversion Rate (%)</th></tr></thead><tbody>" + wasteRows + "</tbody>";
      return;
    }
    var rows = d.series.map(function (p) {
      var shown = isAapi ? (fmt(p.value * 100, 1) + "%") : fmt(p.value, 1);
      return "<tr><td>" + p.year + (p.is_baseline ? " (baseline)" : "") + "</td><td>" + shown + "</td></tr>";
    }).join("");
    var goalText = (d.goal_value == null)
      ? "Goal: Not specified."
      : (isAapi
          ? ("Goal: " + fmt(d.goal_value * 100, 1) + "%.")
          : ("Goal: " + fmt(d.goal_value, 1) + " " + d.unit + "."));
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
