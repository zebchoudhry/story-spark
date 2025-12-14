import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StoryCard, StoryCardData } from "@/components/StoryCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Filter, TrendingUp, Zap, Ghost, HelpCircle, Newspaper } from "lucide-react";

// Mock data for demonstration
const mockStories: StoryCardData[] = [
  {
    id: "1",
    title: "Massive UFO Sighting Over Phoenix Captured by Multiple Witnesses",
    summaryShort: "Dozens of residents in the Phoenix metropolitan area reported seeing a massive triangular object hovering silently in the night sky for over 30 minutes.",
    category: "ufo",
    trendScore: "hot",
    credibility: "high",
    sourceName: "r/UFOs",
    publishedAt: "2h ago",
  },
  {
    id: "2",
    title: "Abandoned Hospital Night Watchman Reports Unexplained Phenomena",
    summaryShort: "A former security guard at Waverly Hills Sanatorium comes forward with decades of paranormal encounters during his night shifts.",
    category: "paranormal",
    trendScore: "warm",
    credibility: "medium",
    sourceName: "r/Paranormal",
    publishedAt: "5h ago",
  },
  {
    id: "3",
    title: "Cold Case: Missing Hiker's Camera Found 15 Years Later With Disturbing Images",
    summaryShort: "A trail maintenance crew discovered camera equipment belonging to a hiker who vanished in 2009. The final photos raise more questions than answers.",
    category: "unresolved",
    trendScore: "hot",
    credibility: "high",
    sourceName: "r/UnresolvedMysteries",
    publishedAt: "8h ago",
  },
  {
    id: "4",
    title: "Florida Man Claims Pet Alligator Can Predict Lottery Numbers",
    summaryShort: "A Sarasota resident insists his 12-foot alligator 'Gatorade' has accurately predicted three lottery winning numbers this year alone.",
    category: "weird",
    trendScore: "cold",
    credibility: "low",
    sourceName: "WeirdNews RSS",
    publishedAt: "12h ago",
  },
  {
    id: "5",
    title: "New NUFORC Report: Pilot Describes Close Encounter at 35,000 Feet",
    summaryShort: "A commercial airline pilot filed a detailed report of a luminous spherical object that paced their aircraft for several minutes over the Atlantic.",
    category: "ufo",
    trendScore: "hot",
    credibility: "high",
    sourceName: "NUFORC",
    publishedAt: "1d ago",
  },
  {
    id: "6",
    title: "Victorian-Era Murder Case Solved Using Modern DNA Technology",
    summaryShort: "A 130-year-old murder mystery from London's East End has finally been solved thanks to genealogical DNA testing and dedicated amateur historians.",
    category: "unresolved",
    trendScore: "warm",
    credibility: "high",
    sourceName: "r/UnresolvedMysteries",
    publishedAt: "1d ago",
  },
];

const categories = [
  { id: "all", label: "All", icon: Zap },
  { id: "ufo", label: "UFO", icon: TrendingUp },
  { id: "paranormal", label: "Paranormal", icon: Ghost },
  { id: "unresolved", label: "Unresolved", icon: HelpCircle },
  { id: "weird", label: "Weird News", icon: Newspaper },
];

const trendFilters = [
  { id: "all", label: "All Trends" },
  { id: "hot", label: "HOT" },
  { id: "warm", label: "WARM" },
  { id: "cold", label: "COLD" },
];

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTrend, setSelectedTrend] = useState("all");

  const filteredStories = mockStories.filter((story) => {
    const matchesSearch = story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      story.summaryShort.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || story.category === selectedCategory;
    const matchesTrend = selectedTrend === "all" || story.trendScore === selectedTrend;
    return matchesSearch && matchesCategory && matchesTrend;
  });

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold mb-2">Story Feed</h1>
        <p className="text-muted-foreground">
          Discover the latest mysteries and unexplained events
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {trendFilters.map((trend) => (
              <Button
                key={trend.id}
                variant={selectedTrend === trend.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTrend(trend.id)}
              >
                {trend.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "glow" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className="gap-2"
            >
              <cat.icon className="h-4 w-4" />
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Stories Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStories.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>

      {filteredStories.length === 0 && (
        <div className="text-center py-16">
          <Ghost className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-xl font-semibold mb-2">No stories found</h3>
          <p className="text-muted-foreground">
            Try adjusting your filters or search query
          </p>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Dashboard;
