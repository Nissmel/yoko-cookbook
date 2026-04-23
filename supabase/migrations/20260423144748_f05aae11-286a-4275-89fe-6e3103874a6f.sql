-- Drop overly permissive UPDATE policy
DROP POLICY IF EXISTS "Anyone authenticated can increment import_count" ON public.scraped_recipes;

-- Replace with a SECURITY DEFINER function that only increments the counter
CREATE OR REPLACE FUNCTION public.increment_scraped_import_count(_scraped_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.scraped_recipes
  SET import_count = import_count + 1
  WHERE id = _scraped_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_scraped_import_count(UUID) TO authenticated;