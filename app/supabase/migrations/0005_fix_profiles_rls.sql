-- Fix profiles INSERT policy.
-- The original 0002_rls.sql only created SELECT and UPDATE policies for profiles,
-- blocking upsert on first profile creation during onboarding.
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
