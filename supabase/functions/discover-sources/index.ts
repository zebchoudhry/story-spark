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
  const entryMatches = xml.match(/<entry[^>]*>[\s\S]*?<\/entry>/gi) || [];
  const allItems = [...itemMatches, ...entryMatches];

  for (const itemXml of allItems) {
    const title = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || "";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[discover-sources] Starting source discovery...");

  // Verify secret
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("INGEST_SECRET");

  if (!cronSecret || cronSecret !== expectedSecret) {
    console.error("[discover-sources] Unauthorized");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let candidatesChecked = 0;
  let validated = 0;
  let added = 0;
  let skippedDuplicates = 0;

  try {
    // Step 1 — Find candidate domains from story_cards
    console.log("[discover-sources] Step 1: Finding candidate domains...");
    const { data: topSources, error: topErr } = await supabase
      .rpc("", {})
      .maybeSingle();

    // Use raw query via postgres function workaround — just select from story_cards
    const { data: storyCardSources, error: scErr } = await supabase
      .from("story_cards")
      .select("source_name");

    if (scErr || !storyCardSources) {
      console.error("[discover-sources] Failed to query story_cards:", scErr);
      return new Response(JSON.stringify({ error: "Failed to query story_cards" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Count frequency of source_name
    const sourceFreq: Record<string, number> = {};
    for (const row of storyCardSources) {
      const name = row.source_name;
      sourceFreq[name] = (sourceFreq[name] || 0) + 1;
    }

    // Sort by frequency and take top 50
    const candidateDomains = Object.entries(sourceFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([domain]) => domain);

    console.log(`[discover-sources] Found ${candidateDomains.length} candidate domains`);

    // Step 2 — Build set of known URLs to skip
    console.log("[discover-sources] Step 2: Checking existing sources...");
    const { data: existingSources } = await supabase
      .from("sources")
      .select("source_url");

    const { data: existingDiscovered } = await supabase
      .from("discovered_sources")
      .select("source_url");

    const knownUrls = new Set<string>();
    for (const s of existingSources || []) knownUrls.add(s.source_url);
    for (const d of existingDiscovered || []) knownUrls.add(d.source_url);

    // Also extract domains from known sources for domain-level dedup
    const knownDomains = new Set<string>();
    for (const url of knownUrls) {
      knownDomains.add(getDomain(url));
    }

    console.log(`[discover-sources] Known URLs: ${knownUrls.size}, Known domains: ${knownDomains.size}`);

    // Step 3 — Probe each candidate domain for RSS feeds
    const feedPaths = ["/feed", "/rss", "/feed.xml", "/rss.xml", "/feed/"];

    for (const domain of candidateDomains) {
      // Skip domains already known
      if (knownDomains.has(domain)) {
        skippedDuplicates++;
        continue;
      }

      candidatesChecked++;
      let foundFeed = false;

      for (const path of feedPaths) {
        if (foundFeed) break;

        const candidateUrl = `https://${domain}${path}`;

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const res = await fetch(candidateUrl, {
            headers: { "User-Agent": "CreatorSignals/1.0 (Feed Discovery)" },
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!res.ok) {
            await res.text().catch(() => {}); // consume body
            continue;
          }

          const text = await res.text();

          // Check if it looks like RSS/Atom
          if (!text.includes("<rss") && !text.includes("<feed") && !text.includes("<channel")) {
            continue;
          }

          const items = parseRSSItems(text);
          if (items.length < 3) continue;

          // Extract feed title
          const feedTitle = text.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || null;

          // Get most recent item date
          let lastItemDate: string | null = null;
          for (const item of items) {
            if (item.pubDate) {
              try {
                const d = new Date(item.pubDate);
                if (!isNaN(d.getTime())) {
                  lastItemDate = d.toISOString();
                  break;
                }
              } catch { /* skip */ }
            }
          }

          // Step 4 — Get category/genre from existing story_cards for this domain
          const { data: domainStories } = await supabase
            .from("story_cards")
            .select("category")
            .eq("source_name", domain)
            .limit(100);

          let category = "weird_news";
          let genre = "paranormal";

          if (domainStories && domainStories.length > 0) {
            // Find most common category
            const catFreq: Record<string, number> = {};
            for (const s of domainStories) {
              catFreq[s.category] = (catFreq[s.category] || 0) + 1;
            }
            category = Object.entries(catFreq).sort((a, b) => b[1] - a[1])[0][0];
            genre = category; // use category as genre fallback
          }

          // Insert into discovered_sources
          const { error: discErr } = await supabase
            .from("discovered_sources")
            .insert({
              source_url: candidateUrl,
              source_type: "rss",
              genre,
              category,
              feed_title: feedTitle,
              item_count: items.length,
              last_item_date: lastItemDate,
              discovery_method: "competitor",
              added_to_sources: true,
            });

          if (discErr) {
            console.error(`[discover-sources] Insert discovered_sources error for ${candidateUrl}:`, discErr);
            continue;
          }

          // Insert into sources table
          const { error: srcErr } = await supabase
            .from("sources")
            .insert({
              source_type: "rss",
              source_url: candidateUrl,
              category,
              genre,
              client_id: null,
              active: true,
            });

          if (srcErr) {
            console.error(`[discover-sources] Insert sources error for ${candidateUrl}:`, srcErr);
            // Still count as validated even if sources insert fails
          } else {
            added++;
          }

          validated++;
          foundFeed = true;
          console.log(`[discover-sources] Discovered: ${candidateUrl} (${feedTitle || "no title"}) → ${category}`);

        } catch (err) {
          // Timeout or network error — try next path
          continue;
        }
      }
    }
  } catch (err) {
    console.error("[discover-sources] Fatal error:", err);
    return new Response(JSON.stringify({ error: "Internal error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = {
    candidates_checked: candidatesChecked,
    validated,
    added,
    skipped_duplicates: skippedDuplicates,
    status: "ok",
  };

  console.log("[discover-sources] Complete:", result);

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
