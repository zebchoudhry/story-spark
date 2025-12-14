import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowLeft, 
  ExternalLink, 
  Clock, 
  Shield, 
  TrendingUp, 
  Sparkles,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface StoryData {
  id: string;
  title: string;
  summary_short: string;
  summary_long: string | null;
  why_interesting: string | null;
  category: "ufo" | "paranormal" | "unresolved" | "weird_news";
  trend_score: "hot" | "warm" | "cold";
  credibility: "low" | "medium" | "high";
  source_name: string;
  source_link: string | null;
  published_at: string | null;
}

const categoryLabels: Record<string, string> = {
  ufo: "UFO",
  paranormal: "Paranormal",
  unresolved: "Unresolved",
  weird_news: "Weird News",
};

const StoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [story, setStory] = useState<StoryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (id) {
      fetchStory();
    }
  }, [id]);

  const fetchStory = async () => {
    try {
      const { data, error } = await supabase
        .from("story_cards")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          title: "Story not found",
          description: "This story may have been removed.",
          variant: "destructive",
        });
        navigate("/app");
        return;
      }

      setStory(data as StoryData);
    } catch (error) {
      console.error("Error fetching story:", error);
      toast({
        title: "Error loading story",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePack = () => {
    setIsGenerating(true);
    navigate(`/app/story/${id}/pack`);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!story) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Link to="/app" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Stories
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge variant={story.category === "weird_news" ? "weird" : story.category}>{categoryLabels[story.category]}</Badge>
            <Badge variant={story.trend_score}>
              <TrendingUp className="h-3 w-3 mr-1" />
              {story.trend_score.toUpperCase()}
            </Badge>
            <Badge variant="outline">
              <Shield className="h-3 w-3 mr-1" />
              {story.credibility.charAt(0).toUpperCase() + story.credibility.slice(1)} Credibility
            </Badge>
          </div>
          
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">
            {story.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {story.source_link ? (
              <a 
                href={story.source_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                {story.source_name}
              </a>
            ) : (
              <span className="flex items-center gap-1">
                <ExternalLink className="h-4 w-4" />
                {story.source_name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {story.published_at 
                ? formatDistanceToNow(new Date(story.published_at), { addSuffix: true })
                : "Recently"}
            </span>
          </div>
        </div>

        {/* Content Cards */}
        <div className="space-y-6">
          <Card variant="glow">
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {story.summary_long || story.summary_short}
              </p>
            </CardContent>
          </Card>

          {story.why_interesting && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  Why This Story is Interesting
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {story.why_interesting}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Generate CTA */}
        <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-card to-accent/10 border border-primary/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-xl font-semibold mb-1">
                Ready to Create Content?
              </h3>
              <p className="text-muted-foreground text-sm">
                Generate a complete content pack with scripts, hooks, and more
              </p>
            </div>
            <Button 
              variant="hero" 
              size="lg" 
              onClick={handleGeneratePack}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Content Pack
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StoryDetail;
