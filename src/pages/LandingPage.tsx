import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Radio, Zap, TrendingUp, FileText, Mail, Shield } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            <span className="font-display font-bold text-xl">CreatorSignals</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link to="/register">
              <Button variant="hero">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-hero-pattern opacity-50" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[128px] animate-pulse-glow" />
        
        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8 animate-fade-in">
              <Zap className="h-4 w-4" />
              <span>AI-Powered Content Discovery</span>
            </div>
            
            <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 animate-slide-up">
              Discover the{" "}
              <span className="text-gradient">Unknown</span>
              <br />
              Create the{" "}
              <span className="text-gradient">Extraordinary</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: "0.1s" }}>
              Never run out of mystery stories again. CreatorSignals scans thousands of sources daily to bring you the best paranormal, true-crime, and unexplained content — complete with AI-generated scripts.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <Link to="/register">
                <Button variant="hero" size="xl">
                  Start Free Trial
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="xl">
                  View Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl font-bold mb-4">
              Everything You Need to Create
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From discovery to script — streamline your entire content creation workflow
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Radio className="h-6 w-6" />}
              title="Multi-Source Ingestion"
              description="Automatically scrape Reddit, NUFORC, RSS feeds, and more. New stories delivered daily."
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="AI-Powered Analysis"
              description="Every story is analyzed, categorized, and rated for credibility and trend potential."
            />
            <FeatureCard
              icon={<TrendingUp className="h-6 w-6" />}
              title="Trend Detection"
              description="Know which stories are heating up. Our algorithms detect viral potential before it peaks."
            />
            <FeatureCard
              icon={<FileText className="h-6 w-6" />}
              title="Complete Content Packs"
              description="Generate YouTube scripts, TikTok shorts, viral hooks, and thumbnail ideas in one click."
            />
            <FeatureCard
              icon={<Mail className="h-6 w-6" />}
              title="Daily Digest Emails"
              description="Wake up to the top 5 hottest stories delivered straight to your inbox every morning."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Credibility Scoring"
              description="Every story rated for source reliability so you know what to trust."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto px-6 relative">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground text-lg">
              Choose the plan that fits your content creation needs
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <PricingCard
              name="Basic"
              price="£19"
              description="Perfect for getting started"
              features={[
                "30 story cards per day",
                "5 content packs per month",
                "Daily email digest",
                "Basic filters & search",
              ]}
            />
            <PricingCard
              name="Pro"
              price="£49"
              description="For serious creators"
              features={[
                "Unlimited story cards",
                "Unlimited content packs",
                "Priority email digest",
                "Advanced filters & analytics",
                "API access",
                "Priority support",
              ]}
              featured
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20" />
            <div className="absolute inset-0 bg-hero-pattern opacity-30" />
            <div className="relative px-8 py-16 md:px-16 md:py-24 text-center">
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
                Ready to Unlock the Unknown?
              </h2>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Join thousands of mystery content creators who never run out of stories.
              </p>
              <Link to="/register">
                <Button variant="hero" size="xl">
                  Start Your Free Trial
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              <span className="font-display font-bold">CreatorSignals</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 CreatorSignals. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="group p-6 rounded-xl border border-border/50 bg-gradient-to-br from-card to-background hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1">
    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary/20 transition-colors">
      {icon}
    </div>
    <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground text-sm">{description}</p>
  </div>
);

const PricingCard = ({
  name,
  price,
  description,
  features,
  featured = false,
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  featured?: boolean;
}) => (
  <div
    className={`relative p-8 rounded-2xl border transition-all duration-300 ${
      featured
        ? "border-primary/50 bg-gradient-to-b from-primary/10 to-transparent shadow-lg shadow-primary/10"
        : "border-border bg-card"
    }`}
  >
    {featured && (
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
        Most Popular
      </div>
    )}
    <div className="mb-6">
      <h3 className="font-display text-xl font-semibold mb-1">{name}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
    <div className="mb-6">
      <span className="font-display text-5xl font-bold">{price}</span>
      <span className="text-muted-foreground">/month</span>
    </div>
    <ul className="space-y-3 mb-8">
      {features.map((feature, i) => (
        <li key={i} className="flex items-center gap-3 text-sm">
          <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
            <Zap className="h-3 w-3 text-primary" />
          </div>
          {feature}
        </li>
      ))}
    </ul>
    <Link to="/register">
      <Button variant={featured ? "hero" : "outline"} className="w-full">
        Get Started
      </Button>
    </Link>
  </div>
);

export default LandingPage;
