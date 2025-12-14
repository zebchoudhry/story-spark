-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('user', 'admin');

-- Create subscription plan enum
CREATE TYPE public.subscription_plan AS ENUM ('free', 'basic', 'pro');

-- Create subscription status enum
CREATE TYPE public.subscription_status AS ENUM ('active', 'trialing', 'cancelled', 'past_due');

-- Create story category enum
CREATE TYPE public.story_category AS ENUM ('ufo', 'paranormal', 'unresolved', 'weird_news');

-- Create credibility level enum
CREATE TYPE public.credibility_level AS ENUM ('low', 'medium', 'high');

-- Create trend score enum
CREATE TYPE public.trend_score AS ENUM ('hot', 'warm', 'cold');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create user_roles table (for security - roles must be separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan subscription_plan NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create stories_raw table for ingested content
CREATE TABLE public.stories_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(source_type, external_id)
);

-- Create story_cards table for processed stories
CREATE TABLE public.story_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_story_id UUID REFERENCES public.stories_raw(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary_short TEXT NOT NULL,
  summary_long TEXT,
  why_interesting TEXT,
  category story_category NOT NULL,
  credibility credibility_level NOT NULL DEFAULT 'medium',
  trend_score trend_score NOT NULL DEFAULT 'warm',
  source_name TEXT NOT NULL,
  source_link TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create story_content_packs table
CREATE TABLE public.story_content_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_card_id UUID NOT NULL REFERENCES public.story_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  youtube_script TEXT,
  shorts_script TEXT,
  hooks TEXT,
  thumbnail_texts TEXT,
  hashtags TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_content_packs ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Stories raw policies (admins only for write, no public read needed)
CREATE POLICY "Admins can manage raw stories"
  ON public.stories_raw FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Story cards policies (public read, admin write)
CREATE POLICY "Anyone authenticated can view story cards"
  ON public.story_cards FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage story cards"
  ON public.story_cards FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Content packs policies
CREATE POLICY "Users can view their own content packs"
  ON public.story_content_packs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own content packs"
  ON public.story_content_packs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content packs"
  ON public.story_content_packs FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  
  -- Create default subscription
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active');
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_story_cards_category ON public.story_cards(category);
CREATE INDEX idx_story_cards_trend_score ON public.story_cards(trend_score);
CREATE INDEX idx_story_cards_created_at ON public.story_cards(created_at DESC);
CREATE INDEX idx_stories_raw_processed ON public.stories_raw(processed) WHERE processed = false;
CREATE INDEX idx_story_content_packs_user ON public.story_content_packs(user_id);
