import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Radio, Eye, EyeOff, Check } from "lucide-react";

const RegisterPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // TODO: Implement with Supabase Auth
    setTimeout(() => setIsLoading(false), 1000);
  };

  const passwordRequirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a number", met: /\d/.test(password) },
    { label: "Contains a special character", met: /[!@#$%^&*]/.test(password) },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Visual */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-background to-primary/20" />
        <div className="absolute inset-0 bg-hero-pattern opacity-30" />
        <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-primary/30 rounded-full blur-[80px] animate-pulse-glow" />
        <div className="absolute bottom-1/3 left-1/3 w-64 h-64 bg-accent/30 rounded-full blur-[80px] animate-pulse-glow" />
        
        <div className="relative flex items-center justify-center p-12">
          <div className="text-center max-w-md">
            <Radio className="h-16 w-16 text-primary mx-auto mb-6 animate-float" />
            <h2 className="font-display text-3xl font-bold mb-4">
              Join the Signal
            </h2>
            <p className="text-muted-foreground">
              Start your journey into the world of mystery content creation today.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 mb-8 hover:opacity-80 transition-opacity">
            <Radio className="h-6 w-6 text-primary" />
            <span className="font-display font-bold text-xl">CreatorSignals</span>
          </Link>

          <h1 className="font-display text-3xl font-bold mb-2">Create your account</h1>
          <p className="text-muted-foreground mb-8">
            Start your 7-day free trial — no credit card required
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              <div className="mt-2 space-y-1">
                {passwordRequirements.map((req, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className={`h-4 w-4 rounded-full flex items-center justify-center transition-colors ${
                      req.met ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"
                    }`}>
                      {req.met && <Check className="h-3 w-3" />}
                    </div>
                    <span className={req.met ? "text-foreground" : "text-muted-foreground"}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-destructive">Passwords don't match</p>
              )}
            </div>

            <Button 
              type="submit" 
              variant="hero" 
              className="w-full" 
              disabled={isLoading || password !== confirmPassword}
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By creating an account, you agree to our{" "}
            <a href="#" className="underline hover:text-foreground">Terms of Service</a>
            {" "}and{" "}
            <a href="#" className="underline hover:text-foreground">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
