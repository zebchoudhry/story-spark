import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const BATCH_SIZE = 10; // Process 10 stories per run to avoid timeouts

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[process-stories-batch] Starting batch processing...");

  // Verify secret
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("INGEST_SECRET");

  if (!cronSecret || cronSecret !== expectedSecret) {
    console.error("[process-stories-batch] Unauthorized");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("[process-stories-batch] LOVABLE_API_KEY not configured");
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch unprocessed stories
  const { data: rawStories, error: fetchError } = await supabase
    .from("stories_raw")
    .select("*")
    .eq("processed", false)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error("[process-stories-batch] Fetch error:", fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!rawStories || rawStories.length === 0) {
    console.log("[process-stories-batch] No unprocessed stories found");
    return new Response(JSON.stringify({ processed: 0, status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[process-stories-batch] Found ${rawStories.length} stories to process`);

  let processedCount = 0;
  let errorCount = 0;

  for (const story of rawStories) {
    try {
      console.log(`[process-stories-batch] Processing: ${story.title?.substring(0, 50)}...`);

      // Call AI to process the story
      const systemPrompt = `You are an AI assistant that analyzes stories for mystery/paranormal/true-crime content creators. Analyze the input and extract structured data.

Return ONLY valid JSON with these exact keys:
- summary_short: One sentence summary, max 200 characters
- summary_long: 3-5 sentence factual summary of the story
- why_interesting: 2-3 sentences explaining why creators would want to cover this
- category: One of: ufo, paranormal, true_crime, cryptid, conspiracy, unresolved, weird_news
- credibility: One of: low, medium, high (based on source reliability and verifiability)
- trend_score: One of: hot, warm, cold (based on recency and viral potential)

Category definitions:
- ufo: UFO sightings, UAP, alien encounters, government disclosure
- paranormal: Ghosts, hauntings, spirits, supernatural events
- true_crime: Murder, cold cases, criminal psychology, investigations
- cryptid: Bigfoot, cryptozoology, mysterious creatures, lake monsters
- conspiracy: Alternative history, ancient civilizations, cover-ups, secret societies
- unresolved: Unsolved mysteries, disappearances, internet mysteries
- weird_news: Bizarre news, odd events, strange discoveries

No additional text, markdown, or explanation. Just the JSON object.`;

      const userPrompt = `Analyze this story:

Title: ${story.title || "Untitled"}
Source: ${story.source_name} (${story.source_type})
Published: ${story.published_at || "Unknown"}

Content:
${story.body || story.title || "No content available"}`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          console.error("[process-stories-batch] Rate limited, stopping batch");
          break;
        }
        if (aiResponse.status === 402) {
          console.error("[process-stories-batch] AI credits exhausted, stopping batch");
          break;
        }
        const errorText = await aiResponse.text();
        console.error(`[process-stories-batch] AI error for ${story.id}:`, errorText);
        errorCount++;
        continue;
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content;

      if (!content) {
        console.error(`[process-stories-batch] No AI content for ${story.id}`);
        errorCount++;
        continue;
      }

      // Parse the JSON response
      let storyCard;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          storyCard = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found");
        }
      } catch (parseError) {
        console.error(`[process-stories-batch] JSON parse error for ${story.id}:`, parseError);
        errorCount++;
        continue;
      }

      // Validate and normalize
      const validCategories = ["ufo", "paranormal", "true_crime", "cryptid", "conspiracy", "unresolved", "weird_news"];
      const validCredibility = ["low", "medium", "high"];
      const validTrendScore = ["hot", "warm", "cold"];

      const category = validCategories.includes(storyCard.category) ? storyCard.category : "weird_news";
      const credibility = validCredibility.includes(storyCard.credibility) ? storyCard.credibility : "medium";
      const trendScore = validTrendScore.includes(storyCard.trend_score) ? storyCard.trend_score : "warm";

      // Insert into story_cards
      const { error: insertError } = await supabase.from("story_cards").insert({
        raw_story_id: story.id,
        title: story.title,
        summary_short: storyCard.summary_short || story.title,
        summary_long: storyCard.summary_long,
        why_interesting: storyCard.why_interesting,
        category,
        credibility,
        trend_score: trendScore,
        source_name: story.source_name,
        source_link: story.url,
        published_at: story.published_at,
      });

      if (insertError) {
        console.error(`[process-stories-batch] Insert error for ${story.id}:`, insertError);
        errorCount++;
        continue;
      }

      // Mark raw story as processed
      const { error: updateError } = await supabase
        .from("stories_raw")
        .update({ processed: true })
        .eq("id", story.id);

      if (updateError) {
        console.error(`[process-stories-batch] Update error for ${story.id}:`, updateError);
      }

      processedCount++;
      console.log(`[process-stories-batch] Successfully processed: ${story.id}`);

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));

    } catch (err) {
      console.error(`[process-stories-batch] Error processing ${story.id}:`, err);
      errorCount++;
    }
  }

  console.log(`[process-stories-batch] Complete. Processed: ${processedCount}, Errors: ${errorCount}`);

  return new Response(
    JSON.stringify({
      processed: processedCount,
      errors: errorCount,
      remaining: rawStories.length - processedCount - errorCount,
      status: "ok",
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
