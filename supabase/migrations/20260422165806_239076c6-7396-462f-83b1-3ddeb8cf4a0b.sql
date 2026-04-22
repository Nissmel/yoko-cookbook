-- Allow users with whom recipes are shared to view (read-only) the owner's shopping list.
-- Edits / inserts / deletes remain restricted to the owner via existing policies.

CREATE POLICY "Shared users can view shopping list"
ON public.shopping_list_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.recipe_shares
    WHERE recipe_shares.recipe_owner_id = shopping_list_items.user_id
      AND recipe_shares.shared_with_user_id = auth.uid()
  )
);