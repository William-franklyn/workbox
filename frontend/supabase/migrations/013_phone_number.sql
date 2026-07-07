-- Add phone_number to profiles for SMS integration
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles (phone_number);
