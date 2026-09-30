import { Award, EyeOff, Flag, Heart, ImagePlus, MessageSquare, MoreHorizontal, Pin, Search, ShieldCheck, ThumbsUp, Trash2, VolumeX } from 'lucide-react'
import { useState } from 'react'
import { addPost, markBest, moderatePost, muteUser, reportPost, toggleReaction } from '../store/actions'
import { useAppState, useMe } from '../store/store'
import { fmtTime, relTime } from '../lib/util'
import type { Post, User } from '../types'
import { Avatar, Badge, Empty, Modal, useToast } from './ui'

const roleTag = (u?: User) =>
  u?.role === 'teacher' ? 'Teacher' : u?.role === 'school_admin' ? 'School admin' : u?.role === 'content_editor' ? 'Content team' : u?.role === 'super_admin' ? 'Platform' : null

export default function Thread({
  spaceId,
  canPost = true,
  canModerate = false,
  videoTime,
  onSeek,
  placeholder = 'Ask a question or share what you learned…',
  emptyText = 'No comments yet. Be the first to ask!',
}: {
  spaceId: string
  canPost?: boolean
  canModerate?: boolean
  videoTime?: number
  onSeek?: (t: number) => void
  placeholder?: string
  emptyText?: string
}) {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const [q, setQ] = useState('')
  const all = s.posts.filter((p) => p.spaceId === spaceId && p.status !== 'deleted')
  const visible = (p: Post) => p.status === 'visible' || canModerate || (p.authorId === me.id && p.status === 'held')
  const top = all
        .filter((p) => !p.parentId && visible(p))
        .filter((p) => !q || p.body.toLowerCase().includes(q.toLowerCase()) || all.some((r) => r.parentId === p.id && r.body.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt.localeCompare(a.createdAt))
  const muted = me.mutedUntil && new Date(me.mutedUntil).getTime() > Date.now()

  return (
    <div className="stack">
      {all.length > 3 && (
        <div className="row">
          <Search size={16} className="faint" />
          <input className="input" placeholder="Search this discussion…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      {canPost && !muted && <Composer spaceId={spaceId} videoTime={videoTime} placeholder={placeholder} onPosted={(held, reason) => toast(held ? `Held for teacher review: ${reason}` : 'Posted', held ? 'info' : 'success')} />}
      {muted && <div className="callout warning small">Posting is paused until {new Date(me.mutedUntil!).toLocaleDateString('en-GB')} after repeated rule violations.</div>}
      {!canPost && <div className="callout small">Read-only at launch. Individual learner community is coming later.</div>}
      {top.length === 0 ? (
        <Empty title={q ? 'No matching posts' : emptyText} icon={<MessageSquare />} />
      ) : (
        <div>
          {top.map((p) => (
            <PostItem key={p.id} post={p} replies={all.filter((r) => r.parentId === p.id && visible(r))} canModerate={canModerate} canPost={canPost && !muted} onSeek={onSeek} />
          ))}
        </div>
      )}
    </div>
  )
}

function Composer({ spaceId, parentId, videoTime, placeholder, onPosted, onDone }: { spaceId: string; parentId?: string; videoTime?: number; placeholder: string; onPosted: (held: boolean, reason?: string) => void; onDone?: () => void }) {
  const me = useMe()
  const [body, setBody] = useState('')
  const [atTime, setAtTime] = useState(false)
  const [image, setImage] = useState<string | undefined>()
  const toast = useToast()
  const submit = () => {
    if (!body.trim()) return
    const r = addPost({ spaceId, authorId: me.id, body: body.trim(), parentId, videoTime: atTime && videoTime !== undefined ? Math.round(videoTime) : undefined, image })
    setBody('')
    setImage(undefined)
    setAtTime(false)
    onPosted(r.held, r.reason)
    onDone?.()
  }
  return (
    <div className="stack sm" style={parentId ? { marginLeft: 36 } : undefined}>
      <textarea className="input" rows={parentId ? 2 : 3} placeholder={placeholder} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && submit()} />
      {image && (
        <div className="row">
          <img src={image} alt="Attachment preview" style={{ maxHeight: 80, borderRadius: 8 }} />
          <button className="btn sm ghost" onClick={() => setImage(undefined)}>
            Remove
          </button>
        </div>
      )}
      <div className="row wrap">
        <label className="btn sm ghost" style={{ cursor: 'pointer' }}>
          <ImagePlus size={15} /> Photo
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              if (f.size > 5 * 1024 * 1024) return toast('Images must be under 5 MB', 'error')
              const r = new FileReader()
              r.onload = () => setImage(String(r.result))
              r.readAsDataURL(f)
            }}
          />
        </label>
        {videoTime !== undefined && videoTime > 0 && (
          <label className="check small">
            <input type="checkbox" checked={atTime} onChange={(e) => setAtTime(e.target.checked)} /> Link to video at {fmtTime(videoTime)}
          </label>
        )}
        <span className="grow" />
        {onDone && (
          <button className="btn sm ghost" onClick={onDone}>
            Cancel
          </button>
        )}
        <button className="btn sm primary" onClick={submit} disabled={!body.trim()}>
          {parentId ? 'Reply' : 'Post'}
        </button>
      </div>
    </div>
  )
}

function PostItem({ post, replies, canModerate, canPost, onSeek, isReply }: { post: Post; replies: Post[]; canModerate: boolean; canPost: boolean; onSeek?: (t: number) => void; isReply?: boolean }) {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const [replying, setReplying] = useState(false)
  const [menu, setMenu] = useState(false)
  const [reporting, setReporting] = useState(false)
  const author = s.users.find((u) => u.id === post.authorId)
  const tag = roleTag(author)
  const root = post.parentId ? s.posts.find((p) => p.id === post.parentId) : undefined
  const canMarkBest = isReply && (canModerate || root?.authorId === me.id)
  return (
    <>
      <div className={`post ${isReply ? 'reply' : ''} ${post.best ? 'best' : ''} ${tag ? 'teacher' : ''}`}>
        <Avatar name={author?.name ?? '?'} size="sm" />
        <div className="body">
          <div className="row wrap small" style={{ gap: 6, marginBottom: 3 }}>
            <strong>{author?.name ?? 'Deleted user'}</strong>
            {tag && <Badge tone="primary">{tag}</Badge>}
            {post.pinned && (
              <Badge tone="info">
                <Pin size={11} /> Pinned
              </Badge>
            )}
            {post.best && (
              <Badge tone="success">
                <Award size={11} /> Best answer
              </Badge>
            )}
            {post.status === 'held' && <Badge tone="warning">Held for review{post.flagReason ? ` · ${post.flagReason}` : ''}</Badge>}
            {post.status === 'hidden' && <Badge tone="danger">Hidden</Badge>}
            {canModerate && post.reports.length > 0 && <Badge tone="danger">{post.reports.length} report(s)</Badge>}
            <span className="faint">{relTime(post.createdAt)}</span>
          </div>
          <div className="bubble">
            {post.videoTime !== undefined && (
              <button className="linkbtn small" onClick={() => onSeek?.(post.videoTime!)} disabled={!onSeek}>
                ▶ at {fmtTime(post.videoTime)}
              </button>
            )}{' '}
            {post.body}
            {post.image && <img src={post.image} alt="Attached by author" style={{ display: 'block', maxWidth: 260, borderRadius: 8, marginTop: 6 }} />}
          </div>
          <div className="post-actions">
            <button className={post.helpful.includes(me.id) ? 'on' : ''} onClick={() => toggleReaction(post.id, me.id, 'helpful')}>
              <ThumbsUp size={12} /> Helpful {post.helpful.length || ''}
            </button>
            <button className={post.thanks.includes(me.id) ? 'on' : ''} onClick={() => toggleReaction(post.id, me.id, 'thanks')}>
              <Heart size={12} /> Thanks {post.thanks.length || ''}
            </button>
            {!isReply && canPost && <button onClick={() => setReplying(true)}>Reply</button>}
            {canMarkBest && !post.best && (
              <button
                onClick={() => {
                  markBest(post.id, me.id)
                  toast('Marked as best answer')
                }}
              >
                <Award size={12} /> Mark best
              </button>
            )}
            {post.authorId !== me.id && (
              <button onClick={() => setReporting(true)}>
                <Flag size={12} /> Report
              </button>
            )}
            {canModerate && (
              <span style={{ position: 'relative' }}>
                <button onClick={() => setMenu((m) => !m)} aria-label="Moderate">
                  <MoreHorizontal size={14} /> Moderate
                </button>
                {menu && (
                  <div className="card tight stack sm" style={{ position: 'absolute', zIndex: 10, top: 20, left: 0, width: 200 }} onMouseLeave={() => setMenu(false)}>
                    {post.status === 'held' && (
                      <button className="btn sm" onClick={() => (moderatePost(post.id, me.id, 'approve'), toast('Approved and published'))}>
                        <ShieldCheck size={14} /> Approve
                      </button>
                    )}
                    {!isReply && (
                      <button className="btn sm" onClick={() => (moderatePost(post.id, me.id, post.pinned ? 'unpin' : 'pin'), setMenu(false))}>
                        <Pin size={14} /> {post.pinned ? 'Unpin' : 'Pin'}
                      </button>
                    )}
                    {post.reports.length > 0 && (
                      <button className="btn sm" onClick={() => (moderatePost(post.id, me.id, 'dismiss_reports'), toast('Reports dismissed'))}>
                        Dismiss reports
                      </button>
                    )}
                    <button className="btn sm" onClick={() => (moderatePost(post.id, me.id, 'hide'), toast('Post hidden'))}>
                      <EyeOff size={14} /> Hide
                    </button>
                    <button className="btn sm" onClick={() => (moderatePost(post.id, me.id, 'delete'), toast('Post deleted'))}>
                      <Trash2 size={14} /> Delete
                    </button>
                    {author && author.id !== me.id && (
                      <button className="btn sm" onClick={() => (muteUser(author.id, me.id, 7), toast(`${author.name} muted for 7 days`))}>
                        <VolumeX size={14} /> Mute author 7 days
                      </button>
                    )}
                  </div>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
      {replies
        .sort((a, b) => Number(!!b.best) - Number(!!a.best) || a.createdAt.localeCompare(b.createdAt))
        .map((r) => (
          <PostItem key={r.id} post={r} replies={[]} canModerate={canModerate} canPost={canPost} onSeek={onSeek} isReply />
        ))}
      {replying && <Composer spaceId={post.spaceId} parentId={post.id} placeholder={`Reply to ${author?.name ?? ''}… (tip: @mention your teacher)`} onPosted={(held, reason) => toast(held ? `Held for teacher review: ${reason}` : 'Reply posted', held ? 'info' : 'success')} onDone={() => setReplying(false)} />}
      {reporting && (
        <Modal title="Report this post" onClose={() => setReporting(false)}>
          <div className="stack">
            <p className="small muted">"{post.body.slice(0, 120)}"</p>
            {['Insult or harassment', 'Personal data (phone, ID)', 'Spam or selling answers', 'Wrong information'].map((r) => (
              <button
                key={r}
                className="btn"
                onClick={() => {
                  reportPost(post.id, me.id, r)
                  setReporting(false)
                  toast('Reported to your teacher')
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}
