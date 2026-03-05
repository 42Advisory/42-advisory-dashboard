import { Router } from "express";
import { dfsPost } from "../lib/dataforseo.js";
import { cached } from "../lib/cache.js";

const router = Router();

/** GET /api/ai-visibility */
router.get("/", async (_req, res) => {
  try {
    const data = await cached("ai-visibility", fetchAiVisibility, 10 * 60 * 1000);
    res.json(data);
  } catch (err: any) {
    console.error("ai-visibility error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

async function fetchAiVisibility() {
  // Core service keywords for 42 Advisory
  const targetKeywords = [
    "accounting firm melbourne",
    "tax accountant melbourne",
    "CPA firm melbourne",
    "business advisory melbourne",
    "bookkeeping services melbourne",
    "tax return accountant",
    "small business accountant melbourne",
    "SMSF accountant melbourne",
    "chartered accountant melbourne",
    "accounting firm brisbane",
  ];

  const [aiSearchVolume, llmMentions, chatGptResults, rankedInAiOverview] = await Promise.allSettled([
    // AI search volume for target keywords
    (async () => {
      const result = await dfsPost(
        "/dataforseo_labs/google/keyword_overview/live",
        [{
          keywords: targetKeywords,
          location_name: "Australia",
          language_code: "en",
        }]
      );
      return ((result as any)?.[0]?.items || []).map((item: any) => ({
        keyword: item.keyword || "",
        searchVolume: item.keyword_info?.search_volume || 0,
        cpc: item.keyword_info?.cpc || 0,
        difficulty: item.keyword_properties?.keyword_difficulty || 0,
        intent: item.search_intent_info?.main_intent || "",
        serpFeatures: item.serp_info?.serp_item_types || [],
        hasAiOverview: (item.serp_info?.serp_item_types || []).includes("ai_overview"),
      }));
    })(),

    // LLM mentions for our domain
    (async () => {
      try {
        const result = await dfsPost(
          "/dataforseo_labs/google/ranked_keywords/live",
          [{
            target: "42advisory.com.au",
            location_name: "Australia",
            language_code: "en",
            limit: 50,
            item_types: ["ai_overview_reference"],
          }]
        );
        return ((result as any)?.[0]?.items || []).map((item: any) => ({
          keyword: item.keyword_data?.keyword || "",
          volume: item.keyword_data?.keyword_info?.search_volume || 0,
          position: item.ranked_serp_element?.serp_item?.rank_group || 0,
        }));
      } catch {
        return [];
      }
    })(),

    // ChatGPT scrape for key queries
    (async () => {
      try {
        const queries = ["best accounting firm in melbourne", "CPA firm melbourne recommendation"];
        const results = [];
        for (const keyword of queries) {
          try {
            const result = await dfsPost(
              "/content_analysis/search/live",
              [{ keyword, limit: 5 }]
            );
            const items = (result as any)?.[0]?.items || [];
            results.push({
              query: keyword,
              mentions: items.filter((i: any) =>
                JSON.stringify(i).toLowerCase().includes("42advisory") ||
                JSON.stringify(i).toLowerCase().includes("42 advisory")
              ).length,
              totalResults: items.length,
            });
          } catch {
            results.push({ query: keyword, mentions: 0, totalResults: 0 });
          }
        }
        return results;
      } catch {
        return [];
      }
    })(),

    // Keywords where we appear in AI Overview
    (async () => {
      try {
        const result = await dfsPost(
          "/dataforseo_labs/google/ranked_keywords/live",
          [{
            target: "42advisory.com.au",
            location_name: "Australia",
            language_code: "en",
            limit: 20,
            order_by: ["keyword_data.keyword_info.search_volume,desc"],
          }]
        );
        const items = (result as any)?.[0]?.items || [];
        return items
          .filter((item: any) => {
            const types = item.keyword_data?.serp_info?.serp_item_types || [];
            return types.includes("ai_overview");
          })
          .map((item: any) => ({
            keyword: item.keyword_data?.keyword || "",
            volume: item.keyword_data?.keyword_info?.search_volume || 0,
            position: item.ranked_serp_element?.serp_item?.rank_group || 0,
          }));
      } catch {
        return [];
      }
    })(),
  ]);

  return {
    keywords: aiSearchVolume.status === "fulfilled" ? aiSearchVolume.value : [],
    aiOverviewKeywords: rankedInAiOverview.status === "fulfilled" ? rankedInAiOverview.value : [],
    llmMentions: llmMentions.status === "fulfilled" ? llmMentions.value : [],
    brandMentions: chatGptResults.status === "fulfilled" ? chatGptResults.value : [],
    errors: [aiSearchVolume, llmMentions, chatGptResults, rankedInAiOverview]
      .filter((r) => r.status === "rejected")
      .map((r: any) => r.reason?.message),
  };
}

export default router;
