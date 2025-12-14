import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, ExternalLink, Clock, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export interface StoryCardData {
  id: string;
  title: string;
  summaryShort: string;
  category: "ufo" | "paranormal" | "unresolved" | "weird_news";
  trendScore: "hot" | "warm" | "cold";
  credibility: "low" | "medium" | "high";
  sourceName: string;
  publishedAt: string;
}

interface StoryCardProps {
  story: StoryCardData;
}

const categoryLabels = {
  ufo: "UFO",
  paranormal: "Paranormal",
  unresolved: "Unresolved",
  weird_news: "Weird News",
};

const trendLabels = {
  hot: "HOT",
  warm: "WARM",
  cold: "COLD",
};

const credibilityLabels = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const StoryCard = ({ story }: StoryCardProps) => {
  return (
    <Link to={`/app/story/${story.id}`}>
      <Card variant="story" className="h-full cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={story.category === "weird_news" ? "weird" : story.category}>{categoryLabels[story.category]}</Badge>
            <Badge variant={story.trendScore}>
              <TrendingUp className="h-3 w-3 mr-1" />
              {trendLabels[story.trendScore]}
            </Badge>
          </div>
          <CardTitle className="line-clamp-2 hover:text-primary transition-colors">
            {story.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
            {story.summaryShort}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                {story.sourceName}
              </span>
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {credibilityLabels[story.credibility]}
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {story.publishedAt}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
