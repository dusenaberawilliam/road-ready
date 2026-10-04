import { Download, NotebookPen, Pencil, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, PageHead, useToast } from '../../components/ui'
import { downloadFile, fmtDate, fmtTime } from '../../lib/util'
import { deleteNote, updateNote } from '../../store/actions'
import { useAppState, useMe } from '../../store/store'

export default function Notes() {
  const s = useAppState()
  const me = useMe()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<{ id: string; body: string } | null>(null)
  const notes = s.notes
    .filter((n) => n.userId === me.id)
    .filter((n) => !q || `${n.body} ${n.itemTitle} ${n.quote ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  const byTopic = s.topics.map((t) => ({ t, notes: notes.filter((n) => n.topicId === t.id) })).filter((x) => x.notes.length)

  const exportNotes = () => {
    const text = byTopic.map(({ t, notes }) => `# ${t.title}\n\n${notes.map((n) => `- ${n.itemTitle}${n.videoTime !== undefined ? ` (${fmtTime(n.videoTime)})` : ''}: ${n.quote ? `"${n.quote}" — ` : ''}${n.body}`).join('\n')}`).join('\n\n')
    downloadFile('my-revision-notes.md', text, 'text/markdown')
    toast('Revision notes downloaded')
  }

  return (
    <div>
      <PageHead
        title="My notes"
        sub="All your notes by topic — private to you. Use them for revision before the exam."
        actions={
          notes.length > 0 && (
            <button className="btn" onClick={exportNotes}>
              <Download size={16} /> Export for revision
            </button>
          )
        }
      />
      <div className="row mb">
        <Search size={16} className="faint" />
        <input className="input" placeholder="Search your notes…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {byTopic.length === 0 ? (
        <Empty title={q ? 'No notes match your search' : 'No notes yet'} icon={<NotebookPen />}>
          Add notes while watching a lesson video (pinned to the moment) or by highlighting text.
        </Empty>
      ) : (
        <div className="stack lg">
          {byTopic.map(({ t, notes }) => (
            <div key={t.id} className="card">
              <h2>{t.title}</h2>
              <div className="list">
                {notes.map((n) => (
                  <div key={n.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <div className="grow">
                      <Link to={`/app/learn/lesson/${n.itemId}${n.videoTime !== undefined ? `?t=${n.videoTime}` : ''}`} className="small bold">
                        {n.itemTitle}
                        {n.videoTime !== undefined && ` · ▶ ${fmtTime(n.videoTime)}`}
                      </Link>
                      {n.quote && (
                        <div className="small">
                          <mark className="hl">“{n.quote}”</mark>
                        </div>
                      )}
                      {edit?.id === n.id ? (
                        <div className="row mt">
                          <input className="input" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} autoFocus onKeyDown={(e) => e.key === 'Enter' && (updateNote(n.id, edit.body), setEdit(null))} />
                          <button className="btn sm primary" onClick={() => (updateNote(n.id, edit.body), setEdit(null), toast('Note updated'))}>
                            Save
                          </button>
                        </div>
                      ) : (
                        <div>{n.body}</div>
                      )}
                      <div className="tiny faint">{fmtDate(n.createdAt)}</div>
                    </div>
                    <button className="btn ghost icon" aria-label="Edit" onClick={() => setEdit({ id: n.id, body: n.body })}>
                      <Pencil size={15} />
                    </button>
                    <button className="btn ghost icon" aria-label="Delete" onClick={() => (deleteNote(n.id), toast('Note deleted', 'info'))}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
