import { Router } from "express";
import { google } from "googleapis";
import { getGoogleAuth, getGscSiteUrl, getGa4PropertyId } from "../lib/google-auth.js";
import { dfsPost } from "../lib/dataforseo.js";
import { cached } from "../lib/cache.js";

const router = Router();

/** GET /api/overview?range=30|90|180 — aggregate KPIs + trend data with period comparison */
router.get("/", async (req, res) => {
  try {
    const range = parseInt(req.query.range as string) || 30;
    const days = [30, 90, 180].includes(range) ? range : 30;
    const data = await cached(`overview-${days}`, () => fetchOverview(days), 5 * 60 * 1000);
    res.json(data);
  } catch (err: any) {
    console.error("overview error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

async function fetchOverview(days: number) {
  const auth = getGoogleAuth();
  const siteUrl = getGscSiteUrl();
  const property = getGa4PropertyId();

  const [gscData, gscPrev, ga4Summary, ga4Prev, ga4Trend, gscTrend, dfsMetrics] = await Promise.allSettled([
    // GSC: current period aggregate
    (async () => {
      const sc = google.searchconsole({ version: "v1", auth });
      const r: any = await sc.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: daysAgo(days),
          endDate: daysAgo(1),
          dimensions: [],
        },
      });
      const row = r.data.rows?.[0] || {};
      return {
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      };
    })(),

    // GSC: previous period aggregate (for comparison)
    (async () => {
      const sc = google.searchconsole({ version: "v1", auth });
      const r: any = await sc.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: daysAgo(days * 2),
          endDate: daysAgo(days + 1),
          dimensions: [],
        },
      });
      const row = r.data.rows?.[0] || {};
      return {
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      };
    })(),

    // GA4: current period summary
    (async () => {
      const analytics = google.analyticsdata({ version: "v1beta", auth });
      const r: any = await (analytics.properties as any).runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
          ],
        },
      });
      const vals = r.data.rows?.[0]?.metricValues || [];
      return {
        sessions: Number(vals[0]?.value || 0),
        users: Number(vals[1]?.value || 0),
        pageviews: Number(vals[2]?.value || 0),
        bounceRate: Number(vals[3]?.value || 0),
        avgDuration: Number(vals[4]?.value || 0),
      };
    })(),

    // GA4: previous period summary (for comparison)
    (async () => {
      const analytics = google.analyticsdata({ version: "v1beta", auth });
      const r: any = await (analytics.properties as any).runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo` }],
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
          ],
        },
      });
      const vals = r.data.rows?.[0]?.metricValues || [];
      return {
        sessions: Number(vals[0]?.value || 0),
        users: Number(vals[1]?.value || 0),
        pageviews: Number(vals[2]?.value || 0),
        bounceRate: Number(vals[3]?.value || 0),
        avgDuration: Number(vals[4]?.value || 0),
      };
    })(),

    // GA4: daily trend for selected period
    (async () => {
      const analytics = google.analyticsdata({ version: "v1beta", auth });
      const r: any = await (analytics.properties as any).runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
          dimensions: [{ name: "date" }],
          metrics: [{ name: "sessions" }, { name: "totalUsers" }],
          orderBys: [{ dimension: { dimensionName: "date", orderType: "ALPHANUMERIC" } }],
        },
      });
      return (r.data.rows || []).map((row: any) => ({
        date: row.dimensionValues[0].value,
        sessions: Number(row.metricValues[0].value),
        users: Number(row.metricValues[1].value),
      }));
    })(),

    // GSC: daily trend for selected period
    (async () => {
      const sc = google.searchconsole({ version: "v1", auth });
      const r: any = await sc.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: daysAgo(days),
          endDate: daysAgo(1),
          dimensions: ["date"],
        },
      });
      return (r.data.rows || []).map((row: any) => ({
        date: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }));
    })(),

    // DataForSEO: domain metrics (not period-dependent)
    (async () => {
      const result = await dfsPost(
        "/dataforseo_labs/google/domain_rank_overview/live",
        [{ target: "42advisory.com.au", location_name: "Australia", language_code: "en" }]
      );
      const item = (result as any)?.[0];
      return {
        organicTraffic: item?.metrics?.organic?.etv || 0,
        organicKeywords: item?.metrics?.organic?.count || 0,
        trafficValue: item?.metrics?.organic?.estimated_paid_traffic_cost || 0,
        paidTraffic: item?.metrics?.paid?.etv || 0,
      };
    })(),
  ]);

  return {
    gsc: gscData.status === "fulfilled" ? gscData.value : null,
    gscPrev: gscPrev.status === "fulfilled" ? gscPrev.value : null,
    ga4: ga4Summary.status === "fulfilled" ? ga4Summary.value : null,
    ga4Prev: ga4Prev.status === "fulfilled" ? ga4Prev.value : null,
    ga4Trend: ga4Trend.status === "fulfilled" ? ga4Trend.value : [],
    gscTrend: gscTrend.status === "fulfilled" ? gscTrend.value : [],
    dfs: dfsMetrics.status === "fulfilled" ? dfsMetrics.value : null,
    range: days,
    errors: [gscData, gscPrev, ga4Summary, ga4Prev, ga4Trend, gscTrend, dfsMetrics]
      .filter((r) => r.status === "rejected")
      .map((r: any) => r.reason?.message),
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default router;
