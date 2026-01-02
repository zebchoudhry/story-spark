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
    const { title, body, sourceType, sourceName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing story:", title);

    const systemPrompt = `You are an AI assistant that cleans and structures stories for mystery/paranormal/true-crime creators. For the input text, extract:

- summary_short (1 sentence, max 200 characters)
- summary_long (3-5 sentence factual summary)
- why_interesting (explain why creators may want to cover this, 2-3 sentences)
- category (one of: ufo, paranormal, true_crime, cryptid, conspiracy, unresolved, weird_news)
- credibility (one of: low, medium, high - based on source reliability and claims)

Category definitions:
- ufo: UFO sightings, UAP, alien encounters, government disclosure
- paranormal: Ghosts, hauntings, spirits, supernatural events
- true_crime: Murder, cold cases, criminal psychology, investigations
- cryptid: Bigfoot, cryptozoology, mysterious creatures, lake monsters
- conspiracy: Alternative history, ancient civilizations, cover-ups, secret societies
- unresolved: Unsolved mysteries, disappearances, internet mysteries
- weird_news: Bizarre news, odd events, strange discoveries

Return ONLY valid JSON with these exact keys. No additional text or markdown.`;

    const userPrompt = `Process this story:

Title: ${title}
Source: ${sourceName} (${sourceType})

Content:
${body}`;

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

    // Parse the JSON response
    let storyCard;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        storyCard = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      throw new Error("Failed to process story");
    }

    // Validate and normalize the response
    const validCategories = ["ufo", "paranormal", "true_crime", "cryptid", "conspiracy", "unresolved", "weird_news"];
    const validCredibility = ["low", "medium", "high"];
    
    if (!validCategories.includes(storyCard.category)) {
      storyCard.category = "weird_news";
    }
    if (!validCredibility.includes(storyCard.credibility)) {
      storyCard.credibility = "medium";
    }

    console.log("Story processed successfully:", storyCard.category);

    return new Response(JSON.stringify(storyCard), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing story:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
