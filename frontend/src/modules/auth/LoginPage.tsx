import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const next = sp.get('next') ?? '/teacher'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await login(email.trim(), password)
      navigate(next, { replace: true })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={root}>
      {/* Painel esquerdo — marca */}
      <div className="p21-login-brand" style={brandPanel}>
        <div style={brandInner}>
          <div style={mark}>P21</div>
          <h1 style={brandTitle}>labprof21</h1>
          <p style={brandSub}>Plataforma de aulas interativas síncronas para professores de exatas.</p>
          <ul style={featureList}>
            <FeatureItem>Slides ao vivo sincronizados</FeatureItem>
            <FeatureItem>Quiz em tempo real com score</FeatureItem>
            <FeatureItem>Trilhas assíncronas com progresso</FeatureItem>
            <FeatureItem>Missões interativas de física</FeatureItem>
          </ul>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div style={formPanel}>
        <div style={formInner}>
          <div style={formHeader}>
            <div style={markSm}>P21</div>
            <span style={formHeaderLabel}>labprof21</span>
          </div>

          <h2 style={formTitle}>Entrar</h2>
          <p style={formSub}>Acesse o painel do professor.</p>

          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14, marginTop: 24 }}>
            <Input
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Senha"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={err ?? undefined}
            />
            <Button type="submit" disabled={busy} block size="lg" style={{ marginTop: 4 }}>
              {busy ? 'entrando…' : 'Entrar'}
            </Button>
          </form>

          <div style={divider} />

          <div style={links}>
            <span style={linkMuted}>Novo professor?</span>{' '}
            <Link to="/register" style={link}>criar conta</Link>
          </div>
          <div style={{ ...links, marginTop: 8 }}>
            <span style={linkMuted}>É aluno?</span>{' '}
            <Link to="/student/join" style={link}>entrar com código da turma</Link>
          </div>
        </div>
      </div>

      <LoginStyles />
    </div>
  )
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li style={featureItem}>
      <span style={featureCheck}>✓</span>
      {children}
    </li>
  )
}

function LoginStyles() {
  return (
    <style>{`
      @media (max-width: 700px) {
        .p21-login-brand { display: none !important; }
        .p21-login-form { width: 100% !important; }
      }
    `}</style>
  )
}

// ── estilos ───────────────────────────────────────────────────────────────

const root: React.CSSProperties = {
  display: 'flex',
  minHeight: '100dvh',
  background: 'var(--p21-bg)',
}

const brandPanel: React.CSSProperties = {
  flex: '0 0 44%',
  maxWidth: 520,
  background: 'linear-gradient(155deg, var(--brand-500) 0%, var(--brand-700) 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 40px',
}

const brandInner: React.CSSProperties = {
  maxWidth: 360,
  color: '#fff',
}

const mark: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 12,
  background: 'rgba(255,255,255,0.18)',
  border: '1.5px solid rgba(255,255,255,0.35)',
  display: 'grid',
  placeItems: 'center',
  fontFamily: 'var(--p21-font-display)',
  fontWeight: 700,
  fontSize: 18,
  letterSpacing: -0.5,
  color: '#fff',
  marginBottom: 24,
}

const brandTitle: React.CSSProperties = {
  fontSize: 'clamp(1.6rem, 2vw, 2.2rem)',
  fontWeight: 700,
  fontFamily: 'var(--p21-font-display)',
  letterSpacing: -0.03,
  margin: '0 0 12px',
  color: '#fff',
}

const brandSub: React.CSSProperties = {
  fontSize: '1rem',
  lineHeight: 1.55,
  color: 'rgba(255,255,255,0.82)',
  margin: '0 0 32px',
}

const featureList: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: 12,
}

const featureItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: '0.95rem',
  color: 'rgba(255,255,255,0.9)',
}

const featureCheck: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.2)',
  display: 'grid',
  placeItems: 'center',
  fontSize: 12,
  fontWeight: 700,
  flexShrink: 0,
}

const formPanel: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 24px',
}

const formInner: React.CSSProperties = {
  width: '100%',
  maxWidth: 400,
}

const formHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 40,
}

const markSm: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: 'var(--brand-500)',
  color: '#fff',
  display: 'grid',
  placeItems: 'center',
  fontFamily: 'var(--p21-font-display)',
  fontWeight: 700,
  fontSize: 11,
}

const formHeaderLabel: React.CSSProperties = {
  fontFamily: 'var(--p21-font-display)',
  fontWeight: 600,
  fontSize: 16,
  color: 'var(--p21-ink)',
}

const formTitle: React.CSSProperties = {
  fontSize: 'var(--p21-text-xl)',
  fontWeight: 700,
  margin: '0 0 4px',
  color: 'var(--p21-ink)',
}

const formSub: React.CSSProperties = {
  margin: 0,
  color: 'var(--p21-ink-3)',
  fontSize: 'var(--p21-text-sm)',
}

const divider: React.CSSProperties = {
  height: 1,
  background: 'var(--p21-border)',
  margin: '28px 0 20px',
}

const links: React.CSSProperties = {
  fontSize: 'var(--p21-text-sm)',
}

const linkMuted: React.CSSProperties = {
  color: 'var(--p21-ink-3)',
}

const link: React.CSSProperties = {
  color: 'var(--p21-blue)',
  textDecoration: 'none',
  fontWeight: 500,
}
