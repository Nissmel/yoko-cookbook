-- Pantry items table for persistent pantry
CREATE TABLE public.pantry_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  quantity text,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pantry" ON public.pantry_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pantry" ON public.pantry_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pantry" ON public.pantry_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pantry" ON public.pantry_items FOR DELETE USING (auth.uid() = user_id);

-- Recipe sharing table
CREATE TABLE public.recipe_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_owner_id uuid NOT NULL,
  shared_with_email text NOT NULL,
  shared_with_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(recipe_owner_id, shared_with_email)
);

ALTER TABLE public.recipe_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage shares" ON public.recipe_shares FOR ALL USING (auth.uid() = recipe_owner_id);
CREATE POLICY "Recipients can view shares" ON public.recipe_shares FOR SELECT USING (auth.uid() = shared_with_user_id);

-- Allow shared users to view recipes
CREATE POLICY "Shared users can view recipes" ON public.recipes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.recipe_shares
    WHERE recipe_shares.recipe_owner_id = recipes.user_id
    AND recipe_shares.shared_with_user_id = auth.uid()
  )
);