import type { SignKind } from '../types'

// Vienna-convention road signs as used in Rwanda, drawn inline so questions
// and lessons work offline without image downloads.
const RED = '#d62828'
const BLUE = '#1f5fbf'

const Triangle = ({ children }: { children: React.ReactNode }) => (
  <>
    <path d="M50 6 L95 88 H5 Z" fill="#fff" stroke={RED} strokeWidth="9" strokeLinejoin="round" />
    {children}
  </>
)
const RedCircle = ({ children, fill = '#fff' }: { children?: React.ReactNode; fill?: string }) => (
  <>
    <circle cx="50" cy="50" r="42" fill={fill} stroke={RED} strokeWidth="10" />
    {children}
  </>
)
const BlueCircle = ({ children }: { children: React.ReactNode }) => (
  <>
    <circle cx="50" cy="50" r="46" fill={BLUE} />
    {children}
  </>
)

const Car = ({ x, y, fill = '#111', s = 1 }: { x: number; y: number; fill?: string; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
    <rect x="-9" y="-14" width="18" height="28" rx="5" />
    <rect x="-6" y="-9" width="12" height="7" rx="2" fill="#fff" opacity=".6" />
  </g>
)

function Glyph({ kind }: { kind: SignKind }) {
  switch (kind) {
    case 'stop':
      return (
        <>
          <path d="M31 4 H69 L96 31 V69 L69 96 H31 L4 69 V31 Z" fill={RED} stroke="#fff" strokeWidth="3" />
          <text x="50" y="60" textAnchor="middle" fontSize="27" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">
            STOP
          </text>
        </>
      )
    case 'give_way':
      return <path d="M5 12 H95 L50 92 Z" fill="#fff" stroke={RED} strokeWidth="9" strokeLinejoin="round" />
    case 'no_entry':
      return (
        <>
          <circle cx="50" cy="50" r="46" fill={RED} />
          <rect x="18" y="42" width="64" height="16" fill="#fff" rx="2" />
        </>
      )
    case 'speed_40':
    case 'speed_60':
      return (
        <RedCircle>
          <text x="50" y="63" textAnchor="middle" fontSize="38" fontWeight="800" fontFamily="Arial, sans-serif" fill="#111">
            {kind === 'speed_40' ? '40' : '60'}
          </text>
        </RedCircle>
      )
    case 'no_overtaking':
      return (
        <RedCircle>
          <Car x={36} y={52} fill={RED} />
          <Car x={64} y={52} fill="#111" />
        </RedCircle>
      )
    case 'no_parking':
      return (
        <>
          <circle cx="50" cy="50" r="42" fill={BLUE} stroke={RED} strokeWidth="10" />
          <line x1="22" y1="22" x2="78" y2="78" stroke={RED} strokeWidth="10" />
        </>
      )
    case 'roundabout':
      return (
        <BlueCircle>
          {[0, 120, 240].map((r) => (
            <g key={r} transform={`rotate(${r} 50 50)`}>
              <path d="M50 22 A28 28 0 0 1 74 36" fill="none" stroke="#fff" strokeWidth="8" />
              <path d="M69 26 L80 40 L63 42 Z" fill="#fff" />
            </g>
          ))}
        </BlueCircle>
      )
    case 'keep_right':
      return (
        <BlueCircle>
          <path d="M32 30 L62 60" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
          <path d="M72 44 V72 H44 Z" fill="#fff" />
        </BlueCircle>
      )
    case 'bend_right':
      return (
        <Triangle>
          <path d="M42 76 V58 Q42 46 54 40" fill="none" stroke="#111" strokeWidth="7" />
          <path d="M50 33 L63 36 L55 47 Z" fill="#111" />
        </Triangle>
      )
    case 'school':
      return (
        <Triangle>
          <circle cx="41" cy="44" r="5" fill="#111" />
          <path d="M37 50 h8 l3 14 l-4 14 h-4 l1 -12 l-4 12 h-4 l3 -14 Z" fill="#111" />
          <circle cx="60" cy="50" r="4" fill="#111" />
          <path d="M57 55 h6 l2 11 l-3 12 h-3 l1 -10 l-3 10 h-3 l2 -12 Z" fill="#111" />
        </Triangle>
      )
    case 'pedestrian':
      return (
        <Triangle>
          <circle cx="52" cy="38" r="6" fill="#111" />
          <path d="M48 46 L56 46 L60 62 L66 78 L60 79 L54 64 L48 79 L42 78 L47 62 L44 54 L38 60 L35 56 Z" fill="#111" />
        </Triangle>
      )
    case 'slippery':
      return (
        <Triangle>
          <Car x={50} y={52} s={0.9} />
          <path d="M36 76 q6 -6 0 -12 M64 76 q-6 -6 0 -12" stroke="#111" strokeWidth="3" fill="none" />
        </Triangle>
      )
    case 'traffic_lights':
      return (
        <Triangle>
          <rect x="41" y="34" width="18" height="44" rx="5" fill="#111" />
          <circle cx="50" cy="42" r="5" fill={RED} />
          <circle cx="50" cy="56" r="5" fill="#f5b400" />
          <circle cx="50" cy="70" r="5" fill="#1aa34a" />
        </Triangle>
      )
    case 'hospital':
      return (
        <>
          <rect x="6" y="6" width="88" height="88" rx="8" fill={BLUE} />
          <rect x="18" y="18" width="64" height="64" rx="4" fill="#fff" />
          <text x="50" y="68" textAnchor="middle" fontSize="48" fontWeight="800" fill={BLUE} fontFamily="Arial, sans-serif">
            H
          </text>
        </>
      )
    case 'priority_road':
      return (
        <g transform="rotate(45 50 50)">
          <rect x="16" y="16" width="68" height="68" fill="#fff" stroke="#111" strokeWidth="2" />
          <rect x="26" y="26" width="48" height="48" fill="#f5b400" />
        </g>
      )
  }
}

export const signNames: Record<SignKind, string> = {
  stop: 'Stop',
  give_way: 'Give way',
  no_entry: 'No entry',
  speed_40: 'Maximum speed 40 km/h',
  speed_60: 'Maximum speed 60 km/h',
  roundabout: 'Mandatory roundabout',
  school: 'Children / school',
  bend_right: 'Dangerous bend to the right',
  pedestrian: 'Pedestrian crossing ahead',
  no_overtaking: 'No overtaking',
  keep_right: 'Keep right',
  no_parking: 'No parking',
  hospital: 'Hospital',
  slippery: 'Slippery road',
  traffic_lights: 'Traffic signals ahead',
  priority_road: 'Priority road',
}

export default function RoadSign({ kind, size = 64, title }: { kind: SignKind; size?: number; title?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title ?? signNames[kind]}>
      <title>{title ?? signNames[kind]}</title>
      <Glyph kind={kind} />
    </svg>
  )
}
