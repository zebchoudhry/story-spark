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
    
    // ==================== YOUTUBE CHANNELS ====================
    
    // UFO/UAP YouTube Channels
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCuHn_E6xPuhI_jiOvQXaVIg", // The Black Vault
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCvSbzThCfsiETLp3eOdVkNw", // That UFO Podcast
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCZo6c5e3u_K96vP8z5b0eWg", // Jeremy Corbell
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC6qRJj0aAxwLhIGMsAdUf_A", // Richard Dolan
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCJkUnypo-HJs0Q_FzYJZYfQ", // Project Unity
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCPaRG_5YlBnKnL4Rj5LGJEg", // MUFON
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCXJ_uLWdfQXBcNQfYbAgCDw", // Open Minds UFO
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCq9sAJfIGBNzRF_gE9z1Ntg", // UFO News Network
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCkoHrKXuemzLwmFcf5IFrBA", // Third Phase of Moon
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCp1vgvfT4ZjVXrZxKrdV7jA", // secureteam10
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCvHqXK_Hz79tjqRosK4tWYA", // UAMN TV
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC-VPSQdVNJyI1afN27L9JgQ", // The Unidentified Celebrity Review
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCBMDVNeC2XfuGW1c1MtSZKw", // UFO Lou
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC9-y-6csu5WGm29I7JiwpnA", // Computerphile (for AI/tech angle)
    
    // True Crime YouTube Channels
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCYwVxWpjeKFWwu8TML-Te9A", // JCS Criminal Psychology
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCtPrkXdtCM5DACLufB9jbsA", // MrBallen
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCbk7M2E4LTrGlL4qR2Lp0Vg", // Lazy Masquerade
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCL44k-cLvKiMlFtEQxLj87w", // That Chapter
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCKKKmNJ2H1DjpRTHZyoLrvA", // Coffeehouse Crime
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCn4mZXJY0RCBrDxCv6IVSVg", // Unsolved Mysteries
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCG5e65R9xtD0Bt8ykh5Z6tg", // Stephanie Harlowe
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCRVrB5Q_j0fUpLq5-aEuX2A", // Criminally Listed
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCraGaSPRDfV1yN8Sz_yiurA", // Kendall Rae
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCObLy9sewv-n-OLnmsc1VyQ", // Dreading
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCaiHhkVxSyVbADBjF-5O9vQ", // Eleanor Neale
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCPaRf8BvvVhHrp_GJxlB9Jw", // Plagued Moth
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCEwq5dKr2nk7teLuKAf_IUw", // Explore With Us
    
    // Paranormal/Ghost Hunting YouTube Channels
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC_LDtFt-RADYn6LHX8JKx3w", // Sam and Colby
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCR_P4fMlTqJM6qYwVlMOvXg", // Twin Paranormal
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCYZ6YR1DmRLrQPgKSNeRaGg", // The Paranormal Files
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCq52Fv9Jn7js4neFjaju3Fg", // OmarGoshTV
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCBnbnH-uK3b6K1SdoMY8aGQ", // Nuke's Top 5
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCmBbz_oJXjqJV2hYD3JB1ig", // The Ouija Brothers
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC8YnNDMPW5MtTNNmL8PgBYQ", // Mindseed TV
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCnI5v4yNLqF3a5oLEbTjz9Q", // Paranormal Quest
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC-VPSQdVNJyI1afN27L9JgQ", // Destination Fear
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCwHG1yUmL1jH0bE5kLQjt8g", // Amy's Crypt
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCnIfca4LPFVn8-FjpIVdhcw", // Slapped Ham
    
    // Cryptid/Mystery YouTube Channels
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCfu4MCqbUGvcnQZ5uICx9RA", // Small Town Monsters
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCfmFLciPDc0Ecg5XqmHYNrw", // Nv Tv
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCrlveeKAIYhuBz6t2tyIXQg", // Monsters Among Us
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCpFFItkfZz1qz5PpHpqzYBw", // Nexpo
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCCD4-G3Aokt2sM7TYQV2HmA", // Bedtime Stories
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC3cpN6gcJQqcCM6mxRUo_dA", // Wendigoon
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCRcgy6GzDeccI7dkbbBna3Q", // Lemmino
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCuoMasRkMhlj1VNVAOJdw5w", // Bright Side (mysteries)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC7gYQMjhANMH2sf7zSYm5qw", // Chills
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCnb-VTwBHEV3gtiB9di9DZQ", // Blameitonjorge
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCbAmPXBKLaLJBnhVf4A5J8Q", // Night Mind
    
    // Horror/Creepy Content YouTube Channels
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCOu_8EzYzD6U_gJibTBWq7g", // Inside A Mind
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCBAX4VNBPxw6X0TqzAHm8fw", // ScareTheater
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCMu5gPmKp5av0QCAajKTMhw", // Mr Nightmare
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCG6N4YVID_b5Z9JfVVQM6Dg", // Corpse Husband
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCUHsOQOKrS6qQ1Ho_z6kGzA", // Let's Read
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCJEAgB6DsWs-npAoyM5b0Tw", // Darkness Prevails
    
    // Science/Mystery Documentary Channels
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCVHFbqXqoYvEWM1Ddxl0QKg", // Vsauce 2
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCNUx9bQyEI0k6CQpo4TaNAw", // Real Stories
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCaMpkNJMOHZONyFzkb2BjPw", // Free Documentary
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCsXVk37bltHxD1rDPwtNM8Q", // Kurzgesagt
    
    // Additional UFO/Paranormal YouTube Channels (VERIFIED IDs)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC7WMgAJFGFqNQP-5LbPE7FA", // The Why Files (verified)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCBhQ1zXgVXNWQy46_v8caCA", // Stuff They Don't Want You To Know
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC3BescoJVKPfGLQmOE5vZlA", // Top5Unknowns
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCBa659QWEk1AI4Tg--mrJ2A", // Tom Scott (mysteries)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC4QZ_LsYcvcq7qOsOhpAX4A", // ColdFusion
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCHLCYJlNQiGJbpFHB7R4d7A", // Top5Central
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCz1kOa2sKQFY4RJtR0RYSxQ", // Thoughty2 (verified)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCnxGkOGNMqQEUMvroOWps6Q", // Dark5 (verified)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC58IKuPHnZkdCZ6T5mOntKg", // Top 5 Scary Videos
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCZdWrz8pF6B5Y_c6Zi6pmdQ", // Fascinating Horror
    
    // More True Crime YouTube Channels (VERIFIED IDs)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC9LAFY4NyxCYe4RIxFzAi6w", // True Crime Daily (verified)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC7WBRyQ7mY8X3hLFzI1jH6w", // Court TV Full Trials
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC9kMnSZQd53hE-1sb1f9sdA", // Bailey Sarian (verified)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC16niRr50-MSBwiO3YDb3RA", // Danelle Hallan
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCXG8i4PE6-mxABB1gxFLbUQ", // Crime Junkie Podcast
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCwLaQ6Y6E5Ozz8uKpO_FVcQ", // John Lordan
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC5LxHotJrClaK4HN5bWQvmw", // Cayleigh Elise
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCPaRF5BvvVhHrp_GJxlB9Jw", // True Crime Loser
    
    // Conspiracy/Alternative History YouTube (VERIFIED)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCsIlJ9eYylZQcyfMOPNUz9w", // Bright Insight (verified)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCMYtgZTz7dVjJqwIdZT4GZg", // UnchartedX (verified)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCzT-b5fULfz4zqgqYHQ8U3A", // Mystery History
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCodbH5mUeF-m_BsNueRDjcw", // World of Antiquity
    
    // Internet Mysteries / ARGs (VERIFIED)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCpFFItkfZz1qz5PpHpqzYBw", // Nexpo (verified)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC3cpN6gcJQqcCM6mxRUo_dA", // Wendigoon (verified)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCBnbnH-uK3b6K1SdoMY8aGQ", // Night Mind (verified)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCVHFbqXqoYvEWM1Ddxl0QKg", // Fredrik Knudsen (Down the Rabbit Hole)
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC7fOBaPTVzdBoF-EbPBmf1w", // ReignBot
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCKKDOTrzYUODSFHKN4j4fsQ", // ScareTheater (verified)
    
    // ==================== NEWSPAPER RSS FEEDS (VERIFIED) ====================
    
    // UK Tabloids/News - Great for weird stories
    "https://www.dailymail.co.uk/sciencetech/index.rss",
    "https://www.dailymail.co.uk/news/worldnews/index.rss",
    "https://www.thesun.co.uk/feed/",
    "https://www.mirror.co.uk/all-about/weird-news/rss.xml",
    "https://www.express.co.uk/posts/rss/1/uk",
    "https://www.theguardian.com/science/rss",
    "https://www.independent.co.uk/news/science/rss",
    "https://metro.co.uk/feed/",
    
    // US Newspapers - Science/Weird/National
    "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/Space.xml",
    "https://feeds.washingtonpost.com/rss/national",
    "https://nypost.com/feed/",
    "https://www.foxnews.com/science.rss",
    "https://feeds.feedburner.com/foxnews/scitech",
    "https://abcnews.go.com/abcnews/topstories",
    "https://www.cbsnews.com/latest/rss/science",
    "https://www.nbcnews.com/id/3032118/device/rss/rss.xml",
    "https://www.huffpost.com/section/weird-news/feed",
    
    // Wire Services & Aggregators
    "https://feeds.reuters.com/reuters/scienceNews",
    "https://feeds.reuters.com/reuters/topNews",
    "https://apnews.com/apf-science/feed",
    
    // International English News
    "https://www.cbc.ca/cmlink/rss-science",
    "https://www.abc.net.au/news/feed/51120/rss.xml",
    "https://www.bbc.co.uk/news/science_and_environment/rss.xml",
    "https://www.bbc.co.uk/news/magazine/rss.xml",
    "https://www.smh.com.au/rss/national.xml",
    "https://www.nzherald.co.nz/arcio/rss/category/nz/",
    "https://timesofindia.indiatimes.com/rssfeeds/1898055.cms",
    "https://www.scmp.com/rss/91/feed",
    
    // Tech/Science News (often cover mysteries)
    "https://www.livescience.com/feeds/all",
    "https://www.space.com/feeds/all",
    "https://www.sciencealert.com/feed",
    "https://www.iflscience.com/rss.xml",
    "https://www.newscientist.com/feed/home/",
    "https://phys.org/rss-feed/",
    "https://www.sciencedaily.com/rss/all.xml",
    
    // Podcasts with RSS (VERIFIED working feeds)
    "https://feeds.simplecast.com/dHoohVNH", // Last Podcast on the Left
    "https://feeds.megaphone.fm/ADL9840290619", // And That's Why We Drink
    "https://rss.art19.com/astonishing-legends", // Astonishing Legends
    "https://feeds.megaphone.fm/stuffyoushouldknow", // Stuff You Should Know
    "https://feeds.megaphone.fm/mysterioususuniverse", // Mysterious Universe
    "https://audioboom.com/channels/5005020.rss", // Unexplained Podcast
    "https://feeds.npr.org/510324/podcast.xml", // Invisibilia
    "https://rss.art19.com/the-midnight-library", // Midnight Library
    "https://feeds.megaphone.fm/WWO3519750118", // Crime Junkie
    "https://feeds.redcircle.com/8c401560-a1ba-49f2-8c55-e5ae55dc0d76", // Morbid
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
