
ALTER TABLE public.recipes
ADD COLUMN calories_per_serving INTEGER,
ADD COLUMN protein_grams NUMERIC(8,2),
ADD COLUMN carbs_grams NUMERIC(8,2),
ADD COLUMN fat_grams NUMERIC(8,2),
ADD COLUMN fiber_grams NUMERIC(8,2);
