/**
 * Implementação compartilhada das tabs Trilhas e Aulas.
 * Filtra os assignments por content_type e renderiza com picker + delete +
 * ação extra (iniciar ao vivo, no caso de aula interativa).
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { PlusIcon, TrashIcon } from '../../../components/ui/icons'
import { apiJson } from '../../lab/runtime/apiFetch'
import type { AssignmentExpanded, ContentType, InteractiveLesson, Trail } from '../types'

interface Props {
  classroomId: string
  token: string
  contentType: 'trail' | 'interactive_lesson'
}

export function AssignmentsTab({ classroomId, token, contentType }: Props) {
  const [items, setItems] = useState<AssignmentExpanded[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [bank, setBank] = useState<(Trail | InteractiveLesson)[] | null>(null)

  const load = useCallback(async () => {
    try {
      const all = await apiJson<AssignmentExpanded[]>(
        `/api/classrooms/${classroomId}/assignments`,
        { token },
      )
      setItems(all.filter((a) => a.assignment.content_type === contentType))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [classroomId, token, contentType])

  useEffect(() => {
    load()
  }, [load])

  const openPicker = async () => {
    setShowPicker(true)
    if (bank === null) {
      const path = contentType === 'trail' ? '/api/trails' : '/api/interactive-lessons'
      try {
        const list = await apiJson<(Trail | InteractiveLesson)[]>(path, { token })
        setBank(list)
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    }
  }

  const attach = async (content_id: string) => {
    try {
      await apiJson(`/api/classrooms/${classroomId}/assignments`, {
        token,
        method: 'POST',
        json: { content_type: contentType as ContentType, content_id, position: items.length },
      })
      setShowPicker(false)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const detach = async (assignmentId: string) => {
    if (!confirm('Remover essa atribuição da turma?')) return
    try {
      await apiJson(`/api/assignments/${assignmentId}`, { token, method: 'DELETE' })
      setItems((prev) => prev.filter((x) => x.assignment.id !== assignmentId))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const typeLabel = contentType === 'trail' ? 'trilha' : 'aula interativa'
  const existingIds = new Set(items.map((i) => i.assignment.content_id))
  const choices = (bank ?? []).filter((b) => !existingIds.has(b.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--p21-sp-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 'var(--p21-text-sm)', color: 'var(--p21-ink-3)' }}>
          {items.length} {items.length === 1 ? typeLabel : typeLabel + 's'} atribuídas
        </div>
        <Button size="sm" variant="primary" onClick={openPicker}>
          <PlusIcon size={16} /> atribuir {typeLabel}
        </Button>
      </div>

      {err && <div style={errBox}>{err}</div>}

      {items.length === 0 && (
        <Card>
          <div style={{ textAlign: 'center', color: 'var(--p21-ink-3)', padding: 'var(--p21-sp-4)' }}>
            Nenhuma {typeLabel} atribuída. Clique em <strong>atribuir</strong> acima pra pegar do banco.
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((ae) =>
          ae.trail ? (
            <TrailRow key={ae.assignment.id} trail={ae.trail} onRemove={() => detach(ae.assignment.id)} />
          ) : ae.interactive_lesson ? (
            <LessonRow
              key={ae.assignment.id}
              lesson={ae.interactive_lesson}
              classroomId={classroomId}
              token={token}
              onRemove={() => detach(ae.assignment.id)}
            />
          ) : null,
        )}
      </div>

      {showPicker && (
        <PickerOverlay
          title={`Escolher ${typeLabel} do banco`}
          choices={choices}
          onPick={(id) => attach(id)}
          onClose={() => setShowPicker(false)}
          emptyHint={
            <>
              seu banco de {typeLabel}s está vazio.{' '}
              <Link to="/teacher/library">criar uma</Link>
            </>
          }
        />
      )}
    </div>
  )
}

// ── Linhas específicas ──────────────────────────────────────────────────

function TrailRow({ trail, onRemove }: { trail: Trail; onRemove: () => void }) {
  return (
    <Card padded>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'color-mix(in srgb, var(--p21-teal) 14%, transparent)',
            color: 'var(--p21-teal)',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          ⚡
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{trail.title}</div>
          {trail.description && (
            <div style={{ fontSize: 'var(--p21-text-xs)', color: 'var(--p21-ink-3)', marginTop: 2 }}>
              {trail.description}
            </div>
          )}
        </div>
        <button type="button" onClick={onRemove} style={iconBtn} aria-label="remover">
          <TrashIcon size={16} />
        </button>
      </div>
    </Card>
  )
}

function LessonRow({
  lesson,
  classroomId,
  token,
  onRemove,
}: {
  lesson: InteractiveLesson
  classroomId: string
  token: string
  onRemove: () => void
}) {
  const navigate = useNavigate()
  const startLive = async () => {
    try {
      const s = await apiJson<{ id: string }>('/api/lab/sessions', {
        token,
        method: 'POST',
        json: { interactive_lesson_id: lesson.id },
      })
      navigate(`/lab/session/${s.id}?role=master`)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }
  // suppress unused warning
  void classroomId
  return (
    <Card padded>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'color-mix(in srgb, var(--p21-purple) 14%, transparent)',
            color: 'var(--p21-purple)',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          🎬
        </span>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 600 }}>{lesson.title}</div>
          <div style={{ fontSize: 'var(--p21-text-xs)', color: 'var(--p21-ink-3)', fontFamily: 'var(--p21-font-mono)' }}>
            <code>{lesson.slug}</code>
          </div>
        </div>
        <Button size="sm" variant="primary" onClick={startLive}>
          iniciar ao vivo ▶
        </Button>
        <Link
          to={`/lab/preview/${encodeURIComponent(lesson.slug)}`}
          style={{ fontSize: 'var(--p21-text-sm)', textDecoration: 'none' }}
        >
          preview
        </Link>
        <button type="button" onClick={onRemove} style={iconBtn} aria-label="remover">
          <TrashIcon size={16} />
        </button>
      </div>
    </Card>
  )
}

// ── Picker overlay ────────────────────────────────────────────────────────

interface Pickable {
  id: string
  title: string
}

function PickerOverlay({
  title,
  choices,
  onPick,
  onClose,
  emptyHint,
}: {
  title: string
  choices: Pickable[] | null
  onPick: (id: string) => void
  onClose: () => void
  emptyHint?: React.ReactNode
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,17,21,0.55)',
        zIndex: 90,
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--p21-sp-4)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--p21-surface)',
          borderRadius: 'var(--p21-radius-lg)',
          maxWidth: 520,
          width: '100%',
          maxHeight: '80dvh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--p21-shadow-lg)',
        }}
      >
        <header
          style={{
            padding: 'var(--p21-sp-4) var(--p21-sp-5)',
            borderBottom: '1px solid var(--p21-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 'var(--p21-text-md)' }}>{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            fechar
          </Button>
        </header>
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--p21-sp-4)' }}>
          {choices === null ? (
            <div style={{ color: 'var(--p21-ink-3)' }}>carregando banco…</div>
          ) : choices.length === 0 ? (
            <div style={{ color: 'var(--p21-ink-3)' }}>{emptyHint ?? 'nada disponível.'}</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {choices.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPick(c.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 'var(--p21-radius-md)',
                      border: '1px solid var(--p21-border)',
                      background: 'var(--p21-surface)',
                      color: 'var(--p21-ink)',
                      fontSize: 'var(--p21-text-base)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--p21-blue)'
                      e.currentTarget.style.background = 'var(--p21-blue-soft)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--p21-border)'
                      e.currentTarget.style.background = 'var(--p21-surface)'
                    }}
                  >
                    {c.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

const errBox: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--p21-coral-soft)',
  color: 'var(--p21-coral-ink)',
  borderRadius: 'var(--p21-radius-md)',
  fontSize: 'var(--p21-text-sm)',
  fontFamily: 'var(--p21-font-mono)',
}
const iconBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  border: 'none',
  background: 'transparent',
  color: 'var(--p21-ink-4)',
  cursor: 'pointer',
  borderRadius: 'var(--p21-radius-sm)',
  display: 'grid',
  placeItems: 'center',
}
