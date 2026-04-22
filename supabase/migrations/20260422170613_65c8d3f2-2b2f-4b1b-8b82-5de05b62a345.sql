-- Grant shared users full access (insert/update/delete) to the recipe owner's shopping list,
-- so sharing behaves like a shared account.

CREATE POLICY "Shared users can insert shopping list items"
ON public.shopping_list_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recipe_shares
    WHERE recipe_shares.recipe_owner_id = shopping_list_items.user_id
      AND recipe_shares.shared_with_user_id = auth.uid()
  )
);

CREATE POLICY "Shared users can update shopping list items"
ON public.shopping_list_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.recipe_shares
    WHERE recipe_shares.recipe_owner_id = shopping_list_items.user_id
      AND recipe_shares.shared_with_user_id = auth.uid()
  )
);

CREATE POLICY "Shared users can delete shopping list items"
ON public.shopping_list_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.recipe_shares
    WHERE recipe_shares.recipe_owner_id = shopping_list_items.user_id
      AND recipe_shares.shared_with_user_id = auth.uid()
  )
);

-- Also grant shared users full access to the owner's pantry (used by shopping list logic
-- and Pantry page — sharing should mirror "same account" semantics).
CREATE POLICY "Shared users can view pantry"
ON public.pantry_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.recipe_shares
    WHERE recipe_shares.recipe_owner_id = pantry_items.user_id
      AND recipe_shares.shared_with_user_id = auth.uid()
  )
);

CREATE POLICY "Shared users can insert pantry items"
ON public.pantry_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recipe_shares
    WHERE recipe_shares.recipe_owner_id = pantry_items.user_id
      AND recipe_shares.shared_with_user_id = auth.uid()
  )
);

CREATE POLICY "Shared users can update pantry items"
ON public.pantry_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.recipe_shares
    WHERE recipe_shares.recipe_owner_id = pantry_items.user_id
      AND recipe_shares.shared_with_user_id = auth.uid()
  )
);

CREATE POLICY "Shared users can delete pantry items"
ON public.pantry_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.recipe_shares
    WHERE recipe_shares.recipe_owner_id = pantry_items.user_id
      AND recipe_shares.shared_with_user_id = auth.uid()
  )
);