import { Router } from "express";
import { dfsPost } from "../lib/dataforseo.js";
import { cached } from "../lib/cache.js";

const router = Router();

/** GET /api/audit */
router.get("/", async (_req, res) => {
  try {
    const data = await cached("audit", fetchAudit, 15 * 60 * 1000);
    res.json(data);
  } catch (err: any) {
    console.error("audit error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

async function fetchAudit() {
  const [lighthouse, instantPages, backlinks, techStack] = await Promise.allSettled([
    // Lighthouse audit
    (async () => {
      const result = await dfsPost(
        "/on_page/lighthouse/live/json",
        [{ url: "https://42advisory.com.au", for_mobile: false }]
      );
      const categories = (result as any)?.[0]?.categories || {};
      const audits = (result as any)?.[0]?.audits || {};
      return {
        scores: {
          performance: Math.round((categories.performance?.score || 0) * 100),
          accessibility: Math.round((categories.accessibility?.score || 0) * 100),
          bestPractices: Math.round((categories["best-practices"]?.score || 0) * 100),
          seo: Math.round((categories.seo?.score || 0) * 100),
        },
        coreWebVitals: {
          lcp: audits["largest-contentful-paint"]?.displayValue || "N/A",
          fid: audits["max-potential-fid"]?.displayValue || "N/A",
          cls: audits["cumulative-layout-shift"]?.displayValue || "N/A",
          fcp: audits["first-contentful-paint"]?.displayValue || "N/A",
          tbt: audits["total-blocking-time"]?.displayValue || "N/A",
          si: audits["speed-index"]?.displayValue || "N/A",
        },
      };
    })(),

    // On-page analysis
    (async () => {
      const result = await dfsPost(
        "/on_page/instant_pages",
        [{
          url: "https://42advisory.com.au",
          enable_javascript: true,
        }]
      );
      const items = (result as any)?.[0]?.items || [];
      const page = items[0] || {};
      return {
        title: page.meta?.title || "",
        description: page.meta?.description || "",
        h1: page.meta?.htags?.h1 || [],
        h2: page.meta?.htags?.h2 || [],
        wordCount: page.meta?.content?.plain_text_word_count || 0,
        internalLinks: page.meta?.internal_links_count || 0,
        externalLinks: page.meta?.external_links_count || 0,
        images: page.meta?.images_count || 0,
        imagesWithoutAlt: page.meta?.images_size || 0,
        statusCode: page.status_code || 0,
        loadTime: page.page_timing?.duration || 0,
      };
    })(),

    // Backlink summary
    (async () => {
      const result = await dfsPost(
        "/backlinks/summary/live",
        [{ target: "42advisory.com.au", include_subdomains: true }]
      );
      const item = (result as any)?.[0] || {};
      return {
        totalBacklinks: item.backlinks || 0,
        referringDomains: item.referring_domains || 0,
        referringIps: item.referring_ips || 0,
        dofollow: item.backlinks_nofollow === undefined ? 0 : (item.backlinks - (item.backlinks_nofollow || 0)),
        nofollow: item.backlinks_nofollow || 0,
        rank: item.rank || 0,
        brokenBacklinks: item.broken_backlinks || 0,
        referringPages: item.referring_pages || 0,
      };
    })(),

    // Tech stack
    (async () => {
      try {
        const result = await dfsPost(
          "/domain_analytics/technologies/domain_technologies/live",
          [{ target: "42advisory.com.au" }]
        );
        const techs = (result as any)?.[0]?.technologies || [];
        return techs.map((t: any) => ({
          name: t.name || "",
          category: t.category || "",
        }));
      } catch {
        return [];
      }
    })(),
  ]);

  return {
    lighthouse: lighthouse.status === "fulfilled" ? lighthouse.value : null,
    onPage: instantPages.status === "fulfilled" ? instantPages.value : null,
    backlinks: backlinks.status === "fulfilled" ? backlinks.value : null,
    techStack: techStack.status === "fulfilled" ? techStack.value : [],
    errors: [lighthouse, instantPages, backlinks, techStack]
      .filter((r) => r.status === "rejected")
      .map((r: any) => r.reason?.message),
  };
}

export default router;
