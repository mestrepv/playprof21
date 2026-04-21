/**
 * Tipos espelhando os Pydantic schemas do backend (modules/auth/schemas.py).
 */

export interface AuthUser {
  id: string
  email: string | null
  display_name: string
  role: string
  created_at: string
}

export interface TokenPayload {
  access_token: string
  token_type: 'bearer'
  user: AuthUser
}
