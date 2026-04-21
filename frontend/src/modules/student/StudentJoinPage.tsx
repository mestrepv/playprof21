/**
 * /student/join — aluno entra numa turma com código + nome. Fase 6 cria uma
 * conta nova a cada join; cliente guarda o JWT no mesmo localStorage do
 * AuthContext. Se aluno voltar, fica autenticado como o mesmo user.
 *
 * Pode chegar com `?code=NNNNNN` pré-preenchido (QR, link compartilhado).
 */

import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { SlideShell } from '../lab/components/SlideShell'
import { apiJson } from '../lab/runtime/apiFetch'

interface JoinResp {
  classroom_id: string
  classroom_name: string
  access_token: string
  user_id: string
  display_name: string
}

export function StudentJoinPage() {
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  const { login: _unused, logout } = useAuth()
  const [code, setCode] = useState(sp.get('code') ?? '')
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('labprof21:last_display_name') ?? ''
    } catch {
      return ''
    }
  })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = code.replace(/\D/g, '')
    if (clean.length !== 6) return setErr('código tem 6 dígitos')
    if (!name.trim()) return setErr('digite um nome')
    setErr(null)
    setBusy(true)
    try {
      const r = await apiJson<JoinResp>('/api/classrooms/join', {
        method: 'POST',
        json: { code: clean, display_name: name.trim() },
      })
      // Persiste JWT no mesmo storage do AuthContext (role='student').
      // logout() foi carregado caso um prof quisesse entrar como aluno na
      // mesma máquina — limpa ramo de teacher antes de gravar o novo.
      logout()
      try {
        localStorage.setItem(
          'labprof21:auth',
          JSON.stringify({
            user: {
              id: r.user_id,
              email: null,
              display_name: r.display_name,
              role: 'student',
              created_at: new Date().toISOString(),
            },
            token: r.access_token,
          }),
        )
        localStorage.setItem('labprof21:last_display_name', r.display_name)
      } catch {
        /* quota */
      }
      navigate('/student', { replace: true })
      // force remount do provider pra re-hidratar do storage
      window.location.reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SlideShell>
      <div style={{ maxWidth: 420, margin: '0 auto', marginTop: 'var(--spacing-lab-6)' }}>
        <h1 style={{ fontSize: 'var(--text-lab-xl)', margin: 0 }}>Entrar numa turma</h1>
        <p style={{ color: '#555B66', marginTop: 6 }}>
          Use o código da turma que o professor passou. Identifica você sem senha — troca de
          dispositivo cria um aluno novo.
        </p>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14, marginTop: 'var(--spacing-lab-5)' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#555B66' }}>código da turma</span>
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus={!code}
              required
              style={{
                padding: '12px 14px',
                border: '1px solid var(--color-lab-rule)',
                borderRadius: 10,
                fontSize: 28,
                fontFamily: 'var(--font-lab-mono)',
                textAlign: 'center',
                letterSpacing: 6,
                background: '#FFF',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#555B66' }}>seu nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              autoFocus={!!code}
              style={{
                padding: '10px 12px',
                border: '1px solid var(--color-lab-rule)',
                borderRadius: 8,
                fontSize: 15,
                background: '#FFF',
                fontFamily: 'inherit',
              }}
            />
          </label>

          {err && (
            <div
              style={{
                padding: '10px 12px',
                background: '#FAECE7',
                color: '#993C1D',
                borderRadius: 8,
                fontFamily: 'var(--font-lab-mono)',
                fontSize: 13,
              }}
            >
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              padding: '12px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--color-lab-accent)',
              color: '#FFF',
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {busy ? 'entrando…' : 'entrar na turma'}
          </button>
        </form>
      </div>
    </SlideShell>
  )
}
