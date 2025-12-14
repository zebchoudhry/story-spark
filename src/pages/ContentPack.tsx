import { useState } from "react";
import { useParams, Link } from "react-router-dom";
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
  Hash
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Mock content pack data
const mockContentPack = {
  youtubeScript: `[INTRO - 0:00]
(Mysterious music plays)

Hey everyone, welcome back to the channel. Today we're diving into one of the most compelling UFO sightings in recent memory - an event that had dozens of witnesses across Phoenix, Arizona, all reporting the same extraordinary phenomenon.

[THE SIGHTING - 0:45]
On the evening of March 13th, something appeared in the Arizona sky that would leave even the most skeptical observers questioning what they knew about our world. 

Multiple independent witnesses, from all walks of life, described seeing a massive triangular object - and when I say massive, I mean estimates put this thing at over a MILE wide. 

Now, here's where it gets interesting...

[THE EVIDENCE - 3:00]
Unlike your typical grainy UFO footage, this incident has something different going for it. Multiple witnesses captured video on their phones, and when researchers analyzed these videos, they found something remarkable...

[THE OFFICIAL RESPONSE - 5:30]
Perhaps the most intriguing aspect of this case is what DIDN'T happen. Local authorities stayed silent. The FAA claimed there were no unusual aircraft in the area. But if nothing was there, what did all these people see?

[CONCLUSION - 7:00]
So what do you think? A secret military craft? Something from beyond our world? Or a mass hallucination shared by dozens of unconnected witnesses? Let me know in the comments below.

If you found this video interesting, hit that like button and subscribe for more investigations into the unknown. Until next time, keep looking up.`,
  shortsScript: `POV: You're in Phoenix and the whole sky lights up

(Hook) "What would you do if you saw THIS hovering over your city?"

(Build) Last month, DOZENS of people across Phoenix saw the same thing - a MILE-WIDE triangle just... floating there. Silent. For 30 minutes.

(Twist) The craziest part? The FAA says there was NOTHING in the sky that night.

(CTA) Follow for more unexplained phenomena the mainstream won't cover.`,
  hooks: [
    "A mile-wide triangle hung over Phoenix for 30 minutes - and the government says nothing was there",
    "When dozens of strangers all see the same impossible thing, you have to ask questions",
    "The Phoenix Lights are back - and this time there's way more evidence",
    "I analyzed the footage. What I found made my blood run cold.",
    "The FAA's silence on this case tells you everything you need to know",
    "This isn't your grandfather's grainy UFO video - this is 2024",
    "30 minutes. A mile wide. Complete silence. Zero explanation.",
    "What happens when too many people see something they weren't supposed to see?",
    "The new Phoenix Lights: Why this sighting is different from all the rest",
    "Everyone in Phoenix saw it. Nobody wants to talk about it."
  ],
  thumbnailTexts: [
    "MILE-WIDE TRIANGLE",
    "THE NEW PHOENIX LIGHTS",
    "THEY'RE BACK",
    "FAA: \"NOTHING THERE\"",
    "30 MINUTES OF PROOF"
  ],
  hashtags: [
    "#ufo",
    "#ufosighting",
    "#phoenixlights",
    "#uap",
    "#aliens",
    "#paranormal",
    "#unexplained",
    "#mystery",
    "#conspiracy",
    "#disclosure",
    "#truecrime",
    "#documentary",
    "#arizona",
    "#phoenix",
    "#triangle"
  ]
};

const ContentPack = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

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
            AI-generated content ready for your platforms
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          {/* YouTube Script */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Youtube className="h-5 w-5 text-red-500" />
                YouTube Script (5-8 min)
              </CardTitle>
              <CopyButton text={mockContentPack.youtubeScript} section="YouTube Script" />
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans bg-secondary/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                {mockContentPack.youtubeScript}
              </pre>
            </CardContent>
          </Card>

          {/* Shorts Script */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="h-5 w-5 text-pink-500" />
                TikTok/Shorts Script (60 sec)
              </CardTitle>
              <CopyButton text={mockContentPack.shortsScript} section="Shorts Script" />
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans bg-secondary/50 rounded-lg p-4">
                {mockContentPack.shortsScript}
              </pre>
            </CardContent>
          </Card>

          {/* Hooks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-400" />
                Viral Hooks (10)
              </CardTitle>
              <CopyButton text={mockContentPack.hooks.join("\n")} section="Hooks" />
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {mockContentPack.hooks.map((hook, i) => (
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

          {/* Thumbnail Texts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Image className="h-5 w-5 text-emerald-400" />
                Thumbnail Text Ideas
              </CardTitle>
              <CopyButton text={mockContentPack.thumbnailTexts.join("\n")} section="Thumbnail Texts" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {mockContentPack.thumbnailTexts.map((text, i) => (
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

          {/* Hashtags */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Hash className="h-5 w-5 text-blue-400" />
                Suggested Hashtags
              </CardTitle>
              <CopyButton text={mockContentPack.hashtags.join(" ")} section="Hashtags" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {mockContentPack.hashtags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-secondary text-sm text-muted-foreground hover:bg-primary/20 hover:text-primary cursor-pointer transition-colors"
                    onClick={() => copyToClipboard(tag, tag)}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ContentPack;
