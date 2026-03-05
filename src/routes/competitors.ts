import { Router } from "express";
import { dfsPost } from "../lib/dataforseo.js";
import { cached } from "../lib/cache.js";

const router = Router();

/** GET /api/competitors */
router.get("/", async (_req, res) => {
  try {
    const data = await cached("competitors", fetchCompetitors, 10 * 60 * 1000);
    res.json(data);
  } catch (err: any) {
    console.error("competitors error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

async function fetchCompetitors() {
  const [competitors, intersection] = await Promise.allSettled([
    // Domain competitors
    (async () => {
      const result = await dfsPost(
        "/dataforseo_labs/google/competitors_domain/live",
        [{
          target: "42advisory.com.au",
          location_name: "Australia",
          language_code: "en",
          limit: 20,
          exclude_top_domains: true,
        }]
      );
      return ((result as any)?.[0]?.items || []).map((item: any) => ({
        domain: item.domain || "",
        commonKeywords: item.avg_position ? undefined : item.metrics?.organic?.count || 0,
        organicTraffic: item.metrics?.organic?.etv || 0,
        organicKeywords: item.metrics?.organic?.count || 0,
        trafficValue: item.metrics?.organic?.estimated_paid_traffic_cost || 0,
        intersections: item.relevant_serp_items || 0,
        avgPosition: item.avg_position || 0,
        rating: item.rating || 0,
      }));
    })(),

    // Top competitor keyword intersection
    (async () => {
      // Get top 3 competitors first, then intersect with first one
      const compResult = await dfsPost(
        "/dataforseo_labs/google/competitors_domain/live",
        [{
          target: "42advisory.com.au",
          location_name: "Australia",
          language_code: "en",
          limit: 3,
          exclude_top_domains: true,
        }]
      );
      const topComp = (compResult as any)?.[0]?.items?.[0]?.domain;
      if (!topComp) return { competitor: null, keywords: [] };

      const intResult = await dfsPost(
        "/dataforseo_labs/google/domain_intersection/live",
        [{
          target1: "42advisory.com.au",
          target2: topComp,
          location_name: "Australia",
          language_code: "en",
          limit: 20,
          order_by: ["keyword_data.keyword_info.search_volume,desc"],
        }]
      );
      return {
        competitor: topComp,
        keywords: ((intResult as any)?.[0]?.items || []).map((item: any) => ({
          keyword: item.keyword_data?.keyword || "",
          volume: item.keyword_data?.keyword_info?.search_volume || 0,
          ourPosition: item.first_domain_serp_element?.serp_item?.rank_group || "N/A",
          theirPosition: item.second_domain_serp_element?.serp_item?.rank_group || "N/A",
        })),
      };
    })(),
  ]);

  return {
    competitors: competitors.status === "fulfilled" ? competitors.value : [],
    intersection: intersection.status === "fulfilled" ? intersection.value : null,
    errors: [competitors, intersection]
      .filter((r) => r.status === "rejected")
      .map((r: any) => r.reason?.message),
  };
}

export default router;
