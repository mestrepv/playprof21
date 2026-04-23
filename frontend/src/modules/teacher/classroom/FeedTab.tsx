/**
 * Feed da turma — composer + posts com curtir/comentar/deletar.
 * Endpoints: /api/classrooms/{cid}/posts, /api/posts/{pid}/{comments,like}.
 */

import { useCallback, useEffect, useState } from 'react'

import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { HeartIcon, ChatIcon, TrashIcon } from '../../../components/ui/icons'
import { apiJson } from '../../lesson/runtime/apiFetch'
import type { FeedComment, FeedPost, FeedPostsPage } from '../types'
import { Avatar } from './StatDrawer'
import { timeAgo } from './timeAgo'

interface Props {
  classroomId: string
  token: string
  currentUserId: string
  currentUserName: string
  isOwner: boolean
}

const PAGE_LIMIT = 20

export function FeedTab({ classroomId, token, currentUserId, currentUserName, isOwner }: Props) {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const loadMore = useCallback(async () => {
    try {
      const offset = posts.length
      const page = await apiJson<FeedPostsPage>(
        `/api/classrooms/${classroomId}/posts?limit=${PAGE_LIMIT}&offset=${offset}`,
        { token },
      )
      setPosts((prev) => [...prev, ...page.posts])
      setHasMore(page.has_more)
      setLoaded(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setLoaded(true)
    }
  }, [classroomId, token, posts.length])

  useEffect(() => {
    // primeira carga
    ;(async () => {
      try {
        const page = await apiJson<FeedPostsPage>(
          `/api/classrooms/${classroomId}/posts?limit=${PAGE_LIMIT}&offset=0`,
          { token },
        )
        setPosts(page.posts)
        setHasMore(page.has_more)
        setLoaded(true)
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
        setLoaded(true)
      }
    })()
  }, [classroomId, token])

  const addPost = (post: FeedPost) => setPosts((prev) => [post, ...prev])
  const updatePost = (id: string, patch: Partial<FeedPost>) =>
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const removePost = (id: string) => setPosts((prev) => prev.filter((p) => p.id !== id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--p21-sp-4)' }}>
      <Composer
        classroomId={classroomId}
        token={token}
        authorName={currentUserName}
        onCreated={addPost}
      />
      {err && <div style={errBox}>{err}</div>}
      {loaded && posts.length === 0 && (
        <Card>
          <div style={{ color: 'var(--p21-ink-3)', textAlign: 'center', padding: 'var(--p21-sp-4)' }}>
            Ninguém postou ainda. Seja o primeiro!
          </div>
        </Card>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            token={token}
            currentUserId={currentUserId}
            canDelete={p.author.id === currentUserId || isOwner}
            onUpdate={(patch) => updatePost(p.id, patch)}
            onDelete={() => removePost(p.id)}
          />
        ))}
      </div>
      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <Button variant="outline" size="sm" onClick={loadMore}>
            ver mais
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Composer ──────────────────────────────────────────────────────────────

function Composer({
  classroomId,
  token,
  authorName,
  onCreated,
}: {
  classroomId: string
  token: string
  authorName: string
  onCreated: (p: FeedPost) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const content = text.trim()
    if (!content) return
    setBusy(true)
    try {
      const post = await apiJson<FeedPost>(`/api/classrooms/${classroomId}/posts`, {
        token,
        method: 'POST',
        json: { content },
      })
      onCreated(post)
      setText('')
      setExpanded(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card padded>
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textAlign: 'left',
          }}
        >
          <Avatar name={authorName} />
          <span
            style={{
              flex: 1,
              padding: '10px 16px',
              background: 'var(--p21-surface-2)',
              borderRadius: 999,
              color: 'var(--p21-ink-3)',
              fontSize: 'var(--p21-text-sm)',
            }}
          >
            No que você está pensando?
          </span>
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={authorName} />
            <span style={{ fontWeight: 600, fontSize: 'var(--p21-text-sm)' }}>{authorName}</span>
          </div>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Compartilhe algo com a turma…"
            maxLength={2000}
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid var(--p21-border-strong)',
              borderRadius: 'var(--p21-radius-md)',
              fontFamily: 'inherit',
              fontSize: 16,
              resize: 'vertical',
              minHeight: 100,
              background: 'var(--p21-surface)',
              color: 'var(--p21-ink)',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setExpanded(false)
                setText('')
              }}
              disabled={busy}
            >
              cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={submit} disabled={busy || !text.trim()}>
              {busy ? 'publicando…' : 'publicar'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Post card ─────────────────────────────────────────────────────────────

function PostCard({
  post,
  token,
  currentUserId,
  canDelete,
  onUpdate,
  onDelete,
}: {
  post: FeedPost
  token: string
  currentUserId: string
  canDelete: boolean
  onUpdate: (patch: Partial<FeedPost>) => void
  onDelete: () => void
}) {
  const [showComments, setShowComments] = useState(false)

  const toggleLike = async () => {
    const optimistic = !post.user_liked
    onUpdate({
      user_liked: optimistic,
      like_count: post.like_count + (optimistic ? 1 : -1),
    })
    try {
      const r = await apiJson<{ liked: boolean; like_count: number }>(
        `/api/posts/${post.id}/like`,
        { token, method: 'POST' },
      )
      onUpdate({ user_liked: r.liked, like_count: r.like_count })
    } catch {
      // revert
      onUpdate({ user_liked: post.user_liked, like_count: post.like_count })
    }
  }

  const del = async () => {
    if (!confirm('Apagar este post?')) return
    try {
      await apiJson(`/api/posts/${post.id}`, { token, method: 'DELETE' })
      onDelete()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Card padded>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <Avatar name={post.author.display_name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--p21-text-sm)' }}>{post.author.display_name}</div>
          <div style={{ fontSize: 'var(--p21-text-xs)', color: 'var(--p21-ink-4)' }}>
            {timeAgo(post.created_at)}
          </div>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={del}
            aria-label="apagar post"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--p21-ink-4)',
              cursor: 'pointer',
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 'var(--p21-radius-sm)',
            }}
          >
            <TrashIcon size={16} />
          </button>
        )}
      </div>
      <div
        style={{
          fontSize: 'var(--p21-text-base)',
          lineHeight: 1.55,
          marginBottom: 10,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {post.content}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderTop: '1px solid var(--p21-border)',
          paddingTop: 6,
        }}
      >
        <ActionBtn onClick={toggleLike} active={post.user_liked}>
          <HeartIcon size={16} filled={post.user_liked} />
          <span>{post.like_count}</span>
        </ActionBtn>
        <ActionBtn onClick={() => setShowComments((v) => !v)} active={false}>
          <ChatIcon size={16} />
          <span>{post.comment_count}</span>
        </ActionBtn>
      </div>
      {showComments && (
        <CommentsSection
          postId={post.id}
          token={token}
          currentUserId={currentUserId}
          onCountChange={(n) => onUpdate({ comment_count: n })}
          initialCount={post.comment_count}
        />
      )}
    </Card>
  )
}

function ActionBtn({
  onClick,
  active,
  children,
}: {
  onClick: () => void
  active: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '10px 12px',
        border: 'none',
        borderRadius: 'var(--p21-radius-sm)',
        background: 'transparent',
        color: active ? 'var(--p21-primary-ink)' : 'var(--p21-ink-3)',
        fontSize: 'var(--p21-text-sm)',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        minHeight: 40,
        fontFamily: 'inherit',
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--p21-surface-2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

// ── Comments ──────────────────────────────────────────────────────────────

function CommentsSection({
  postId,
  token,
  currentUserId,
  initialCount,
  onCountChange,
}: {
  postId: string
  token: string
  currentUserId: string
  initialCount: number
  onCountChange: (n: number) => void
}) {
  const [comments, setComments] = useState<FeedComment[] | null>(null)
  const [text, setText] = useState('')

  useEffect(() => {
    apiJson<FeedComment[]>(`/api/posts/${postId}/comments`, { token })
      .then(setComments)
      .catch(() => setComments([]))
  }, [postId, token])

  const submit = async (e: React.KeyboardEvent<HTMLInputElement> | React.FormEvent) => {
    if ('key' in e && e.key !== 'Enter') return
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    try {
      const c = await apiJson<FeedComment>(`/api/posts/${postId}/comments`, {
        token,
        method: 'POST',
        json: { content },
      })
      setComments((prev) => [...(prev ?? []), c])
      onCountChange(initialCount + 1)
      setText('')
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div
      style={{
        borderTop: '1px solid var(--p21-border)',
        marginTop: 6,
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {comments === null && <div style={{ color: 'var(--p21-ink-3)', fontSize: 13 }}>carregando…</div>}
      {comments && comments.length === 0 && (
        <div style={{ color: 'var(--p21-ink-3)', fontSize: 13 }}>seja o primeiro a comentar</div>
      )}
      {comments &&
        comments.map((c) => (
          <div key={c.id} style={{ display: 'flex', gap: 8 }}>
            <Avatar name={c.author.display_name} size={28} />
            <div
              style={{
                flex: 1,
                background: 'var(--p21-surface-2)',
                borderRadius: 14,
                padding: '8px 12px',
                minWidth: 0,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.author.display_name}</div>
              <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {c.content}
              </div>
              <div style={{ fontSize: 11, color: 'var(--p21-ink-4)', marginTop: 4 }}>
                {timeAgo(c.created_at)}
              </div>
            </div>
          </div>
        ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
        <Avatar name={currentUserId} size={28} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={submit}
          placeholder="Escreva um comentário e aperte Enter…"
          maxLength={1000}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1px solid var(--p21-border-strong)',
            borderRadius: 999,
            background: 'var(--p21-surface-2)',
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            minWidth: 0,
          }}
        />
      </div>
    </div>
  )
}

const errBox: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--p21-coral-soft)',
  color: 'var(--p21-coral-ink)',
  borderRadius: 'var(--p21-radius-md)',
  fontFamily: 'var(--p21-font-mono)',
  fontSize: 'var(--p21-text-sm)',
}
