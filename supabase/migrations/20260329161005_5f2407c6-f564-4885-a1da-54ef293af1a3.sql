ALTER TABLE public.discovered_sources ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
-- No policies for anon/authenticated since this is admin-only data
CREATE POLICY "Service role full access" ON public.discovered_sources
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));