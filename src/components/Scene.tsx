import type { SceneKind, SignKind } from '../types'
import RoadSign from './RoadSign'

// Illustrated Rwandan road scenes. Used as the video stage in the lesson
// player (animated) and as images in scenario questions (static).

const Moto = ({ x, y, rot = 0, color = '#e11d48' }: { x: number; y: number; rot?: number; color?: string }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <rect x="-4" y="-16" width="8" height="32" rx="4" fill="#222" />
    <rect x="-7" y="-6" width="14" height="14" rx="4" fill={color} />
    <circle cx="0" cy="0" r="6" fill="#16a34a" stroke="#fff" strokeWidth="1.5" />
  </g>
)
const Car = ({ x, y, rot = 0, color = '#2563eb', w = 26, h = 46 }: { x: number; y: number; rot?: number; color?: string; w?: number; h?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="7" fill={color} />
    <rect x={-w / 2 + 4} y={-h / 2 + 8} width={w - 8} height="10" rx="3" fill="#cfe3ff" opacity=".85" />
    <rect x={-w / 2 + 4} y={h / 2 - 14} width={w - 8} height="7" rx="3" fill="#cfe3ff" opacity=".6" />
  </g>
)
const Bus = ({ x, y, rot = 0 }: { x: number; y: number; rot?: number }) => <Car x={x} y={y} rot={rot} color="#0ea5e9" w={32} h={92} />
const Person = ({ x, y, color = '#7c3aed', s = 1 }: { x: number; y: number; color?: string; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle cx="0" cy="-14" r="6" fill="#5b3a29" />
    <rect x="-6" y="-8" width="12" height="18" rx="4" fill={color} />
    <rect x="-5" y="10" width="4" height="10" fill="#333" />
    <rect x="1" y="10" width="4" height="10" fill="#333" />
  </g>
)
const Hills = ({ night }: { night?: boolean }) => (
  <>
    <rect width="640" height="360" fill={night ? '#0b1726' : '#9ed27a'} />
    <path d="M0 90 Q120 20 240 80 T480 60 T640 90 V0 H0Z" fill={night ? '#0e1f35' : '#bfe3f5'} />
    <path d="M0 110 Q160 50 300 100 T640 95 V130 H0Z" fill={night ? '#132b1f' : '#6fb257'} opacity=".8" />
  </>
)

function Base({ kind, animate }: { kind: SceneKind; animate: boolean }) {
  const mv = animate ? 'anim-move' : ''
  const mvs = animate ? 'anim-move-slow' : ''
  switch (kind) {
    case 'roundabout':
      return (
        <>
          <rect width="640" height="360" fill="#8fc46e" />
          <rect x="285" y="0" width="70" height="360" fill="#4b5451" />
          <rect x="0" y="145" width="640" height="70" fill="#4b5451" />
          <circle cx="320" cy="180" r="118" fill="#4b5451" />
          <circle cx="320" cy="180" r="58" fill="#6fb257" stroke="#e5e7eb" strokeWidth="5" />
          <circle cx="320" cy="180" r="88" fill="none" stroke="#e5e7eb" strokeWidth="2" strokeDasharray="12 10" />
          <path d="M285 300 H355" stroke="#fff" strokeWidth="4" strokeDasharray="10 6" />
          <g className={animate ? 'anim-orbit' : ''}>
            <Car x={320} y={80} rot={-90} color="#dc2626" />
            <Moto x={410} y={170} rot={0} color="#f59e0b" />
            <Moto x={240} y={230} rot={180} />
          </g>
          <Moto x={335} y={330} rot={0} color="#0ea5e9" />
          <text x="335" y="355" textAnchor="middle" fontSize="11" fill="#fff" fontWeight="700">YOU</text>
        </>
      )
    case 'junction':
    case 'police':
      return (
        <>
          <rect width="640" height="360" fill="#a7cf86" />
          <rect x="0" y="140" width="640" height="80" fill="#4b5451" />
          <rect x="280" y="0" width="80" height="360" fill="#4b5451" />
          <path d="M0 180 H270 M370 180 H640" stroke="#fff" strokeWidth="3" strokeDasharray="16 12" />
          <path d="M320 0 V130 M320 230 V360" stroke="#fff" strokeWidth="3" strokeDasharray="16 12" />
          <rect x="60" y="30" width="90" height="70" fill="#e7d7c1" />
          <rect x="470" y="250" width="110" height="80" fill="#d9c6a8" />
          <g className={mv}>
            <Car x={40} y={200} rot={90} color="#dc2626" />
          </g>
          <Moto x={340} y={300} rot={0} color="#0ea5e9" />
          <text x="340" y="345" textAnchor="middle" fontSize="11" fill="#fff" fontWeight="700">YOU</text>
          {kind === 'police' ? (
            <g transform="translate(320 180)">
              <circle r="22" fill="#fff" opacity=".85" />
              <Person x={0} y={4} color="#1e3a8a" s={1.2} />
              <rect x="-3" y="-44" width="6" height="30" fill="#1e3a8a" />
              <rect x="-5" y="-48" width="10" height="6" rx="2" fill="#fff" />
            </g>
          ) : (
            <g className={mvs}>
              <Car x={0} y={160} rot={90} color="#f59e0b" />
            </g>
          )}
        </>
      )
    case 'zebra':
      return (
        <>
          <rect width="640" height="360" fill="#d6d3cc" />
          <rect x="0" y="120" width="640" height="130" fill="#4b5451" />
          {Array.from({ length: 8 }).map((_, i) => (
            <rect key={i} x="290" y={126 + i * 15} width="60" height="9" fill="#f8fafc" />
          ))}
          <path d="M0 185 H280 M360 185 H640" stroke="#fff" strokeWidth="3" strokeDasharray="18 12" />
          <rect x="40" y="20" width="160" height="80" fill="#fcd34d" />
          <text x="120" y="66" textAnchor="middle" fontSize="16" fontWeight="800" fill="#7c2d12">SCHOOL</text>
          <Person x={320} y={112} color="#16a34a" />
          <Person x={336} y={112} color="#16a34a" s={0.75} />
          <Person x={460} y={280} color="#7c3aed" />
          <g className={mv}>
            <Car x={0} y={215} rot={90} color="#2563eb" />
          </g>
        </>
      )
    case 'bend':
      return (
        <>
          <Hills />
          <path d="M120 360 C140 250 200 190 330 170 S560 120 640 100" fill="none" stroke="#4b5451" strokeWidth="70" />
          <path d="M120 360 C140 250 200 190 330 170 S560 120 640 100" fill="none" stroke="#fff" strokeWidth="3" />
          <Bus x={260} y={200} rot={-65} />
          <Moto x={170} y={300} rot={-20} color="#0ea5e9" />
          <text x="150" y="345" fontSize="11" fill="#fff" fontWeight="700">YOU</text>
          <g className={mvs}>
            <Car x={0} y={128} rot={80} color="#dc2626" />
          </g>
        </>
      )
    case 'night':
      return (
        <>
          <Hills night />
          <rect x="0" y="190" width="640" height="110" fill="#1f2937" />
          <path d="M0 245 H640" stroke="#fef3c7" strokeWidth="3" strokeDasharray="18 14" opacity=".6" />
          <polygon points="80,270 260,230 260,300" fill="#fef9c3" opacity=".22" />
          <Car x={60} y={270} rot={90} color="#374151" />
          <g className={mvs}>
            <polygon points="620,215 440,190 440,250" fill="#fef9c3" opacity=".35" />
            <rect x="620" y="200" width="70" height="34" rx="6" fill="#7f1d1d" />
          </g>
          <circle cx="560" cy="60" r="18" fill="#fef3c7" />
          <g className={animate ? 'anim-blink' : ''}>
            <circle cx="36" cy="258" r="4" fill="#f59e0b" />
            <circle cx="36" cy="282" r="4" fill="#f59e0b" />
          </g>
        </>
      )
    case 'accident':
      return (
        <>
          <rect width="640" height="360" fill="#a7cf86" />
          <rect x="0" y="130" width="640" height="110" fill="#4b5451" />
          <path d="M0 185 H640" stroke="#fff" strokeWidth="3" strokeDasharray="16 12" />
          <Car x={330} y={170} rot={70} color="#2563eb" />
          <Moto x={380} y={205} rot={110} />
          <Person x={410} y={225} color="#e11d48" s={0.9} />
          <path d="M150 230 L165 205 L180 230 Z" fill="none" stroke="#dc2626" strokeWidth="5" />
          <g className={animate ? 'anim-blink' : ''}>
            <circle cx="312" cy="150" r="4" fill="#f59e0b" />
            <circle cx="348" cy="190" r="4" fill="#f59e0b" />
          </g>
          <Person x={120} y={120} color="#0277B5" />
          <rect x="128" y="96" width="10" height="16" rx="2" fill="#111" />
        </>
      )
    case 'road':
    default:
      return (
        <>
          <Hills />
          <rect x="0" y="170" width="640" height="120" fill="#4b5451" />
          <path d="M0 230 H640" stroke="#fff" strokeWidth="3" strokeDasharray="20 14" />
          <rect x="0" y="286" width="640" height="6" fill="#b45309" opacity=".5" />
          <g className={mv}>
            <Car x={0} y={255} rot={90} color="#dc2626" />
          </g>
          <g className={mvs}>
            <Moto x={-60} y={205} rot={90} color="#f59e0b" />
          </g>
          <Moto x={110} y={262} rot={90} color="#0ea5e9" />
          <text x="110" y="300" textAnchor="middle" fontSize="11" fill="#fff" fontWeight="700">YOU</text>
          <Person x={560} y={165} color="#9333ea" />
        </>
      )
  }
}

export default function Scene({ kind, sign, animate = false, className }: { kind: SceneKind; sign?: SignKind; animate?: boolean; className?: string }) {
  return (
    <svg className={`scene ${className ?? ''}`} viewBox="0 0 640 360" role="img" aria-label={`Road scene: ${kind}`} preserveAspectRatio="xMidYMid slice">
      <Base kind={kind} animate={animate} />
      {sign && (
        <g transform="translate(540 18)">
          <rect x="37" y="70" width="6" height="70" fill="#9ca3af" />
          <RoadSign kind={sign} size={80} />
        </g>
      )}
    </svg>
  )
}
