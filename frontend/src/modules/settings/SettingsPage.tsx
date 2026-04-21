/**
 * /settings — página de configurações.
 *
 * Fase 7.4: placeholder minimalista. Tema escuro, notificações e idioma
 * aparecem quando forem validados em aula real.
 */

import { Navigate } from 'react-router-dom'

import { AppShell } from '../../components/ui/AppShell'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../auth/AuthContext'

export function SettingsPage() {
  const { user, token, loading } = useAuth()
  if (loading) return <AppShell>carregando…</AppShell>
  if (!user || !token) return <Navigate to="/login?next=/settings" replace />

  return (
    <AppShell variant="narrow">
      <h1 style={{ fontSize: 'var(--p21-text-xl)', margin: '0 0 var(--p21-sp-5)' }}>Configurações</h1>

      <div style={{ display: 'grid', gap: 'var(--p21-sp-4)' }}>
        <Card padded>
          <Row label="tema" value="claro" hint="modo escuro em breve" />
        </Card>
        <Card padded>
          <Row label="idioma" value="português (Brasil)" hint="só este por ora" />
        </Card>
        <Card padded>
          <Row label="notificações por email" value="desativadas" hint="ainda não implementado" />
        </Card>
        <div style={{ color: 'var(--p21-ink-4)', fontSize: 'var(--p21-text-sm)', marginTop: 8 }}>
          Mais opções aparecerão aqui conforme a plataforma for usada em aula real.
        </div>
      </div>
    </AppShell>
  )
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 'var(--p21-text-base)' }}>{label}</div>
        {hint && <div style={{ fontSize: 'var(--p21-text-xs)', color: 'var(--p21-ink-3)', fontFamily: 'var(--p21-font-mono)' }}>{hint}</div>}
      </div>
      <div
        style={{
          fontFamily: 'var(--p21-font-mono)',
          color: 'var(--p21-ink-3)',
          fontSize: 'var(--p21-text-sm)',
        }}
      >
        {value}
      </div>
    </div>
  )
}
