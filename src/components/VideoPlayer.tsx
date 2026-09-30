import { Download, Pause, Play, RotateCcw, Subtitles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtTime } from '../lib/util'
import type { SceneKind, SignKind } from '../types'
import Scene from './Scene'

export interface Chapter {
  title: string
  text: string
}

export const LESSON_CHAPTERS = ['Road scene', 'What would you do?', 'The rule', 'Why it matters', 'See it on the road', 'Common trap', 'Tip of the day', 'Check yourself + road mission']

const SIZES: Record<string, number> = { '240p': 9, '360p': 16, '720p': 38 } // MB per 4 minutes

/**
 * Simulated streaming player (HLS stand-in): chapters matching the 8 lesson
 * blocks, 0.75×–2× speed, quality levels, subtitles, resume and offline download.
 */
export default function VideoPlayer({
  scene,
  sign,
  durationSec,
  chapters,
  startAt = 0,
  seekRequest,
  onProgress,
  onTime,
  downloaded,
  onDownload,
  defaultQuality = '360p',
  onChapterReplay,
  onSpeed,
}: {
  scene: SceneKind
  sign?: SignKind
  durationSec: number
  chapters: Chapter[]
  startAt?: number
  seekRequest?: { t: number; n: number }
  onProgress?: (pct: number, position: number) => void
  onTime?: (t: number) => void
  downloaded?: boolean
  onDownload?: (quality: string) => void
  defaultQuality?: '240p' | '360p' | '720p'
  onChapterReplay?: () => void
  onSpeed?: (s: number) => void
}) {
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(startAt >= durationSec - 1 ? 0 : startAt)
  const [speed, setSpeed] = useState(1)
  const [quality, setQuality] = useState(defaultQuality)
  const [subs, setSubs] = useState(true)
  const [buffering, setBuffering] = useState(false)
  const [downloading, setDownloading] = useState<number | null>(null)
  const maxSeen = useRef(startAt)
  const lastReport = useRef(0)
  const seekRef = useRef<HTMLDivElement>(null)
  const chapLen = durationSec / chapters.length
  const chapter = Math.min(chapters.length - 1, Math.floor(t / chapLen))

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setT((cur) => {
        const next = Math.min(durationSec, cur + 0.25 * speed)
        if (next >= durationSec) setPlaying(false)
        return next
      })
    }, 250)
    return () => clearInterval(id)
  }, [playing, speed, durationSec])

  useEffect(() => {
    maxSeen.current = Math.max(maxSeen.current, t)
    onTime?.(t)
    const pct = Math.round((maxSeen.current / durationSec) * 100)
    if (Math.abs(t - lastReport.current) >= 4 || t >= durationSec || !playing) {
      lastReport.current = t
      onProgress?.(pct >= 97 ? 100 : pct, t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, playing])

  useEffect(() => {
    if (seekRequest) {
      setT(Math.max(0, Math.min(durationSec - 0.5, seekRequest.t)))
      setPlaying(true)
    }
  }, [seekRequest, durationSec])

  // Adaptive streaming: briefly "buffer" when quality changes
  const changeQuality = (q: typeof quality) => {
    setQuality(q)
    setBuffering(true)
    setTimeout(() => setBuffering(false), 600)
  }

  const subtitle = useMemo(() => {
    const text = chapters[chapter]?.text ?? ''
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
    if (!sentences.length) return ''
    const within = (t - chapter * chapLen) / chapLen
    return sentences[Math.min(sentences.length - 1, Math.floor(within * sentences.length))]
  }, [chapters, chapter, t, chapLen])

  const seekFromEvent = (clientX: number) => {
    const rect = seekRef.current!.getBoundingClientRect()
    const to = ((clientX - rect.left) / rect.width) * durationSec
    if (to < t - 5) onChapterReplay?.()
    setT(Math.max(0, Math.min(durationSec, to)))
  }

  const jump = (i: number) => {
    if (i * chapLen < t) onChapterReplay?.()
    setT(i * chapLen + 0.01)
    setPlaying(true)
  }

  const startDownload = () => {
    if (downloaded || downloading !== null) return
    setDownloading(0)
    const id = setInterval(() => {
      setDownloading((d) => {
        const n = (d ?? 0) + 12
        if (n >= 100) {
          clearInterval(id)
          onDownload?.(quality)
          return null
        }
        return n
      })
    }, 180)
  }

  const size = Math.round((SIZES[quality] * durationSec) / 240)

  return (
    <div className="stack sm">
      <div className="player">
        <div className={`player-stage ${playing && !buffering ? '' : 'paused'}`}>
          <Scene kind={scene} sign={sign} animate />
          <div className="player-chapter">
            {chapter + 1}/{chapters.length} · {chapters[chapter]?.title}
          </div>
          <div className="player-quality">
            {buffering ? 'Buffering…' : `${quality} · HLS`}
            {downloaded ? ' · offline' : ''}
          </div>
          {subs && t > 0 && subtitle && <div className="player-sub">{subtitle}</div>}
          {!playing && (
            <button className="player-big" onClick={() => (t >= durationSec ? (setT(0), setPlaying(true)) : setPlaying(true))} aria-label="Play">
              <span>{t >= durationSec ? <RotateCcw size={30} /> : <Play size={32} fill="currentColor" />}</span>
            </button>
          )}
        </div>
        <div className="player-controls">
          <div
            className="seek"
            ref={seekRef}
            onClick={(e) => seekFromEvent(e.clientX)}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={durationSec}
            aria-valuenow={Math.round(t)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setT((x) => Math.min(durationSec, x + 5))
              if (e.key === 'ArrowLeft') setT((x) => Math.max(0, x - 5))
            }}
          >
            <div className="track" />
            <div className="fill" style={{ width: `${(t / durationSec) * 100}%` }} />
            {chapters.map((_, i) => i > 0 && <div key={i} className="mark" style={{ left: `${(i / chapters.length) * 100}%` }} />)}
            <div className="knob" style={{ left: `${(t / durationSec) * 100}%` }} />
          </div>
          <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <span className="small num">
            {fmtTime(t)} / {fmtTime(durationSec)}
          </span>
          <span className="grow" />
          <select
            value={speed}
            onChange={(e) => {
              setSpeed(Number(e.target.value))
              onSpeed?.(Number(e.target.value))
            }}
            aria-label="Playback speed"
          >
            {[0.75, 1, 1.25, 1.5, 2].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
          <select value={quality} onChange={(e) => changeQuality(e.target.value as typeof quality)} aria-label="Quality">
            {(['240p', '360p', '720p'] as const).map((q) => (
              <option key={q}>{q}</option>
            ))}
          </select>
          <button onClick={() => setSubs((s) => !s)} aria-pressed={subs} title="Subtitles">
            <Subtitles size={18} style={{ opacity: subs ? 1 : 0.45 }} />
          </button>
          {onDownload && (
            <button onClick={startDownload} title={downloaded ? 'Available offline' : `Download for offline (${size} MB)`}>
              <Download size={16} /> {downloaded ? 'Offline ✓' : downloading !== null ? `${downloading}%` : `${size} MB`}
            </button>
          )}
        </div>
      </div>
      {chapters.length > 1 && (
        <div className="chapters" aria-label="Chapters">
          {chapters.map((c, i) => (
            <button key={c.title} className={i === chapter ? 'on' : ''} onClick={() => jump(i)}>
              {fmtTime(i * chapLen)} {c.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
