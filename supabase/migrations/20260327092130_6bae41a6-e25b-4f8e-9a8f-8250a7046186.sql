
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Recipes table
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  servings INTEGER NOT NULL DEFAULT 4,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  ingredients JSONB NOT NULL DEFAULT '[]',
  instructions JSONB NOT NULL DEFAULT '[]',
  source_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recipes" ON public.recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recipes" ON public.recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recipes" ON public.recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipes" ON public.recipes FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_recipes_user_id ON public.recipes(user_id);
CREATE INDEX idx_recipes_category ON public.recipes(category);
CREATE INDEX idx_recipes_tags ON public.recipes USING GIN(tags);

-- Shopping list table
CREATE TABLE public.shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  ingredient_name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  checked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own shopping list" ON public.shopping_list_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shopping list items" ON public.shopping_list_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shopping list items" ON public.shopping_list_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shopping list items" ON public.shopping_list_items FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for recipe images
INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-images', 'recipe-images', true);
CREATE POLICY "Recipe images are publicly viewable" ON storage.objects FOR SELECT USING (bucket_id = 'recipe-images');
CREATE POLICY "Users can upload recipe images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'recipe-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their recipe images" ON storage.objects FOR UPDATE USING (bucket_id = 'recipe-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their recipe images" ON storage.objects FOR DELETE USING (bucket_id = 'recipe-images' AND auth.uid()::text = (storage.foldername(name))[1]);
