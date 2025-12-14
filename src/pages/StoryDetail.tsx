import { useState } from "react";
import { useParams, Link } from "react-router-dom";
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

// Mock story data
const mockStory = {
  id: "1",
  title: "Massive UFO Sighting Over Phoenix Captured by Multiple Witnesses",
  summaryShort: "Dozens of residents in the Phoenix metropolitan area reported seeing a massive triangular object hovering silently in the night sky for over 30 minutes.",
  summaryLong: "On the evening of March 13th, dozens of residents across the Phoenix metropolitan area reported witnessing an extraordinary aerial phenomenon. Multiple independent witnesses described a massive triangular object, estimated to be over a mile wide, hovering silently in the night sky. The object was observed for approximately 30 minutes before slowly moving north and disappearing over the horizon. Unlike conventional aircraft, the object made no sound and displayed unusual lighting patterns along its edges. Several witnesses captured video footage on their phones, which has since been analyzed by independent researchers. Local authorities have not issued an official statement, and the FAA reported no unusual aircraft in the area during the time of the sightings.",
  whyInteresting: "This sighting is particularly compelling because of the sheer number of independent witnesses, the extended duration of the observation, and the multiple pieces of video evidence. The similarities to the famous 1997 Phoenix Lights incident make this especially noteworthy for content creators covering UFO phenomena.",
  category: "ufo" as const,
  trendScore: "hot" as const,
  credibility: "high" as const,
  sourceName: "r/UFOs",
  sourceLink: "https://reddit.com/r/UFOs",
  publishedAt: "2 hours ago",
};

const StoryDetail = () => {
  const { id } = useParams();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePack = () => {
    setIsGenerating(true);
    // Simulate generation - in real app this would call the API
    setTimeout(() => {
      window.location.href = `/app/story/${id}/pack`;
    }, 2000);
  };

  const categoryLabels = {
    ufo: "UFO",
    paranormal: "Paranormal",
    unresolved: "Unresolved",
    weird: "Weird News",
  };

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
            <Badge variant={mockStory.category}>{categoryLabels[mockStory.category]}</Badge>
            <Badge variant={mockStory.trendScore}>
              <TrendingUp className="h-3 w-3 mr-1" />
              {mockStory.trendScore.toUpperCase()}
            </Badge>
            <Badge variant="outline">
              <Shield className="h-3 w-3 mr-1" />
              {mockStory.credibility.charAt(0).toUpperCase() + mockStory.credibility.slice(1)} Credibility
            </Badge>
          </div>
          
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">
            {mockStory.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <a 
              href={mockStory.sourceLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              {mockStory.sourceName}
            </a>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {mockStory.publishedAt}
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
                {mockStory.summaryLong}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                Why This Story is Interesting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {mockStory.whyInteresting}
              </p>
            </CardContent>
          </Card>
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
