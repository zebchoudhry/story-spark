import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowLeft, 
  Copy, 
  Check,
  Youtube,
  Video,
  Lightbulb,
  Image,
  Hash,
  Loader2,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ContentPackData {
  youtube_script: string;
  shorts_script: string;
  hooks: string[];
  thumbnail_texts: string[];
  hashtags: string[];
}

const ContentPack = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [contentPack, setContentPack] = useState<ContentPackData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storyTitle, setStoryTitle] = useState("");

  useEffect(() => {
    if (id) {
      generateContentPack();
    }
  }, [id]);

  const generateContentPack = async () => {
    setIsLoading(true);
    try {
      // First, fetch the story details
      const { data: story, error: storyError } = await supabase
        .from("story_cards")
        .select("title, summary_short, summary_long")
        .eq("id", id)
        .maybeSingle();

      if (storyError) throw storyError;

      if (!story) {
        toast({
          title: "Story not found",
          description: "This story may have been removed.",
          variant: "destructive",
        });
        navigate("/app");
        return;
      }

      setStoryTitle(story.title);

      // Check if we already have a content pack for this story and user
      const { data: existingPack, error: packError } = await supabase
        .from("story_content_packs")
        .select("*")
        .eq("story_card_id", id)
        .eq("user_id", user?.id)
        .maybeSingle();

      if (existingPack) {
        // Parse existing content pack
        setContentPack({
          youtube_script: existingPack.youtube_script || "",
          shorts_script: existingPack.shorts_script || "",
          hooks: existingPack.hooks ? JSON.parse(existingPack.hooks) : [],
          thumbnail_texts: existingPack.thumbnail_texts ? JSON.parse(existingPack.thumbnail_texts) : [],
          hashtags: existingPack.hashtags ? JSON.parse(existingPack.hashtags) : [],
        });
        setIsLoading(false);
        return;
      }

      // Generate new content pack using AI
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke("generate-content-pack", {
        body: {
          storyTitle: story.title,
          storySummary: story.summary_long || story.summary_short,
        },
      });

      if (aiError) {
        throw new Error(aiError.message || "Failed to generate content pack");
      }

      // Parse the AI response
      const pack: ContentPackData = {
        youtube_script: aiResponse.youtube_script || "",
        shorts_script: aiResponse.shorts_script || "",
        hooks: Array.isArray(aiResponse.hooks) ? aiResponse.hooks : [],
        thumbnail_texts: Array.isArray(aiResponse.thumbnail_texts) ? aiResponse.thumbnail_texts : [],
        hashtags: Array.isArray(aiResponse.hashtags) ? aiResponse.hashtags : [],
      };

      // Save to database
      await supabase.from("story_content_packs").insert({
        story_card_id: id,
        user_id: user?.id,
        youtube_script: pack.youtube_script,
        shorts_script: pack.shorts_script,
        hooks: JSON.stringify(pack.hooks),
        thumbnail_texts: JSON.stringify(pack.thumbnail_texts),
        hashtags: JSON.stringify(pack.hashtags),
      });

      setContentPack(pack);
      toast({
        title: "Content pack generated!",
        description: "Your AI-powered content is ready.",
      });
    } catch (error: any) {
      console.error("Error generating content pack:", error);
      
      // Handle specific error cases
      if (error.message?.includes("Rate limit")) {
        toast({
          title: "Rate limit exceeded",
          description: "Please wait a moment and try again.",
          variant: "destructive",
        });
      } else if (error.message?.includes("Payment required") || error.message?.includes("credits")) {
        toast({
          title: "AI credits exhausted",
          description: "Please add credits to continue generating content.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Generation failed",
          description: "Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    toast({
      title: "Copied!",
      description: `${section} copied to clipboard`,
    });
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const CopyButton = ({ text, section }: { text: string; section: string }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => copyToClipboard(text, section)}
      className="shrink-0"
    >
      {copiedSection === section ? (
        <Check className="h-4 w-4 text-emerald-400" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="text-center">
            <h3 className="font-display text-xl font-semibold mb-2">Generating Content Pack</h3>
            <p className="text-muted-foreground">This may take a moment...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!contentPack) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <p className="text-muted-foreground">Failed to load content pack.</p>
          <Button onClick={generateContentPack}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Link to={`/app/story/${id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Story
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Content Pack
          </h1>
          <p className="text-muted-foreground">
            AI-generated content for: {storyTitle}
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          {/* YouTube Script */}
          {contentPack.youtube_script && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Youtube className="h-5 w-5 text-red-500" />
                  YouTube Script (5-8 min)
                </CardTitle>
                <CopyButton text={contentPack.youtube_script} section="YouTube Script" />
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans bg-secondary/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  {contentPack.youtube_script}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Shorts Script */}
          {contentPack.shorts_script && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Video className="h-5 w-5 text-pink-500" />
                  TikTok/Shorts Script (60 sec)
                </CardTitle>
                <CopyButton text={contentPack.shorts_script} section="Shorts Script" />
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans bg-secondary/50 rounded-lg p-4">
                  {contentPack.shorts_script}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Hooks */}
          {contentPack.hooks.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-400" />
                  Viral Hooks ({contentPack.hooks.length})
                </CardTitle>
                <CopyButton text={contentPack.hooks.join("\n")} section="Hooks" />
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {contentPack.hooks.map((hook, i) => (
                    <li 
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer group"
                      onClick={() => copyToClipboard(hook, `Hook ${i + 1}`)}
                    >
                      <span className="text-primary font-mono text-sm shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm">{hook}</span>
                      <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0" />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Thumbnail Texts */}
          {contentPack.thumbnail_texts.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Image className="h-5 w-5 text-emerald-400" />
                  Thumbnail Text Ideas
                </CardTitle>
                <CopyButton text={contentPack.thumbnail_texts.join("\n")} section="Thumbnail Texts" />
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {contentPack.thumbnail_texts.map((text, i) => (
                    <div
                      key={i}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 font-display font-bold text-sm cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => copyToClipboard(text, `Thumbnail ${i + 1}`)}
                    >
                      {text}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hashtags */}
          {contentPack.hashtags.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Hash className="h-5 w-5 text-blue-400" />
                  Suggested Hashtags
                </CardTitle>
                <CopyButton text={contentPack.hashtags.join(" ")} section="Hashtags" />
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {contentPack.hashtags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-secondary text-sm text-muted-foreground hover:bg-primary/20 hover:text-primary cursor-pointer transition-colors"
                      onClick={() => copyToClipboard(tag, tag)}
                    >
                      {tag.startsWith("#") ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ContentPack;
