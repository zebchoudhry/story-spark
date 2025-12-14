import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storyTitle, storySummary } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating content pack for story:", storyTitle);

    const systemPrompt = `You are an expert content creator specializing in mystery, paranormal, and true-crime content. You generate comprehensive content packs for YouTube and TikTok creators.

For the given story, generate:
1. A full YouTube script (5-8 minutes reading time) with timestamps and sections
2. A TikTok/Shorts script (60 seconds) with hook, build, twist, and CTA
3. 10 viral hooks that would work for video openings
4. 5 thumbnail text ideas (short, punchy, all caps)
5. 15 relevant hashtags

Format your response EXACTLY as JSON with these keys:
{
  "youtube_script": "full script here...",
  "shorts_script": "short script here...",
  "hooks": ["hook1", "hook2", ...],
  "thumbnail_texts": ["TEXT1", "TEXT2", ...],
  "hashtags": ["#hashtag1", "#hashtag2", ...]
}`;

    const userPrompt = `Create a content pack for this mystery story:

Title: ${storyTitle}

Summary: ${storySummary}

Generate engaging, attention-grabbing content that will maximize views and engagement.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content generated");
    }

    // Try to parse the JSON from the response
    let contentPack;
    try {
      // Find JSON in the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        contentPack = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      // Return raw content if JSON parsing fails
      contentPack = {
        youtube_script: content,
        shorts_script: "",
        hooks: [],
        thumbnail_texts: [],
        hashtags: [],
      };
    }

    console.log("Content pack generated successfully");

    return new Response(JSON.stringify(contentPack), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating content pack:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
