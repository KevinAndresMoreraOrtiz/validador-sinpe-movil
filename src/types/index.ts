export interface ParsedDeposit {
  reference_number: string
  origin_number: string | null
  origin_name: string | null
  destination_number: string | null
  destination_name: string | null
  amount: number | null
  currency: string
  concept: string | null
  date: string | null
  raw_email_text: string
}

export interface EmailConfig {
  id: string
  email_address: string
  provider: string
  access_token: string
  refresh_token: string
  token_expires_at: string | null
  is_active: boolean
  last_fetched_at: string | null
}

export interface ParserConfig {
  id: string
  name: string
  sender_email: string
  parser_type: string
  is_active: boolean
  config: Record<string, unknown>
}

export interface ApiToken {
  id: string
  name: string
  token: string
  is_active: boolean
  last_used_at: string | null
  created_at: string
}

export interface DepositResponse {
  success: boolean
  data: ParsedDeposit[]
  error?: string
}
