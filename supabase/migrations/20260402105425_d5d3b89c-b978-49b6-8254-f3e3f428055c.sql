
-- Recipe collections
CREATE TABLE public.recipe_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recipe_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own collections" ON public.recipe_collections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Junction table
CREATE TABLE public.recipe_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.recipe_collections(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(collection_id, recipe_id)
);

ALTER TABLE public.recipe_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own collection items" ON public.recipe_collection_items FOR ALL
USING (EXISTS (SELECT 1 FROM public.recipe_collections c WHERE c.id = collection_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.recipe_collections c WHERE c.id = collection_id AND c.user_id = auth.uid()));

-- Meal planner
CREATE TABLE public.meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  meal_type text NOT NULL DEFAULT 'dinner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, recipe_id, plan_date, meal_type)
);

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meal plans" ON public.meal_plans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_recipe_collections_updated_at BEFORE UPDATE ON public.recipe_collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
