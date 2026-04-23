-- Catalog of recipe blog sources (shared, admin-managed via service role)
CREATE TABLE public.recipe_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_crawled_at TIMESTAMP WITH TIME ZONE,
  recipe_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view sources"
  ON public.recipe_sources FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_recipe_sources_updated_at
  BEFORE UPDATE ON public.recipe_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexed library of scraped recipe titles + URLs (lightweight, full content fetched on-demand)
CREATE TABLE public.scraped_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES public.recipe_sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  image_url TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  import_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_scraped_recipes_source ON public.scraped_recipes(source_id);
CREATE INDEX idx_scraped_recipes_title ON public.scraped_recipes USING GIN (to_tsvector('simple', title));

ALTER TABLE public.scraped_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view scraped recipes"
  ON public.scraped_recipes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone authenticated can increment import_count"
  ON public.scraped_recipes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed initial Polish recipe blogs
INSERT INTO public.recipe_sources (name, base_url, description) VALUES
  ('Kwestia Smaku', 'https://www.kwestiasmaku.com', 'Popularny polski blog kulinarny'),
  ('Ania Gotuje', 'https://aniagotuje.pl', 'Sprawdzone przepisy domowe'),
  ('Moje Wypieki', 'https://mojewypieki.com', 'Wypieki, ciasta i desery');