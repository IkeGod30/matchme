import { useId, type ReactNode } from 'react'
import type { FeatureKey } from '../data/attributes'
import type { PhysicalProfile } from '../types'

// Hand-drawn SVG samples for every option in BODY_FEATURES (viewBox 0 0 100 100).

const SKIN = '#e0b08a'
const INK = '#2b2630'

const HAIR: Record<string, string> = {
  Black: '#1d1816',
  Brown: '#6b4426',
  Blonde: '#dfba68',
  Red: '#b0452a',
  Grey: '#b9b6b4',
}

const SKIN_TONES: Record<string, string> = {
  'Very fair': '#f7dcc8',
  Fair: '#ecc5a5',
  Medium: '#d3a07a',
  Olive: '#b58757',
  Brown: '#8a5737',
  Deep: '#583522',
}

const EYES: Record<string, string> = {
  Brown: '#6b3e1e',
  Blue: '#3c7ec4',
  Green: '#4b8b3b',
  Hazel: '#8f7434',
  Grey: '#87939b',
  Amber: '#c88a1c',
}

/* ---------- Full figure (height, body type) ---------- */

type Build = { shoulder: number; waist: number; hip: number; limb: number }

const BUILDS: Record<string, Build> = {
  Slim: { shoulder: 9.5, waist: 6, hip: 7.5, limb: 2.2 },
  Athletic: { shoulder: 16, waist: 8.5, hip: 10, limb: 3.4 },
  Average: { shoulder: 13, waist: 12, hip: 12.5, limb: 3.6 },
  Curvy: { shoulder: 12, waist: 7, hip: 18, limb: 4 },
  Muscular: { shoulder: 20, waist: 10, hip: 11, limb: 5.2 },
  'Plus-size': { shoulder: 16, waist: 19, hip: 20, limb: 5.8 },
}

function Figure({ height, build }: { height: number; build: Build }) {
  const base = 96
  const cx = 50
  const k = height / 80
  const top = base - height
  const headR = 7 * k
  const headCy = top + headR
  const shoulderY = headCy + headR + 4 * k
  const waistY = top + height * 0.45
  const hipY = top + height * 0.56
  const s = build.shoulder * k
  const w = build.waist * k
  const h = build.hip * k
  const l = build.limb * k
  const hipCtrlY = waistY + (hipY - waistY) * 0.4
  const torso = [
    `M${cx - s} ${shoulderY}`,
    `L${cx + s} ${shoulderY}`,
    `Q${cx + s} ${(shoulderY + waistY) / 2} ${cx + w} ${waistY}`,
    `Q${cx + h} ${hipCtrlY} ${cx + h} ${hipY}`,
    `L${cx - h} ${hipY}`,
    `Q${cx - h} ${hipCtrlY} ${cx - w} ${waistY}`,
    `Q${cx - s} ${(shoulderY + waistY) / 2} ${cx - s} ${shoulderY}`,
    'Z',
  ].join(' ')
  const handX = Math.max(s, h) + 3 * k

  return (
    <g className="fig" strokeLinecap="round" strokeLinejoin="round">
      <circle cx={cx} cy={headCy} r={headR} />
      <line x1={cx} y1={headCy} x2={cx} y2={shoulderY} strokeWidth={3.2 * k} />
      <path d={torso} strokeWidth={l} />
      {[-1, 1].map((side) => (
        <g key={side}>
          <line
            x1={cx + side * (s - l * 0.4)}
            y1={shoulderY + l * 0.5}
            x2={cx + side * handX}
            y2={hipY + 3 * k}
            strokeWidth={l * 1.6}
          />
          <line
            x1={cx + side * h * 0.5}
            y1={hipY - 1}
            x2={cx + side * (h * 0.5 + k)}
            y2={base - l}
            strokeWidth={l * 2.2}
          />
        </g>
      ))}
    </g>
  )
}

const BAND_HEIGHTS: Record<string, number> = { Petite: 54, Average: 66, Tall: 78, 'Very tall': 90 }

function HeightArt({ option }: { option: string }) {
  const height = BAND_HEIGHTS[option] ?? 66
  return (
    <>
      <g className="guide">
        <line x1={10} y1={6} x2={10} y2={96} />
        {[6, 24, 42, 60, 78, 96].map((y) => (
          <line key={y} x1={10} y1={y} x2={15} y2={y} />
        ))}
        <line x1={14} y1={96 - height} x2={88} y2={96 - height} strokeDasharray="3 3" />
      </g>
      <Figure height={height} build={BUILDS.Average} />
    </>
  )
}

/* ---------- Head (hair color, hair length, facial hair) ---------- */

type HairStyle = 'Bald' | 'Shaved' | 'Short' | 'Medium' | 'Long'

const CAP = 'M33 47 Q31 27 50 26.5 Q69 27 67 47 Q65 35 50 34 Q35 35 33 47Z'
const FRINGE = 'M33 50 Q30 25 50 25 Q70 25 67 50 Q64 38 56 35 Q46 40 36 40 Q34 44 33 50Z'
const MOUSTACHE = 'M41 59 Q46 54.5 50 57.5 Q54 54.5 59 59 Q54 60.5 50 59 Q46 60.5 41 59Z'
const BEARD = 'M33 50 Q33 80 50 82 Q67 80 67 50 Q65 64 58 65 Q50 61 42 65 Q35 64 33 50Z'

const STUBBLE: [number, number][] = []
for (let y = 55; y <= 72; y += 2.4) {
  for (let x = 34; x <= 66; x += 2.4) {
    const insideFace = ((x - 50) / 16) ** 2 + ((y - 50) / 20) ** 2 < 1
    const onMouth = Math.abs(y - 62.5) < 2 && Math.abs(x - 50) < 6
    if (insideFace && !onMouth) STUBBLE.push([x, y])
  }
}

interface HeadProps {
  hair: string
  style: HairStyle
  facial?: string
  skin?: string
  /** Iris color; omitted draws simple dot eyes. */
  eye?: string
  facialColor?: string
}

function Head({ hair, style, facial = 'None', skin = SKIN, eye, facialColor = HAIR.Brown }: HeadProps) {
  return (
    <>
      <path d="M16 100 Q18 80 50 78 Q82 80 84 100 Z" fill={skin} />
      <rect x={44} y={64} width={12} height={16} fill={skin} />
      {style === 'Long' && <path d="M29 92 Q20 22 50 22 Q80 22 71 92 Q60 86 50 88 Q40 86 29 92Z" fill={hair} />}
      {style === 'Medium' && <path d="M31 70 Q24 24 50 23 Q76 24 69 70 Z" fill={hair} />}
      <ellipse cx={50} cy={50} rx={17} ry={21} fill={skin} />
      {(style === 'Short' || style === 'Shaved') && (
        <path d={CAP} fill={hair} opacity={style === 'Shaved' ? 0.35 : 1} />
      )}
      {(style === 'Medium' || style === 'Long') && <path d={FRINGE} fill={hair} />}
      {style === 'Bald' && <ellipse cx={44} cy={35} rx={6} ry={3} fill="#fff" opacity={0.4} />}
      {eye ? (
        [44, 56].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={50} rx={3.2} ry={2.4} fill="#fff" />
            <circle cx={x} cy={50} r={1.9} fill={eye} />
            <circle cx={x} cy={50} r={0.8} fill="#111" />
          </g>
        ))
      ) : (
        <>
          <circle cx={44} cy={50} r={1.7} fill={INK} />
          <circle cx={56} cy={50} r={1.7} fill={INK} />
        </>
      )}
      {facial === 'Stubble' && (
        <g fill={facialColor} opacity={0.55}>
          {STUBBLE.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={0.6} />
          ))}
        </g>
      )}
      {facial === 'Beard' && <path d={BEARD} fill={facialColor} />}
      {(facial === 'Moustache' || facial === 'Beard') && <path d={MOUSTACHE} fill={facialColor} />}
      <path
        d="M45.5 63 Q50 65.5 54.5 63"
        fill="none"
        stroke={facial === 'Beard' ? skin : INK}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </>
  )
}

/* ---------- Other features ---------- */

function SkinToneArt({ tone }: { tone: string }) {
  return (
    <g fill={tone}>
      <path d="M16 100 Q18 74 50 72 Q82 74 84 100 Z" />
      <rect x={43} y={52} width={14} height={22} />
      <ellipse cx={50} cy={38} rx={17} ry={21} />
    </g>
  )
}

function EyeArt({ color }: { color: string }) {
  return (
    <>
      <path d="M8 50 Q50 12 92 50 Q50 88 8 50Z" fill="#fff" stroke={INK} strokeWidth={2.5} />
      <circle cx={50} cy={50} r={16} fill={color} />
      <circle cx={50} cy={50} r={15} fill="none" stroke="#000" strokeOpacity={0.25} strokeWidth={2} />
      <circle cx={50} cy={50} r={6.5} fill="#111" />
      <circle cx={55} cy={44.5} r={3} fill="#fff" opacity={0.9} />
    </>
  )
}

function TextureArt({ texture }: { texture: string }) {
  if (texture === 'None') {
    return (
      <g className="guide" strokeWidth={3}>
        <circle cx={50} cy={50} r={26} fill="none" />
        <line x1={32} y1={68} x2={68} y2={32} />
      </g>
    )
  }
  const strands: ReactNode[] = []
  if (texture === 'Straight') {
    for (const x of [22, 36, 50, 64, 78]) strands.push(<line key={x} x1={x} y1={12} x2={x} y2={88} />)
  } else if (texture === 'Wavy') {
    for (const x of [20, 35, 50, 65, 80]) strands.push(<path key={x} d={`M${x} 12 q 7 9.5 0 19 t 0 19 t 0 19 t 0 19`} />)
  } else {
    const curly = texture === 'Curly'
    const columns = curly ? [28, 50, 72] : [20, 35, 50, 65, 80]
    const count = curly ? 9 : 19
    for (const x of columns) {
      for (let i = 0; i < count; i++) {
        strands.push(
          <circle
            key={`${x}-${i}`}
            cx={x + (i % 2 ? 1 : -1) * (curly ? 3 : 1.6)}
            cy={curly ? 16 + i * 8.5 : 13 + i * 4.1}
            r={curly ? 5.5 : 2.3}
          />,
        )
      }
    }
  }
  return (
    <g stroke={HAIR.Brown} strokeWidth={2.6} fill="none" strokeLinecap="round">
      {strands}
    </g>
  )
}

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? inner : outer
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    return `${(cx + r * Math.cos(angle)).toFixed(1)} ${(cy + r * Math.sin(angle)).toFixed(1)}`
  })
  return `M${points.join(' L')}Z`
}

const HEART = 'M50 58 C38 49 41 39 47 40 C49 40.5 50 42 50 43.5 C50 42 51 40.5 53 40 C59 39 62 49 50 58Z'

function TattooArt({ amount }: { amount: string }) {
  return (
    <>
      <path d="M33 4 Q50 0 67 4 L63 96 Q50 100 37 96 Z" fill={SKIN} />
      {amount !== 'None' && <path d={HEART} fill="#c0394b" stroke={INK} strokeWidth={1.4} />}
      {amount === 'Many' && (
        <g stroke={INK} strokeWidth={1.6} fill="none" strokeLinecap="round">
          <path d={starPath(50, 22, 8, 3.4)} fill="#2f6fb0" />
          <path d="M42 68 q 4 -6 8 0 t 8 0" />
          <line x1={37} y1={80} x2={63.5} y2={80} strokeWidth={2.4} />
          <line x1={37} y1={88} x2={63} y2={88} strokeWidth={2.4} />
          <path d="M38 84 l 3 -3 l 3 3 l 3 -3 l 3 3 l 3 -3 l 3 3 l 3 -3 l 3 3" />
        </g>
      )}
    </>
  )
}

function renderArt(feature: FeatureKey, option: string, dye: string): ReactNode {
  switch (feature) {
    case 'height':
      return <HeightArt option={option} />
    case 'bodyType':
      return <Figure height={86} build={BUILDS[option] ?? BUILDS.Average} />
    case 'skinTone':
      return <SkinToneArt tone={SKIN_TONES[option] ?? SKIN} />
    case 'eyeColor':
      return <EyeArt color={EYES[option] ?? EYES.Brown} />
    case 'hairColor':
      return option === 'Bald' ? (
        <Head hair={HAIR.Brown} style="Bald" />
      ) : (
        <Head hair={option === 'Dyed' ? dye : (HAIR[option] ?? HAIR.Brown)} style="Medium" />
      )
    case 'hairLength':
      return <Head hair={HAIR.Brown} style={option as HairStyle} />
    case 'hairTexture':
      return <TextureArt texture={option} />
    case 'facialHair':
      return <Head hair={HAIR.Brown} style="Short" facial={option} />
    case 'tattoos':
      return <TattooArt amount={option} />
  }
}

function DyeGradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#9b5cff" />
        <stop offset="1" stopColor="#ff5c9a" />
      </linearGradient>
    </defs>
  )
}

const useGradientId = () => `dye${useId().replace(/[^\w-]/g, '')}`

export function FeatureArt({ feature, option, size = 88 }: { feature: FeatureKey; option: string; size?: number }) {
  const gradientId = useGradientId()
  return (
    <svg className="feature-art" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <DyeGradient id={gradientId} />
      {renderArt(feature, option, `url(#${gradientId})`)}
    </svg>
  )
}

/** Illustrated head-and-shoulders portrait built from someone's own physical profile. */
export function PortraitArt({ physical, size }: { physical: PhysicalProfile; size: number }) {
  const gradientId = useGradientId()
  const bald = physical.hairColor === 'Bald'
  const style: HairStyle = bald ? 'Bald' : ((physical.hairLength || 'Short') as HairStyle)
  const hair = physical.hairColor === 'Dyed' ? `url(#${gradientId})` : (HAIR[physical.hairColor] ?? HAIR.Brown)
  const facialColor = HAIR[physical.hairColor] ?? HAIR.Brown
  return (
    <svg viewBox="8 14 84 86" width={size} height={size} aria-hidden="true">
      <DyeGradient id={gradientId} />
      <Head
        hair={hair}
        style={style}
        facial={physical.facialHair}
        skin={SKIN_TONES[physical.skinTone] ?? SKIN}
        eye={EYES[physical.eyeColor] ?? EYES.Brown}
        facialColor={facialColor}
      />
    </svg>
  )
}
