-- Allow shared users full access to meal_plans (like a shared account)
CREATE POLICY "Shared users can view meal plans"
ON public.meal_plans FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.recipe_shares
  WHERE recipe_shares.recipe_owner_id = meal_plans.user_id
    AND recipe_shares.shared_with_user_id = auth.uid()
));

CREATE POLICY "Shared users can insert meal plans"
ON public.meal_plans FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.recipe_shares
  WHERE recipe_shares.recipe_owner_id = meal_plans.user_id
    AND recipe_shares.shared_with_user_id = auth.uid()
));

CREATE POLICY "Shared users can update meal plans"
ON public.meal_plans FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.recipe_shares
  WHERE recipe_shares.recipe_owner_id = meal_plans.user_id
    AND recipe_shares.shared_with_user_id = auth.uid()
));

CREATE POLICY "Shared users can delete meal plans"
ON public.meal_plans FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.recipe_shares
  WHERE recipe_shares.recipe_owner_id = meal_plans.user_id
    AND recipe_shares.shared_with_user_id = auth.uid()
));