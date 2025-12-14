import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, CreditCard } from "lucide-react";

const plans = [
  {
    id: "basic",
    name: "Basic",
    price: "£19",
    description: "Perfect for getting started",
    features: [
      "30 story cards per day",
      "5 content packs per month",
      "Daily email digest",
      "Basic filters & search",
      "Email support",
    ],
    current: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "£49",
    description: "For serious creators",
    features: [
      "Unlimited story cards",
      "Unlimited content packs",
      "Priority email digest",
      "Advanced filters & analytics",
      "API access",
      "Priority support",
      "Custom categories",
    ],
    featured: true,
  },
];

const BillingPage = () => {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleUpgrade = (planId: string) => {
    setIsLoading(planId);
    // TODO: Implement Stripe checkout
    setTimeout(() => setIsLoading(null), 2000);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-2">Billing</h1>
          <p className="text-muted-foreground">
            Manage your subscription and billing details
          </p>
        </div>

        {/* Current Plan */}
        <Card className="mb-8 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Current Plan
                </CardTitle>
                <CardDescription>You're currently on the Basic plan</CardDescription>
              </div>
              <Badge variant="secondary">Active</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-display text-4xl font-bold">£19</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your next billing date is <span className="text-foreground">January 15, 2025</span>
            </p>
          </CardContent>
        </Card>

        {/* Plans */}
        <div className="mb-8">
          <h2 className="font-display text-xl font-semibold mb-4">Available Plans</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative transition-all duration-300 ${
                  plan.featured
                    ? "border-primary/50 bg-gradient-to-b from-primary/10 to-transparent shadow-lg shadow-primary/10"
                    : plan.current
                    ? "border-primary/30"
                    : ""
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1">
                    <Crown className="h-3 w-3" />
                    Recommended
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <span className="font-display text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  {plan.current ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      variant={plan.featured ? "hero" : "default"}
                      className="w-full"
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={isLoading === plan.id}
                    >
                      {isLoading === plan.id ? (
                        "Processing..."
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Upgrade to {plan.name}
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Billing History */}
        <Card>
          <CardHeader>
            <CardTitle>Billing History</CardTitle>
            <CardDescription>View your past invoices and payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { date: "Dec 15, 2024", amount: "£19.00", status: "Paid" },
                { date: "Nov 15, 2024", amount: "£19.00", status: "Paid" },
                { date: "Oct 15, 2024", amount: "£19.00", status: "Paid" },
              ].map((invoice, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"
                >
                  <div>
                    <p className="font-medium">{invoice.date}</p>
                    <p className="text-sm text-muted-foreground">Basic Plan</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{invoice.amount}</p>
                    <Badge variant="secondary" className="text-xs">
                      {invoice.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BillingPage;
