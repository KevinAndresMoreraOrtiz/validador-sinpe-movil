CREATE SCHEMA IF NOT EXISTS sinpemovil;

CREATE TABLE sinpemovil.email_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gmail',
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

CREATE TABLE sinpemovil.parsers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  parser_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sinpemovil.api_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sinpemovil.parsed_deposits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parser_id UUID REFERENCES sinpemovil.parsers(id) ON DELETE CASCADE,
  reference_number TEXT NOT NULL,
  origin_number TEXT,
  origin_name TEXT,
  destination_number TEXT,
  destination_name TEXT,
  amount DECIMAL(15,2),
  currency TEXT DEFAULT 'CRC',
  concept TEXT,
  date TIMESTAMPTZ,
  raw_email_text TEXT,
  email_message_id TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reference_number)
);

ALTER TABLE sinpemovil.parsers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sinpemovil.email_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sinpemovil.api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sinpemovil.parsed_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_parsers" ON sinpemovil.parsers
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_email_configs" ON sinpemovil.email_configs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_api_tokens" ON sinpemovil.api_tokens
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_deposits" ON sinpemovil.parsed_deposits
  FOR ALL USING (
    parser_id IN (
      SELECT id FROM sinpemovil.parsers WHERE user_id = auth.uid()
    )
  );
