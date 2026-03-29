CREATE TABLE public.discovered_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source_url text NOT NULL UNIQUE,
  source_type text NOT NULL DEFAULT 'rss',
  genre text NOT NULL,
  category text NOT NULL,
  feed_title text NULL,
  item_count integer NULL,
  last_item_date timestamptz NULL,
  discovery_method text NOT NULL DEFAULT 'competitor',
  added_to_sources boolean NOT NULL DEFAULT false
);