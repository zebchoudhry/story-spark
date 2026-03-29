
CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  client_id uuid REFERENCES auth.users(id) NULL,
  source_type text NOT NULL,
  source_url text NOT NULL,
  category text NOT NULL,
  genre text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_fetched_at timestamptz NULL
);

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read global sources (client_id IS NULL)
CREATE POLICY "Authenticated users can read global sources"
  ON public.sources FOR SELECT TO authenticated
  USING (client_id IS NULL);

-- Authenticated users can read their own sources
CREATE POLICY "Users can read own sources"
  ON public.sources FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- Authenticated users can insert their own sources
CREATE POLICY "Users can insert own sources"
  ON public.sources FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Authenticated users can update their own sources
CREATE POLICY "Users can update own sources"
  ON public.sources FOR UPDATE TO authenticated
  USING (client_id = auth.uid());
