/* ===== 42 Advisory SEO Dashboard — Frontend ===== */

// -- Helpers --
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const fmt = (n) => n == null ? "—" : Number(n).toLocaleString("en-AU");
const fmtDec = (n, d = 1) => n == null ? "—" : Number(n).toFixed(d);
const fmtPct = (n) => n == null ? "—" : (Number(n) * 100).toFixed(1) + "%";
const fmtMoney = (n) => n == null ? "—" : "$" + Number(n).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate = (d) => {
  if (!d) return "";
  const s = String(d);
  if (s.length === 8) return s.slice(0,4) + "-" + s.slice(4,6) + "-" + s.slice(6,8);
  return s;
};

function setStatus(state, text) {
  const dot = $("#status-dot");
  const txt = $("#status-text");
  dot.className = "status-dot " + state;
  txt.textContent = text;
}

function showLoading(container) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div>Loading data...</div>';
}

function scoreColor(val) {
  if (val >= 90) return "score-good";
  if (val >= 50) return "score-ok";
  return "score-bad";
}

function intentBadge(intent) {
  const colors = { informational: "badge-blue", commercial: "badge-orange", transactional: "badge-green", navigational: "badge-gray" };
  return `<span class="badge ${colors[intent] || "badge-gray"}">${intent || "—"}</span>`;
}

function positionBadge(pos) {
  if (pos <= 3) return `<span class="badge badge-green">${pos}</span>`;
  if (pos <= 10) return `<span class="badge badge-blue">${pos}</span>`;
  if (pos <= 20) return `<span class="badge badge-orange">${pos}</span>`;
  return `<span class="badge badge-red">${pos}</span>`;
}

function makeTable(headers, rows) {
  if (!rows || rows.length === 0) return "<p style='color:#6b7280;padding:16px'>No data available</p>";
  let html = "<table><thead><tr>";
  headers.forEach(h => { html += `<th class="${h.align || ''}">${h.label}</th>`; });
  html += "</tr></thead><tbody>";
  rows.forEach(row => {
    html += "<tr>";
    headers.forEach(h => { html += `<td class="${h.align || ''}">${h.render ? h.render(row) : (row[h.key] ?? "—")}</td>`; });
    html += "</tr>";
  });
  html += "</tbody></table>";
  return html;
}

// -- Charts store --
const charts = {};
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

// -- Tab Navigation --
const tabLoaded = {};

$$(".nav-link").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const tab = link.dataset.tab;
    $$(".nav-link").forEach(l => l.classList.remove("active"));
    link.classList.add("active");
    $$(".tab-content").forEach(t => t.classList.remove("active"));
    $(`#tab-${tab}`).classList.add("active");
    $("#page-title").textContent = link.textContent.trim();
    if (!tabLoaded[tab]) {
      tabLoaded[tab] = true;
      loadTab(tab);
    }
  });
});

function loadTab(tab) {
  const loaders = { overview: loadOverview, keywords: loadKeywords, competitors: loadCompetitors, "ai-visibility": loadAiVisibility, audit: loadAudit };
  if (loaders[tab]) loaders[tab]();
}

// ===== OVERVIEW TAB =====

// Delta display helper
function showDelta(elId, current, previous, inverse) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (current == null || previous == null || previous === 0) {
    el.textContent = "";
    el.className = "kpi-delta";
    return;
  }
  const pctChange = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pctChange) < 0.1) {
    el.textContent = "— 0%";
    el.className = "kpi-delta neutral";
    return;
  }
  const isPositive = pctChange > 0;
  const isGood = inverse ? !isPositive : isPositive;
  const arrow = isPositive ? "▲" : "▼";
  el.textContent = `${arrow} ${Math.abs(pctChange).toFixed(1)}% vs prev period`;
  el.className = `kpi-delta ${isGood ? "up" : "down"}`;
}

const rangeLabelMap = { 30: "30 days", 90: "3 months", 180: "6 months" };

async function loadOverview(range) {
  range = range || 30;
  setStatus("", "Loading overview...");
  try {
    const data = await fetch(`/api/overview?range=${range}`).then(r => r.json());
    if (data.error) throw new Error(data.error);

    const rangeLabel = rangeLabelMap[range] || `${range} days`;

    // KPIs with period-over-period comparison
    if (data.ga4) {
      $("#kpi-sessions").textContent = fmt(data.ga4.sessions);
      $("#kpi-users").textContent = fmt(data.ga4.users);
      $("#kpi-bounce").textContent = fmtPct(data.ga4.bounceRate);
      if (data.ga4Prev) {
        showDelta("kpi-sessions-delta", data.ga4.sessions, data.ga4Prev.sessions, false);
        showDelta("kpi-users-delta", data.ga4.users, data.ga4Prev.users, false);
        showDelta("kpi-bounce-delta", data.ga4.bounceRate, data.ga4Prev.bounceRate, true);
      }
    }
    if (data.gsc) {
      $("#kpi-clicks").textContent = fmt(data.gsc.clicks);
      $("#kpi-position").textContent = fmtDec(data.gsc.position);
      $("#kpi-ctr").textContent = fmtPct(data.gsc.ctr);
      if (data.gscPrev) {
        showDelta("kpi-clicks-delta", data.gsc.clicks, data.gscPrev.clicks, false);
        showDelta("kpi-position-delta", data.gsc.position, data.gscPrev.position, true);
        showDelta("kpi-ctr-delta", data.gsc.ctr, data.gscPrev.ctr, false);
      }
    }
    if (data.dfs) {
      $("#kpi-keywords").textContent = fmt(data.dfs.organicKeywords);
      $("#kpi-traffic-value").textContent = fmtMoney(data.dfs.trafficValue);
    }
    // DFS has no period comparison — clear those deltas
    ["kpi-keywords-delta", "kpi-traffic-value-delta"].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ""; el.className = "kpi-delta"; }
    });

    // Update chart titles
    const ga4Title = document.getElementById("chart-ga4-title");
    const gscTitle = document.getElementById("chart-gsc-title");
    if (ga4Title) ga4Title.textContent = `Sessions & Users (${rangeLabel})`;
    if (gscTitle) gscTitle.textContent = `Clicks & Impressions (${rangeLabel})`;

    // GA4 Trend Chart
    if (data.ga4Trend && data.ga4Trend.length > 0) {
      destroyChart("ga4-trend");
      const labels = data.ga4Trend.map(d => fmtDate(d.date));
      charts["ga4-trend"] = new Chart($("#chart-ga4-trend"), {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Sessions", data: data.ga4Trend.map(d => d.sessions), borderColor: "#FFC907", backgroundColor: "rgba(255,201,7,0.12)", fill: true, tension: 0.3, borderWidth: 2, pointRadius: range > 30 ? 0 : 3 },
            { label: "Users", data: data.ga4Trend.map(d => d.users), borderColor: "#1a1a1a", backgroundColor: "rgba(26,26,26,0.06)", fill: true, tension: 0.3, borderWidth: 2, pointRadius: range > 30 ? 0 : 3 },
          ],
        },
        options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { x: { display: true, ticks: { maxTicksLimit: range > 90 ? 12 : 7 } } } },
      });
    }

    // GSC Trend Chart
    if (data.gscTrend && data.gscTrend.length > 0) {
      destroyChart("gsc-trend");
      charts["gsc-trend"] = new Chart($("#chart-gsc-trend"), {
        type: "line",
        data: {
          labels: data.gscTrend.map(d => d.date),
          datasets: [
            { label: "Clicks", data: data.gscTrend.map(d => d.clicks), borderColor: "#FFC907", backgroundColor: "rgba(255,201,7,0.12)", fill: true, tension: 0.3, yAxisID: "y", borderWidth: 2, pointRadius: range > 30 ? 0 : 3 },
            { label: "Impressions", data: data.gscTrend.map(d => d.impressions), borderColor: "#1a1a1a", backgroundColor: "rgba(26,26,26,0.06)", fill: true, tension: 0.3, yAxisID: "y1", borderWidth: 2, pointRadius: range > 30 ? 0 : 3 },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "bottom" } },
          scales: {
            x: { ticks: { maxTicksLimit: range > 90 ? 12 : 7 } },
            y: { type: "linear", position: "left", title: { display: true, text: "Clicks" } },
            y1: { type: "linear", position: "right", title: { display: true, text: "Impressions" }, grid: { drawOnChartArea: false } },
          },
        },
      });
    }

    setStatus("ok", "Updated just now");
    if (data.errors && data.errors.length > 0) {
      console.warn("Overview partial errors:", data.errors);
    }
  } catch (err) {
    setStatus("err", "Error loading overview");
    console.error(err);
  }
}

// Range selector buttons
$$(".range-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".range-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    loadOverview(parseInt(btn.dataset.range));
  });
});

// ===== KEYWORDS TAB =====
async function loadKeywords() {
  setStatus("", "Loading keywords...");
  showLoading($("#keywords-table"));
  showLoading($("#gsc-keywords-table"));
  try {
    const data = await fetch("/api/keywords").then(r => r.json());
    if (data.error) throw new Error(data.error);

    const kws = data.dfsKeywords || [];
    const sorted = [...kws].sort((a, b) => a.position - b.position);

    // Calculate position distribution from actual keywords
    const pos1 = kws.filter(k => k.position === 1).length;
    const pos2_3 = kws.filter(k => k.position >= 2 && k.position <= 3).length;
    const pos4_10 = kws.filter(k => k.position >= 4 && k.position <= 10).length;
    const pos11_20 = kws.filter(k => k.position >= 11 && k.position <= 20).length;
    const pos21_50 = kws.filter(k => k.position >= 21 && k.position <= 50).length;
    const pos51_100 = kws.filter(k => k.position >= 51 && k.position <= 100).length;

    const top3 = pos1 + pos2_3;
    const top10 = top3 + pos4_10;
    const avgPos = kws.length > 0 ? kws.reduce((s, k) => s + k.position, 0) / kws.length : 0;

    // KPIs
    $("#kw-total").textContent = fmt(kws.length);
    $("#kw-avg-pos").textContent = fmtDec(avgPos);
    $("#kw-top10").textContent = fmt(top10);
    $("#kw-top3").textContent = fmt(top3);

    // Position Distribution Bar Chart
    destroyChart("positions");
    charts["positions"] = new Chart($("#chart-positions"), {
      type: "bar",
      data: {
        labels: ["#1", "#2-3", "#4-10", "#11-20", "#21-50", "#51-100"],
        datasets: [{
          label: "Keywords",
          data: [pos1, pos2_3, pos4_10, pos11_20, pos21_50, pos51_100],
          backgroundColor: ["#FFC907", "#ffe066", "#1a1a1a", "#4a4a4a", "#9ca3af", "#d1d5db"],
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Keywords" } },
          x: { title: { display: true, text: "Position Range" } },
        },
      },
    });

    // Top Ranking Keywords Horizontal Bar Chart (top 15 by position)
    const topKws = sorted.slice(0, 15);
    destroyChart("top-keywords");
    charts["top-keywords"] = new Chart($("#chart-top-keywords"), {
      type: "bar",
      data: {
        labels: topKws.map(k => k.keyword.length > 25 ? k.keyword.slice(0, 25) + "..." : k.keyword),
        datasets: [{
          label: "Position",
          data: topKws.map(k => k.position),
          backgroundColor: topKws.map(k => k.position <= 3 ? "#FFC907" : k.position <= 10 ? "#ffe066" : k.position <= 20 ? "#1a1a1a" : "#9ca3af"),
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, reverse: false, title: { display: true, text: "Position (lower = better)" } },
        },
      },
    });

    // DFS Keywords table — sorted by position (best first)
    $("#keywords-table").innerHTML = makeTable([
      { label: "Keyword", key: "keyword" },
      { label: "URL", key: "url", render: r => r.url ? `<a href="${r.url}" target="_blank" style="color:#FFC907;font-size:11px">${new URL(r.url).pathname}</a>` : "—" },
      { label: "Pos", key: "position", align: "text-center", render: r => positionBadge(r.position) },
      { label: "Volume", key: "volume", align: "text-right", render: r => fmt(r.volume) },
      { label: "Traffic", key: "traffic", align: "text-right", render: r => fmtDec(r.traffic, 0) },
      { label: "CPC", key: "cpc", align: "text-right", render: r => "$" + fmtDec(r.cpc, 2) },
      { label: "KD", key: "difficulty", align: "text-right" },
      { label: "Intent", key: "intent", render: r => intentBadge(r.intent) },
    ], sorted.slice(0, 50));

    // GSC Keywords table
    $("#gsc-keywords-table").innerHTML = makeTable([
      { label: "Query", key: "keyword" },
      { label: "Clicks", key: "clicks", align: "text-right", render: r => fmt(r.clicks) },
      { label: "Impressions", key: "impressions", align: "text-right", render: r => fmt(r.impressions) },
      { label: "CTR", key: "ctr", align: "text-right", render: r => fmtPct(r.ctr) },
      { label: "Position", key: "position", align: "text-center", render: r => positionBadge(Math.round(r.position)) },
    ], data.gscKeywords?.slice(0, 30));

    setStatus("ok", "Keywords loaded");
  } catch (err) {
    setStatus("err", "Error loading keywords");
    console.error(err);
  }
}

// ===== COMPETITORS TAB =====
async function loadCompetitors() {
  setStatus("", "Loading competitors...");
  showLoading($("#competitors-table"));
  showLoading($("#intersection-table"));
  try {
    const data = await fetch("/api/competitors").then(r => r.json());
    if (data.error) throw new Error(data.error);

    $("#competitors-table").innerHTML = makeTable([
      { label: "Domain", key: "domain", render: r => `<strong>${r.domain}</strong>` },
      { label: "Keywords", key: "organicKeywords", align: "text-right", render: r => fmt(r.organicKeywords) },
      { label: "Traffic", key: "organicTraffic", align: "text-right", render: r => fmt(Math.round(r.organicTraffic)) },
      { label: "Traffic Value", key: "trafficValue", align: "text-right", render: r => fmtMoney(r.trafficValue) },
      { label: "Intersections", key: "intersections", align: "text-right", render: r => fmt(r.intersections) },
      { label: "Avg Pos", key: "avgPosition", align: "text-right", render: r => fmtDec(r.avgPosition) },
    ], data.competitors);

    if (data.intersection && data.intersection.competitor) {
      $("#intersection-title").textContent = `Keyword Intersection — 42advisory.com.au vs ${data.intersection.competitor}`;
      $("#intersection-table").innerHTML = makeTable([
        { label: "Keyword", key: "keyword" },
        { label: "Volume", key: "volume", align: "text-right", render: r => fmt(r.volume) },
        { label: "Our Position", key: "ourPosition", align: "text-center", render: r => typeof r.ourPosition === "number" ? positionBadge(r.ourPosition) : r.ourPosition },
        { label: "Their Position", key: "theirPosition", align: "text-center", render: r => typeof r.theirPosition === "number" ? positionBadge(r.theirPosition) : r.theirPosition },
      ], data.intersection.keywords);
    } else {
      $("#intersection-table").innerHTML = "<p style='color:#6b7280;padding:16px'>No intersection data</p>";
    }

    setStatus("ok", "Competitors loaded");
  } catch (err) {
    setStatus("err", "Error loading competitors");
    console.error(err);
  }
}

// ===== AI VISIBILITY TAB =====
async function loadAiVisibility() {
  setStatus("", "Loading AI visibility...");
  showLoading($("#ai-keywords-table"));
  showLoading($("#ai-overview-table"));
  showLoading($("#llm-mentions-table"));
  try {
    const data = await fetch("/api/ai-visibility").then(r => r.json());
    if (data.error) throw new Error(data.error);

    // KPIs
    const withAiOverview = (data.keywords || []).filter(k => k.hasAiOverview).length;
    $("#ai-overview-count").textContent = fmt(withAiOverview);
    $("#ai-ranked-count").textContent = fmt((data.aiOverviewKeywords || []).length);
    $("#ai-mentions-count").textContent = fmt((data.llmMentions || []).length);

    // Keywords table
    $("#ai-keywords-table").innerHTML = makeTable([
      { label: "Keyword", key: "keyword" },
      { label: "Volume", key: "searchVolume", align: "text-right", render: r => fmt(r.searchVolume) },
      { label: "CPC", key: "cpc", align: "text-right", render: r => "$" + fmtDec(r.cpc, 2) },
      { label: "KD", key: "difficulty", align: "text-right" },
      { label: "Intent", key: "intent", render: r => intentBadge(r.intent) },
      { label: "AI Overview", key: "hasAiOverview", align: "text-center", render: r => r.hasAiOverview ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-gray">No</span>' },
    ], data.keywords);

    // AI Overview keywords
    $("#ai-overview-table").innerHTML = makeTable([
      { label: "Keyword", key: "keyword" },
      { label: "Volume", key: "volume", align: "text-right", render: r => fmt(r.volume) },
      { label: "Position", key: "position", align: "text-center", render: r => positionBadge(r.position) },
    ], data.aiOverviewKeywords?.length > 0 ? data.aiOverviewKeywords : null);

    // LLM Mentions
    $("#llm-mentions-table").innerHTML = makeTable([
      { label: "Keyword", key: "keyword" },
      { label: "Volume", key: "volume", align: "text-right", render: r => fmt(r.volume) },
      { label: "Position", key: "position", align: "text-center", render: r => positionBadge(r.position) },
    ], data.llmMentions?.length > 0 ? data.llmMentions : null);

    setStatus("ok", "AI visibility loaded");
  } catch (err) {
    setStatus("err", "Error loading AI visibility");
    console.error(err);
  }
}

// ===== AUDIT TAB =====
async function loadAudit() {
  setStatus("", "Running SEO audit (this may take 30s)...");
  showLoading($("#backlinks-summary"));
  showLoading($("#onpage-summary"));
  try {
    const data = await fetch("/api/audit").then(r => r.json());
    if (data.error) throw new Error(data.error);

    // Lighthouse scores
    if (data.lighthouse) {
      const s = data.lighthouse.scores;
      ["perf", "seo", "a11y", "bp"].forEach((k, i) => {
        const val = [s.performance, s.seo, s.accessibility, s.bestPractices][i];
        const el = $(`#audit-${k}`);
        el.textContent = val;
        el.className = "kpi-value score " + scoreColor(val);
      });

      // Radar chart
      destroyChart("lighthouse");
      charts["lighthouse"] = new Chart($("#chart-lighthouse"), {
        type: "radar",
        data: {
          labels: ["Performance", "SEO", "Accessibility", "Best Practices"],
          datasets: [{
            label: "Score",
            data: [s.performance, s.seo, s.accessibility, s.bestPractices],
            backgroundColor: "rgba(255,201,7,0.2)",
            borderColor: "#FFC907",
            pointBackgroundColor: "#FFC907",
          }],
        },
        options: { responsive: true, scales: { r: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } },
      });

      // Core Web Vitals
      const cwv = data.lighthouse.coreWebVitals;
      $("#cwv-grid").innerHTML = ["LCP", "FID", "CLS", "FCP", "TBT", "Speed Index"].map((label, i) => {
        const val = [cwv.lcp, cwv.fid, cwv.cls, cwv.fcp, cwv.tbt, cwv.si][i];
        return `<div class="cwv-item"><div class="label">${label}</div><div class="value">${val}</div></div>`;
      }).join("");
    }

    // Backlinks
    if (data.backlinks) {
      const bl = data.backlinks;
      $("#backlinks-summary").innerHTML = makeTable([
        { label: "Metric", key: "metric" },
        { label: "Value", key: "value", align: "text-right" },
      ], [
        { metric: "Total Backlinks", value: fmt(bl.totalBacklinks) },
        { metric: "Referring Domains", value: fmt(bl.referringDomains) },
        { metric: "Referring IPs", value: fmt(bl.referringIps) },
        { metric: "Dofollow Links", value: fmt(bl.dofollow) },
        { metric: "Nofollow Links", value: fmt(bl.nofollow) },
        { metric: "Broken Backlinks", value: fmt(bl.brokenBacklinks) },
        { metric: "Domain Rank", value: bl.rank },
      ]);
    }

    // On-page
    if (data.onPage) {
      const op = data.onPage;
      $("#onpage-summary").innerHTML = makeTable([
        { label: "Metric", key: "metric" },
        { label: "Value", key: "value", align: "text-right" },
      ], [
        { metric: "Title", value: op.title || "—" },
        { metric: "Meta Description", value: (op.description || "—").slice(0, 60) + "..." },
        { metric: "H1 Tags", value: (op.h1 || []).length },
        { metric: "H2 Tags", value: (op.h2 || []).length },
        { metric: "Word Count", value: fmt(op.wordCount) },
        { metric: "Internal Links", value: fmt(op.internalLinks) },
        { metric: "External Links", value: fmt(op.externalLinks) },
        { metric: "Status Code", value: op.statusCode },
        { metric: "Load Time", value: op.loadTime ? fmtDec(op.loadTime / 1000, 2) + "s" : "—" },
      ]);
    }

    // Tech stack
    if (data.techStack && data.techStack.length > 0) {
      $("#tech-stack").innerHTML = data.techStack.map(t =>
        `<div class="tag" title="${t.category}">${t.name}</div>`
      ).join("");
    } else {
      $("#tech-stack").innerHTML = "<p style='color:#6b7280'>No technology data available</p>";
    }

    setStatus("ok", "Audit complete");
  } catch (err) {
    setStatus("err", "Error running audit");
    console.error(err);
  }
}

// ===== Initial Load =====
tabLoaded["overview"] = true;
loadOverview(30);
