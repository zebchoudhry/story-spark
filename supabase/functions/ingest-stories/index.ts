import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Simple SHA256 hash function for external IDs
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Extract domain from URL
function getDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace("www.", "");
  } catch {
    return "unknown";
  }
}

// Parse RSS XML manually (no external parser needed)
function parseRSSItems(xml: string): Array<{
  title: string;
  link: string;
  description: string;
  pubDate: string;
}> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
  
  // Handle both <item> (RSS) and <entry> (Atom) formats
  const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
  const entryMatches = xml.match(/<entry[^>]*>[\s\S]*?<\/entry>/gi) || [];
  const allItems = [...itemMatches, ...entryMatches];

  for (const itemXml of allItems) {
    const title = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || "";
    
    // Handle both <link>text</link> and <link href="..." /> formats
    let link = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1]?.trim() || "";
    if (!link) {
      link = itemXml.match(/<link[^>]*href="([^"]+)"/i)?.[1]?.trim() || "";
    }
    
    const description = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() || 
                        itemXml.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i)?.[1]?.trim() || "";
    const pubDate = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || 
                    itemXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]?.trim() || 
                    itemXml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1]?.trim() || "";

    if (title && link) {
      items.push({ title, link, description, pubDate });
    }
  }

  return items;
}

// Parse NUFORC HTML table
function parseNUFORCTable(html: string): Array<{
  dateTime: string;
  city: string;
  state: string;
  summary: string;
  reportUrl: string;
}> {
  const reports: Array<{ dateTime: string; city: string; state: string; summary: string; reportUrl: string }> = [];
  
  const rowMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  
  for (const row of rowMatches) {
    const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
    if (cells.length >= 5) {
      const cell0 = cells[0] || "";
      const cell1 = cells[1] || "";
      const cell2 = cells[2] || "";
      const cell4 = cells[4] || "";
      
      const linkMatch = cell0.match(/href="([^"]+)"/i);
      const dateTime = cell0.replace(/<[^>]+>/g, "").trim();
      const city = cell1.replace(/<[^>]+>/g, "").trim();
      const state = cell2.replace(/<[^>]+>/g, "").trim();
      const summary = cell4.replace(/<[^>]+>/g, "").trim();

      if (linkMatch && city) {
        const reportUrl = linkMatch[1].startsWith("http")
          ? linkMatch[1]
          : `https://nuforc.org/webreports/${linkMatch[1]}`;
        
        reports.push({ dateTime, city, state, summary, reportUrl });
      }
    }
  }

  return reports;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[ingest-stories] Starting ingestion run...");

  // Verify secret
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("INGEST_SECRET");

  if (!cronSecret || cronSecret !== expectedSecret) {
    console.error("[ingest-stories] Unauthorized: Invalid or missing x-cron-secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Initialize Supabase client with service role
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ============================================================
  // LOAD SOURCES FROM DATABASE
  // ============================================================
  console.log("[ingest-stories] Loading sources from database...");
  const { data: sources, error: sourcesError } = await supabase
    .from("sources")
    .select("*")
    .eq("active", true)
    .is("client_id", null);

  if (sourcesError || !sources) {
    console.error("[ingest-stories] Failed to load sources:", sourcesError);
    return new Response(JSON.stringify({ error: "Failed to load sources", details: sourcesError }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[ingest-stories] Loaded ${sources.length} active global sources`);

  // Group sources by type
  const redditSources = sources.filter((s: any) => s.source_type === "reddit");
  const rssSources = sources.filter((s: any) => s.source_type === "rss");
  const nuforcSources = sources.filter((s: any) => s.source_type === "custom" && s.genre === "nuforc");

  console.log(`[ingest-stories] Reddit: ${redditSources.length}, RSS: ${rssSources.length}, NUFORC: ${nuforcSources.length}`);

  let redditCount = 0;
  let rssCount = 0;
  let nuforcCount = 0;

  // Helper to check if story exists
  async function storyExists(externalId: string, url: string): Promise<boolean> {
    const { data } = await supabase
      .from("stories_raw")
      .select("id")
      .or(`external_id.eq.${externalId},url.eq.${url}`)
      .limit(1);
    return (data && data.length > 0) || false;
  }

  // Helper to insert story
  async function insertStory(story: {
    source_type: string;
    source_name: string;
    external_id: string;
    title: string;
    body: string | null;
    url: string;
    published_at: string | null;
  }): Promise<boolean> {
    try {
      const exists = await storyExists(story.external_id, story.url);
      if (exists) {
        return false;
      }

      const { error } = await supabase.from("stories_raw").insert({
        ...story,
        processed: false,
      });

      if (error) {
        console.error(`[ingest-stories] Insert error:`, error);
        return false;
      }

      console.log(`[ingest-stories] Inserted: ${story.title?.substring(0, 50)}...`);
      return true;
    } catch (err) {
      console.error(`[ingest-stories] Insert exception:`, err);
      return false;
    }
  }

  // Helper to update last_fetched_at
  async function markFetched(sourceId: string) {
    await supabase
      .from("sources")
      .update({ last_fetched_at: new Date().toISOString() })
      .eq("id", sourceId);
  }

  // ============================================================
  // 1. REDDIT INGESTION
  // ============================================================
  console.log("[ingest-stories] Starting Reddit ingestion...");
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

  async function fetchReddit(subreddit: string): Promise<any[]> {
    const urls = [
      `https://www.reddit.com/r/${subreddit}/new.json?limit=20`,
      `https://old.reddit.com/r/${subreddit}/new.json?limit=20`,
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=20`,
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "CreatorSignalsBot/1.0 (https://creatorsignals.app)",
            "Accept": "application/json",
          },
        });

        if (!res.ok) {
          console.log(`[ingest-stories] Reddit fetch failed r/${subreddit} [${url}] → ${res.status}`);
          continue;
        }

        const data = await res.json();
        if (!data?.data?.children) continue;

        console.log(`[ingest-stories] Fetched ${data.data.children.length} posts from r/${subreddit}`);
        return data.data.children;
      } catch (e) {
        console.log(`[ingest-stories] Error fetching ${url} →`, e);
        continue;
      }
    }

    // Fallback to Firecrawl
    if (FIRECRAWL_API_KEY) {
      try {
        const firecrawlRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: `https://old.reddit.com/r/${subreddit}/new/`,
            formats: ["markdown", "links"],
            onlyMainContent: true,
          }),
        });

        if (firecrawlRes.ok) {
          const firecrawlData = await firecrawlRes.json();
          const markdown = firecrawlData.data?.markdown || "";
          const links = firecrawlData.data?.links || [];
          
          const posts: any[] = [];
          const postPattern = /###\s*\[([^\]]+)\]\((\/r\/[^)]+)\)/g;
          let match;
          
          while ((match = postPattern.exec(markdown)) !== null) {
            const title = match[1];
            const permalink = match[2];
            const postId = permalink.split("/comments/")[1]?.split("/")[0] || "";
            
            if (postId && title) {
              posts.push({
                data: { id: postId, title, selftext: "", permalink, created_utc: Date.now() / 1000 }
              });
            }
          }
          
          for (const link of links) {
            if (link.includes("/comments/") && !posts.some((p: any) => link.includes(p.data.id))) {
              const parts = link.split("/comments/");
              if (parts[1]) {
                const postId = parts[1].split("/")[0];
                const titlePart = parts[1].split("/")[1]?.replace(/_/g, " ") || "Reddit Post";
                posts.push({
                  data: { id: postId, title: titlePart, selftext: "", permalink: `/r/${subreddit}/comments/${postId}/${parts[1].split("/")[1] || ""}`, created_utc: Date.now() / 1000 }
                });
              }
            }
          }
          
          if (posts.length > 0) {
            console.log(`[ingest-stories] Firecrawl extracted ${posts.length} posts for r/${subreddit}`);
            return posts.slice(0, 20);
          }
        }
      } catch (e) {
        console.log(`[ingest-stories] Firecrawl error:`, e);
      }
    }

    return [];
  }

  for (const source of redditSources) {
    const subreddit = source.source_url; // source_url stores subreddit name
    try {
      const posts = await fetchReddit(subreddit);
      if (posts.length === 0) continue;

      let subredditInserted = 0;
      for (const post of posts) {
        const p = post.data;
        if (!p || !p.id || !p.title) continue;

        const inserted = await insertStory({
          source_type: "reddit",
          source_name: `r/${subreddit}`,
          external_id: p.id,
          title: p.title,
          body: p.selftext ?? "",
          url: `https://reddit.com${p.permalink}`,
          published_at: new Date(p.created_utc * 1000).toISOString(),
        });

        if (inserted) { redditCount++; subredditInserted++; }
      }

      await markFetched(source.id);
      console.log(`[ingest-stories] Reddit r/${subreddit}: inserted ${subredditInserted}`);
    } catch (err) {
      console.error(`[ingest-stories] Reddit error for r/${subreddit}:`, err);
    }
  }

  console.log(`[ingest-stories] Reddit complete. Inserted: ${redditCount}`);

  // ============================================================
  // 2. RSS INGESTION (includes YouTube RSS feeds)
  // ============================================================
  console.log("[ingest-stories] Starting RSS ingestion...");

  for (const source of rssSources) {
    try {
      const response = await fetch(source.source_url, {
        headers: { "User-Agent": "CreatorSignals/1.0 (RSS Reader)" },
      });

      if (!response.ok) {
        console.error(`[ingest-stories] RSS fetch failed for ${source.source_url}: ${response.status}`);
        continue;
      }

      const xml = await response.text();
      const items = parseRSSItems(xml);
      const sourceName = getDomain(source.source_url);

      for (const item of items) {
        const externalId = await sha256(item.link);
        const published = item.pubDate ? new Date(item.pubDate).toISOString() : null;

        const inserted = await insertStory({
          source_type: "rss",
          source_name: sourceName,
          external_id: externalId,
          title: item.title,
          body: item.description || null,
          url: item.link,
          published_at: published,
        });

        if (inserted) rssCount++;
      }

      await markFetched(source.id);
      console.log(`[ingest-stories] RSS ${sourceName}: processed ${items.length} items`);
    } catch (err) {
      console.error(`[ingest-stories] RSS error for ${source.source_url}:`, err);
    }
  }

  // ============================================================
  // 3. NUFORC INGESTION
  // ============================================================
  console.log("[ingest-stories] Starting NUFORC ingestion...");
  
  for (const source of nuforcSources) {
    try {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const nuforcUrl = `https://nuforc.org/webreports/ndxe${yearMonth}.html`;

      const response = await fetch(nuforcUrl, {
        headers: { "User-Agent": "CreatorSignals/1.0 (NUFORC Reader)" },
      });

      if (response.ok) {
        const html = await response.text();
        const reports = parseNUFORCTable(html);

        for (const report of reports) {
          const externalId = await sha256(report.reportUrl);
          
          let publishedAt: string | null = null;
          try {
            if (report.dateTime) {
              const parts = report.dateTime.split(" ");
              if (parts.length >= 1) {
                const dateParts = parts[0].split("/");
                if (dateParts.length === 3) {
                  const year = parseInt(dateParts[2]) + 2000;
                  const month = parseInt(dateParts[0]) - 1;
                  const day = parseInt(dateParts[1]);
                  publishedAt = new Date(year, month, day).toISOString();
                }
              }
            }
          } catch { /* ignore date parse errors */ }

          const inserted = await insertStory({
            source_type: "nuforc",
            source_name: "NUFORC",
            external_id: externalId,
            title: `${report.city}, ${report.state} UFO Report`,
            body: report.summary,
            url: report.reportUrl,
            published_at: publishedAt,
          });

          if (inserted) nuforcCount++;
        }

        await markFetched(source.id);
        console.log(`[ingest-stories] NUFORC: processed ${reports.length} reports`);
      } else {
        console.error(`[ingest-stories] NUFORC fetch failed: ${response.status}`);
      }
    } catch (err) {
      console.error(`[ingest-stories] NUFORC error:`, err);
    }
  }

  const totalInserted = redditCount + rssCount + nuforcCount;
  console.log(`[ingest-stories] Complete. Reddit: ${redditCount}, RSS: ${rssCount}, NUFORC: ${nuforcCount}, Total: ${totalInserted}`);

  return new Response(
    JSON.stringify({
      sources_loaded: sources.length,
      reddit_sources: redditSources.length,
      rss_sources: rssSources.length,
      nuforc_sources: nuforcSources.length,
      reddit_count: redditCount,
      rss_count: rssCount,
      nuforc_count: nuforcCount,
      inserted: totalInserted,
      status: "ok",
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
