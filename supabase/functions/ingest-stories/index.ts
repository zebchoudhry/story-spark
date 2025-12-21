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
  const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of itemMatches) {
    const title = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || "";
    const link = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1]?.trim() || "";
    const description = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() || "";
    const pubDate = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || "";

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
  
  // Find table rows
  const rowMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  
  for (const row of rowMatches) {
    const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
    if (cells.length >= 5) {
      const cell0 = cells[0] || "";
      const cell1 = cells[1] || "";
      const cell2 = cells[2] || "";
      const cell4 = cells[4] || "";
      
      // Extract link from first cell
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[ingest-stories] Starting ingestion run...");

  // Verify secret
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("INGEST_SECRET");

  console.log("[ingest-stories] Received secret length:", cronSecret?.length || 0);
  console.log("[ingest-stories] Expected secret length:", expectedSecret?.length || 0);
  console.log("[ingest-stories] Expected secret exists:", !!expectedSecret);

  if (!cronSecret || cronSecret !== expectedSecret) {
    console.error("[ingest-stories] Unauthorized: Invalid or missing x-cron-secret");
    console.error("[ingest-stories] Match:", cronSecret === expectedSecret);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Initialize Supabase client with service role
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        console.log(`[ingest-stories] Skipping duplicate: ${story.external_id}`);
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

  // 1. REDDIT INGESTION
  console.log("[ingest-stories] Starting Reddit ingestion...");
  const subreddits = ["UFOs", "Paranormal", "UnresolvedMysteries"];
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

  // Helper function to fetch Reddit with fallback endpoints
  async function fetchReddit(subreddit: string): Promise<any[]> {
    const urls = [
      `https://www.reddit.com/r/${subreddit}/new.json?limit=20`,
      `https://old.reddit.com/r/${subreddit}/new.json?limit=20`,
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=20`,
    ];

    // Try direct API endpoints first
    for (const url of urls) {
      try {
        console.log(`[ingest-stories] Trying Reddit endpoint: ${url}`);
        
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
        
        if (!data?.data?.children) {
          console.log(`[ingest-stories] No children in response from ${url}`);
          continue;
        }

        console.log(`[ingest-stories] Successfully fetched ${data.data.children.length} posts from ${url}`);
        return data.data.children;
      } catch (e) {
        console.log(`[ingest-stories] Error fetching ${url} →`, e);
        continue;
      }
    }

    // Fallback to Firecrawl scraping if API fails
    if (FIRECRAWL_API_KEY) {
      console.log(`[ingest-stories] Trying Firecrawl scraping for r/${subreddit}...`);
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
          const markdown = firecrawlData.data?.markdown || firecrawlData.markdown || "";
          const links = firecrawlData.data?.links || firecrawlData.links || [];
          
          // Parse Reddit posts from markdown
          const posts: any[] = [];
          const postPattern = /###\s*\[([^\]]+)\]\((\/r\/[^)]+)\)/g;
          let match;
          
          while ((match = postPattern.exec(markdown)) !== null) {
            const title = match[1];
            const permalink = match[2];
            const postId = permalink.split("/comments/")[1]?.split("/")[0] || "";
            
            if (postId && title) {
              posts.push({
                data: {
                  id: postId,
                  title: title,
                  selftext: "",
                  permalink: permalink,
                  created_utc: Date.now() / 1000, // Use current time as fallback
                }
              });
            }
          }
          
          // Also try to extract from links
          for (const link of links) {
            if (link.includes("/comments/") && !posts.some(p => link.includes(p.data.id))) {
              const parts = link.split("/comments/");
              if (parts[1]) {
                const postId = parts[1].split("/")[0];
                const titlePart = parts[1].split("/")[1]?.replace(/_/g, " ") || "Reddit Post";
                posts.push({
                  data: {
                    id: postId,
                    title: titlePart,
                    selftext: "",
                    permalink: `/r/${subreddit}/comments/${postId}/${parts[1].split("/")[1] || ""}`,
                    created_utc: Date.now() / 1000,
                  }
                });
              }
            }
          }
          
          if (posts.length > 0) {
            console.log(`[ingest-stories] Firecrawl extracted ${posts.length} posts for r/${subreddit}`);
            return posts.slice(0, 20);
          }
        } else {
          console.log(`[ingest-stories] Firecrawl failed: ${firecrawlRes.status}`);
        }
      } catch (e) {
        console.log(`[ingest-stories] Firecrawl error:`, e);
      }
    }

    console.log(`[ingest-stories] All Reddit endpoints failed for r/${subreddit}`);
    return [];
  }

  for (const subreddit of subreddits) {
    try {
      const posts = await fetchReddit(subreddit);
      
      if (posts.length === 0) {
        console.log(`[ingest-stories] No posts retrieved for r/${subreddit}`);
        continue;
      }

      let subredditInserted = 0;
      for (const post of posts) {
        const p = post.data;
        
        if (!p || !p.id || !p.title) {
          continue;
        }

        const inserted = await insertStory({
          source_type: "reddit",
          source_name: `r/${subreddit}`,
          external_id: p.id,
          title: p.title,
          body: p.selftext ?? "",
          url: `https://reddit.com${p.permalink}`,
          published_at: new Date(p.created_utc * 1000).toISOString(),
        });

        if (inserted) {
          redditCount++;
          subredditInserted++;
        }
      }

      console.log(`[ingest-stories] Reddit r/${subreddit}: inserted ${subredditInserted} posts`);
    } catch (err) {
      console.error(`[ingest-stories] Reddit error for r/${subreddit}:`, err);
    }
  }
  
  console.log(`[ingest-stories] Reddit ingestion complete. Total inserted: ${redditCount}`);

  // 2. RSS INGESTION
  console.log("[ingest-stories] Starting RSS ingestion...");
  const rssFeeds = [
    // Weird News & Paranormal (all verified working)
    "https://www.coasttocoastam.com/rss/weird-news/",
    "https://www.mirror.co.uk/news/weird-news/rss.xml",
    "https://www.thesun.co.uk/topic/weird-news/feed/",
    "https://www.express.co.uk/posts/rss/80/weird",
    "https://www.dailystar.co.uk/news/weird-news/rss",
    
    // Science & Space (UFO-adjacent)
    "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    "https://www.space.com/feeds/all",
    "https://www.livescience.com/feeds/all",
    "https://www.sciencedaily.com/rss/strange_offbeat.xml",
    "https://phys.org/rss-feed/space-news/",
    
    // UFO/UAP Specific (NEW)
    "https://openminds.tv/feed/",
    "https://www.latest-ufo-sightings.net/feed/atom",
    "https://www.theblackvault.com/casefiles/feed/",
    "https://www.earthfiles.com/feed/",
    "https://feeds.feedburner.com/TheUFOChronicles",
    
    // True Crime & Mysteries
    "https://www.cbsnews.com/latest/rss/48-hours",
    "https://feeds.megaphone.fm/casefile",
    "https://rss.art19.com/crime-junkie",
    "https://defrostingcoldcases.com/feed/",
    "https://truecrimesocietyblog.com/feed/",
    "https://forensicfilesnow.com/index.php/feed/",
    "https://www.oddmurdersandmysteries.com/feed/",
    "https://www.truecasefiles.com/feeds/posts/default?alt=rss",
    
    // Unexplained & Fortean
    "https://mysteriousuniverse.org/feed/",
    "https://www.phantomsandmonsters.com/feeds/posts/default?alt=rss",
    "https://www.thefortean.com/feed/",
    "https://www.ancient-origins.net/rss.xml",
    "https://www.ancient-code.com/feed/",
    
    // Cryptozoology & Strange Creatures
    "https://cryptomundo.com/feed/",
    "https://www.strangeanimals.info/feeds/posts/default?alt=rss",
    "https://sasquatchchronicles.com/feed/",
    "https://sharonahill.com/feed/",
    "http://kevinrandle.blogspot.com/feeds/posts/default",
    "https://www.bfro.net/gdb/rss.asp",
    
    // Ghost Stories & Hauntings
    "https://ghostvillage.com/feed/",
    "https://thedeadhistory.com/feed/",
    "https://www.theparacast.com/feed/",
    "https://jimharold.com/feed/",
    
    // UFO Podcasts & Blogs
    "https://www.ufosightingsdaily.com/feeds/posts/default?alt=rss",
    "https://www.ufo-blogger.com/feeds/posts/default?alt=rss",
    "https://podcast.earthfiles.com/feed/",
    
    // More True Crime
    "https://www.trailwentcold.com/feed/",
    "https://coldcasecanada.podbean.com/feed.xml",
    
    // More Weird News
    "https://weekinweird.com/feed/",
    "https://www.npr.org/rss/rss.php?id=1008",
    "https://tetzoo.com/podcast?format=rss",
    
    // General Weird/Offbeat
    "https://www.atlasobscura.com/feeds/latest",
    "https://boingboing.net/feed",
    "https://www.odditycentral.com/feed",
    "https://www.mentalfloss.com/feed",
  ];

  for (const feedUrl of rssFeeds) {
    try {
      const response = await fetch(feedUrl, {
        headers: {
          "User-Agent": "CreatorSignals/1.0 (RSS Reader)",
        },
      });

      if (!response.ok) {
        console.error(`[ingest-stories] RSS fetch failed for ${feedUrl}: ${response.status}`);
        continue;
      }

      const xml = await response.text();
      const items = parseRSSItems(xml);
      const sourceName = getDomain(feedUrl);

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

      console.log(`[ingest-stories] RSS ${sourceName}: processed ${items.length} items`);
    } catch (err) {
      console.error(`[ingest-stories] RSS error for ${feedUrl}:`, err);
    }
  }

  // 3. NUFORC INGESTION
  console.log("[ingest-stories] Starting NUFORC ingestion...");
  try {
    // Get current month's page
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const nuforcUrl = `https://nuforc.org/webreports/ndxe${yearMonth}.html`;

    const response = await fetch(nuforcUrl, {
      headers: {
        "User-Agent": "CreatorSignals/1.0 (NUFORC Reader)",
      },
    });

    if (response.ok) {
      const html = await response.text();
      const reports = parseNUFORCTable(html);

      for (const report of reports) {
        const externalId = await sha256(report.reportUrl);
        
        // Parse date from "MM/DD/YY HH:MM" format
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
        } catch {
          // Ignore date parsing errors
        }

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

      console.log(`[ingest-stories] NUFORC: processed ${reports.length} reports`);
    } else {
      console.error(`[ingest-stories] NUFORC fetch failed: ${response.status}`);
    }
  } catch (err) {
    console.error(`[ingest-stories] NUFORC error:`, err);
  }

  const totalInserted = redditCount + rssCount + nuforcCount;
  console.log(`[ingest-stories] Complete. Reddit: ${redditCount}, RSS: ${rssCount}, NUFORC: ${nuforcCount}, Total: ${totalInserted}`);

  return new Response(
    JSON.stringify({
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
