-- Create the push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Enable Row Level Security
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Create a Database Webhook or Trigger for the servicios table
-- This requires the pg_net extension if making HTTP requests directly,
-- but the modern Supabase way is to use Webhooks via the Dashboard.
-- 
-- Instructions for Supabase Dashboard:
-- 1. Go to Database -> Webhooks
-- 2. Create a new Webhook
-- 3. Name: "Notify Status Change"
-- 4. Table: "servicios"
-- 5. Events: "UPDATE"
-- 6. Type: "HTTP Request"
-- 7. Method: "POST"
-- 8. URL: "https://[YOUR_PROJECT_REF].supabase.co/functions/v1/notify-status-change"
-- 9. HTTP Headers: 
--    - Authorization: Bearer [YOUR_ANON_KEY]
--    - Content-type: application/json
