import { useId, type ReactNode } from 'react'
import type { FeatureKey } from '../data/attributes'
import type { PhysicalProfile } from '../types'
import {
  BodyTypeArt,
  BottomShapeArt,
  BottomSizeArt,
  BustSizeArt,
  ChestArt,
  HeightArt,
  type FigureSex,
} from './silhouettes'

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

/* ---------- Lips (body silhouettes live in silhouettes.tsx) ---------- */

const LIP_FULLNESS: Record<string, [upper: number, lower: number]> = {
  Thin: [3.5, 5.5],
  Medium: [6.5, 9.5],
  Full: [9.5, 13.5],
  'Very full': [12.5, 17.5],
}

function LipsArt({ option }: { option: string }) {
  const [u, l] = LIP_FULLNESS[option] ?? LIP_FULLNESS.Medium
  return (
    <>
      <rect x={8} y={18} width={84} height={64} rx={14} fill={SKIN} />
      <path
        d={`M20 50 C28 ${50 - u}, 40 ${50 - u - 2}, 50 ${50 - u + 3} C60 ${50 - u - 2}, 72 ${50 - u}, 80 50 Q50 53 20 50Z`}
        fill="#a8475a"
      />
      <path d={`M20 50 Q50 53 80 50 C73 ${50 + l}, 27 ${50 + l}, 20 50Z`} fill="#bd5a6c" />
      <path d="M20 50 Q50 53 80 50" fill="none" stroke="#6e2a38" strokeWidth={1.2} />
      <ellipse cx={50} cy={50 + l * 0.45} rx={9} ry={l * 0.14 + 0.5} fill="#fff" opacity={0.25} />
    </>
  )
}

function renderArt(feature: FeatureKey, option: string, dye: string, figure: FigureSex): ReactNode {
  switch (feature) {
    case 'lips':
      return <LipsArt option={option} />
    case 'bustSize':
      return <BustSizeArt option={option} />
    case 'buttSize':
      return <BottomSizeArt option={option} />
    case 'buttShape':
      return <BottomShapeArt option={option} />
    case 'chest':
      return <ChestArt option={option} />
    case 'height':
      return <HeightArt option={option} sex={figure} />
    case 'bodyType':
      return <BodyTypeArt option={option} sex={figure} />
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

interface FeatureArtProps {
  feature: FeatureKey
  option: string
  size?: number
  /** Which body to draw for height and body type (bust, bottom and chest pictures are fixed). */
  figure?: FigureSex
}

export function FeatureArt({ feature, option, size = 88, figure = 'female' }: FeatureArtProps) {
  const gradientId = useGradientId()
  return (
    <svg className="feature-art" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <DyeGradient id={gradientId} />
      {renderArt(feature, option, `url(#${gradientId})`, figure)}
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
