import { Router } from "express";
import { google } from "googleapis";
import { getGoogleAuth, getGscSiteUrl } from "../lib/google-auth.js";
import { dfsPost } from "../lib/dataforseo.js";
import { cached } from "../lib/cache.js";

const router = Router();

/** GET /api/keywords — keyword performance data */
router.get("/", async (_req, res) => {
  try {
    const data = await cached("keywords", fetchKeywords, 5 * 60 * 1000);
    res.json(data);
  } catch (err: any) {
    console.error("keywords error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

async function fetchKeywords() {
  const auth = getGoogleAuth();
  const siteUrl = getGscSiteUrl();

  const [gscKeywords, dfsKeywords, dfsRankedKw] = await Promise.allSettled([
    // GSC: top queries last 28 days
    (async () => {
      const sc = google.searchconsole({ version: "v1", auth });
      const r: any = await sc.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: daysAgo(28),
          endDate: daysAgo(1),
          dimensions: ["query"],
          rowLimit: 100,
        },
      });
      return (r.data.rows || []).map((row: any) => ({
        keyword: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }));
    })(),

    // DataForSEO: keyword overview for top queries
    (async () => {
      // First get ranked keywords
      const result = await dfsPost(
        "/dataforseo_labs/google/ranked_keywords/live",
        [{
          target: "42advisory.com.au",
          location_name: "Australia",
          language_code: "en",
          limit: 100,
          order_by: ["ranked_serp_element.serp_item.rank_group,asc"],
        }]
      );
      return ((result as any)?.[0]?.items || []).map((item: any) => ({
        keyword: item.keyword_data?.keyword || "",
        position: item.ranked_serp_element?.serp_item?.rank_group || 0,
        volume: item.keyword_data?.keyword_info?.search_volume || 0,
        cpc: item.keyword_data?.keyword_info?.cpc || 0,
        traffic: item.ranked_serp_element?.serp_item?.etv || 0,
        url: item.ranked_serp_element?.serp_item?.url || "",
        difficulty: item.keyword_data?.keyword_properties?.keyword_difficulty || 0,
        intent: item.keyword_data?.search_intent_info?.main_intent || "",
      }));
    })(),

    // Position distribution
    (async () => {
      const result = await dfsPost(
        "/dataforseo_labs/google/domain_rank_overview/live",
        [{ target: "42advisory.com.au", location_name: "Australia", language_code: "en" }]
      );
      const m = (result as any)?.[0]?.metrics?.organic || {};
      return {
        pos1: m.pos_1 || 0,
        pos2_3: m.pos_2_3 || 0,
        pos4_10: m.pos_4_10 || 0,
        pos11_20: m.pos_11_20 || 0,
        pos21_30: m.pos_21_30 || 0,
        pos31_40: m.pos_31_40 || 0,
        pos41_50: m.pos_41_50 || 0,
        pos51_60: m.pos_51_60 || 0,
        pos61_70: m.pos_61_70 || 0,
        pos71_80: m.pos_71_80 || 0,
        pos81_90: m.pos_81_90 || 0,
        pos91_100: m.pos_91_100 || 0,
      };
    })(),
  ]);

  return {
    gscKeywords: gscKeywords.status === "fulfilled" ? gscKeywords.value : [],
    dfsKeywords: dfsKeywords.status === "fulfilled" ? dfsKeywords.value : [],
    positionDistribution: dfsRankedKw.status === "fulfilled" ? dfsRankedKw.value : null,
    errors: [gscKeywords, dfsKeywords, dfsRankedKw]
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
