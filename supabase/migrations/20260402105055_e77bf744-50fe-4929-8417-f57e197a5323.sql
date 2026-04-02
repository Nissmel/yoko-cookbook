
-- Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Update existing profiles with emails from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;

-- Update handle_new_user to also store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);
  
  -- Auto-link any pending recipe shares for this email
  UPDATE public.recipe_shares
  SET shared_with_user_id = NEW.id
  WHERE shared_with_email = NEW.email AND shared_with_user_id IS NULL;
  
  RETURN NEW;
END;
$function$;

-- Allow authenticated users to look up profiles by email (for sharing)
CREATE POLICY "Authenticated users can view profiles by email"
ON public.profiles FOR SELECT TO authenticated
USING (true);
