// Realistic body silhouettes for the bodily-feature pictures (viewBox 0 0 100 100).
// Outlines are smooth Catmull-Rom splines through measured contour points, expressed
// in units of total body height so every figure keeps natural human proportions.

export type FigureSex = 'female' | 'male'

type Pt = [number, number]

/** Smooth closed path through the points (Catmull-Rom converted to cubic Béziers). */
function closedSpline(pts: Pt[]): string {
  const n = pts.length
  const f = (v: number) => v.toFixed(2)
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`
  }
  return `${d}Z`
}

/** Mirrors a right-hand contour (top → crotch) into a full symmetric outline. */
function mirrored(right: Pt[]): Pt[] {
  const left = right.slice(0, -1).reverse().map(([u, v]): Pt => [-u, v])
  return [...right, ...left]
}

/* ---------- Front view (height, body type, chest) ---------- */

/** Half-widths as a fraction of body height. `bust` is the chest for men. */
export interface Build {
  sh: number
  bust: number
  waist: number
  hip: number
  thigh: number
  knee: number
  calf: number
  arm: number
}

const FEMALE_BUILDS: Record<string, Build> = {
  Slim: { sh: 0.092, bust: 0.076, waist: 0.056, hip: 0.084, thigh: 0.06, knee: 0.034, calf: 0.034, arm: 0.021 },
  Athletic: { sh: 0.102, bust: 0.084, waist: 0.064, hip: 0.09, thigh: 0.067, knee: 0.039, calf: 0.042, arm: 0.026 },
  Average: { sh: 0.098, bust: 0.088, waist: 0.074, hip: 0.098, thigh: 0.072, knee: 0.041, calf: 0.041, arm: 0.027 },
  Curvy: { sh: 0.096, bust: 0.097, waist: 0.064, hip: 0.118, thigh: 0.082, knee: 0.044, calf: 0.043, arm: 0.028 },
  Muscular: { sh: 0.113, bust: 0.092, waist: 0.073, hip: 0.098, thigh: 0.078, knee: 0.045, calf: 0.05, arm: 0.033 },
  'Plus-size': { sh: 0.106, bust: 0.112, waist: 0.104, hip: 0.128, thigh: 0.09, knee: 0.054, calf: 0.052, arm: 0.037 },
}

const MALE_BUILDS: Record<string, Build> = {
  Slim: { sh: 0.106, bust: 0.08, waist: 0.064, hip: 0.072, thigh: 0.057, knee: 0.036, calf: 0.035, arm: 0.023 },
  Athletic: { sh: 0.127, bust: 0.1, waist: 0.07, hip: 0.079, thigh: 0.066, knee: 0.04, calf: 0.042, arm: 0.03 },
  Average: { sh: 0.118, bust: 0.097, waist: 0.087, hip: 0.087, thigh: 0.067, knee: 0.041, calf: 0.04, arm: 0.029 },
  Curvy: { sh: 0.115, bust: 0.1, waist: 0.084, hip: 0.1, thigh: 0.075, knee: 0.044, calf: 0.043, arm: 0.03 },
  Muscular: { sh: 0.142, bust: 0.116, waist: 0.079, hip: 0.085, thigh: 0.076, knee: 0.046, calf: 0.05, arm: 0.04 },
  'Plus-size': { sh: 0.13, bust: 0.12, waist: 0.12, hip: 0.114, thigh: 0.085, knee: 0.051, calf: 0.049, arm: 0.039 },
}

function frontContour(b: Build, sex: FigureSex): Pt[] {
  const neck = sex === 'female' ? 0.026 : 0.033
  const crotch = sex === 'female' ? 0.515 : 0.505
  return mirrored([
    [neck, 0.118],
    [neck + 0.004, 0.148],
    [b.sh * 0.72, 0.163],
    [b.sh, 0.186],
    [Math.max(b.bust * 0.98, b.sh * 0.86), 0.228],
    [b.bust, 0.27],
    [(b.bust + b.waist) / 2, 0.322],
    [b.waist, 0.375],
    [(b.waist + b.hip) / 2 + 0.006, 0.432],
    [b.hip, 0.49],
    [b.thigh + 0.006, 0.56],
    [(b.thigh + b.knee) / 2 + 0.005, 0.65],
    [b.knee, 0.725],
    [b.calf, 0.8],
    [(b.calf + 0.027) / 2, 0.885],
    [0.026, 0.95],
    [0.036, 0.978],
    [0.042, 0.994],
    [0.018, 0.998],
    [0.01, 0.988],
    [0.012, 0.95],
    [Math.max(0.014, b.calf - 0.032), 0.82],
    [Math.max(0.01, b.knee - 0.03), 0.725],
    [Math.max(0.006, b.thigh - 0.062), 0.6],
    [0, crotch],
  ])
}

interface FrontFigureProps {
  build: Build
  sex: FigureSex
  /** Body height in viewBox units. */
  height: number
  /** y of the top of the head; defaults to standing on a baseline at y = 97. */
  top?: number
}

export function FrontFigure({ build: b, sex, height: H, top = 97 - H }: FrontFigureProps) {
  const x = (u: number) => 50 + u * H
  const y = (v: number) => top + v * H
  const P = ([u, v]: Pt): Pt => [x(u), y(v)]
  const elbowU = Math.max(b.bust * 0.95, b.waist) + b.arm
  const wristU = b.hip + b.arm * 0.9

  return (
    <g className="fig" strokeLinecap="round" strokeLinejoin="round">
      {sex === 'female' && <ellipse cx={x(0)} cy={y(0.088)} rx={0.051 * H} ry={0.08 * H} />}
      <ellipse cx={x(0)} cy={y(0.063)} rx={(sex === 'female' ? 0.041 : 0.044) * H} ry={(sex === 'female' ? 0.056 : 0.059) * H} />
      <path d={closedSpline(frontContour(b, sex).map(P))} strokeWidth={0.4} />
      {[-1, 1].map((s) => (
        <g key={s}>
          <line x1={x(s * (b.sh - b.arm * 0.7))} y1={y(0.2)} x2={x(s * elbowU)} y2={y(0.37)} strokeWidth={b.arm * 2.1 * H} />
          <line x1={x(s * elbowU)} y1={y(0.37)} x2={x(s * wristU)} y2={y(0.5)} strokeWidth={b.arm * 1.7 * H} />
          <line x1={x(s * wristU)} y1={y(0.5)} x2={x(s * (wristU - 0.004))} y2={y(0.555)} strokeWidth={b.arm * 1.5 * H} />
        </g>
      ))}
    </g>
  )
}

const BAND_HEIGHTS: Record<string, number> = { Petite: 56, Average: 68, Tall: 80, 'Very tall': 92 }

export function HeightArt({ option, sex }: { option: string; sex: FigureSex }) {
  const height = BAND_HEIGHTS[option] ?? 68
  const build = (sex === 'female' ? FEMALE_BUILDS : MALE_BUILDS).Average
  return (
    <>
      <g className="guide">
        <line x1={10} y1={5} x2={10} y2={97} />
        {[5, 23.4, 41.8, 60.2, 78.6, 97].map((ty) => (
          <line key={ty} x1={10} y1={ty} x2={15} y2={ty} />
        ))}
        <line x1={14} y1={97 - height} x2={88} y2={97 - height} strokeDasharray="3 3" />
      </g>
      <FrontFigure build={build} sex={sex} height={height} />
    </>
  )
}

export function BodyTypeArt({ option, sex }: { option: string; sex: FigureSex }) {
  const builds = sex === 'female' ? FEMALE_BUILDS : MALE_BUILDS
  return <FrontFigure build={builds[option] ?? builds.Average} sex={sex} height={92} />
}

const CHEST_BUILDS: Record<string, Build> = {
  Lean: MALE_BUILDS.Slim,
  Toned: MALE_BUILDS.Athletic,
  Muscular: MALE_BUILDS.Muscular,
  Broad: { sh: 0.15, bust: 0.13, waist: 0.112, hip: 0.104, thigh: 0.08, knee: 0.05, calf: 0.05, arm: 0.042 },
}

/** Close-up of a man's torso, cropped from the full figure. */
export function ChestArt({ option }: { option: string }) {
  const b = CHEST_BUILDS[option] ?? CHEST_BUILDS.Lean
  const H = 215
  const top = -0.115 * H
  const x = (u: number) => 50 + u * H
  const y = (v: number) => top + v * H
  const defined = option !== 'Lean'
  return (
    <>
      <FrontFigure build={b} sex="male" height={H} top={top} />
      {defined && (
        <g className="fig-line" fill="none" strokeWidth={1.4} strokeLinecap="round">
          <path d={`M${x(0)} ${y(0.205)} L${x(0)} ${y(0.262)}`} />
          {[-1, 1].map((s) => (
            <path
              key={s}
              d={`M${x(0)} ${y(0.262)} Q${x(s * b.bust * 0.5)} ${y(0.285)} ${x(s * b.bust * 0.86)} ${y(0.236)}`}
            />
          ))}
          {option === 'Muscular' && (
            <path
              d={[0.31, 0.345, 0.38]
                .map((v) => `M${x(-0.024)} ${y(v)} Q${x(0)} ${y(v + 0.006)} ${x(0.024)} ${y(v)}`)
                .concat(`M${x(0)} ${y(0.29)} L${x(0)} ${y(0.4)}`)
                .join(' ')}
            />
          )}
        </g>
      )}
    </>
  )
}

/* ---------- Side profile (bust size, bottom size) ---------- */

const BUST_DEPTH: Record<string, number> = { Small: 0.01, Medium: 0.024, Large: 0.04, 'Very large': 0.058 }
const BOTTOM_DEPTH: Record<string, number> = { Slim: 0.007, Average: 0.02, Round: 0.036, 'Very curvy': 0.054 }

export function BustSizeArt({ option }: { option: string }) {
  return <SideFigure bust={BUST_DEPTH[option] ?? BUST_DEPTH.Medium} bottom={BOTTOM_DEPTH.Average} focus="bust" />
}

export function BottomSizeArt({ option }: { option: string }) {
  return <SideFigure bust={BUST_DEPTH.Medium} bottom={BOTTOM_DEPTH[option] ?? BOTTOM_DEPTH.Average} focus="bottom" />
}

/** A woman standing in profile, facing right, with the bust or bottom region highlighted. */
function SideFigure({ bust, bottom, focus }: { bust: number; bottom: number; focus: 'bust' | 'bottom' }) {
  const H = 94
  const top = 97 - H
  const cx = 51
  // Profile depth is exaggerated slightly so size differences read at thumbnail size.
  const depth = 1.4
  const x = (u: number) => cx + u * H * depth
  const y = (v: number) => top + v * H
  const contour: Pt[] = [
    [0.024, 0.118],
    [0.028, 0.15],
    [0.042, 0.19],
    [0.048 + bust * 0.55, 0.226],
    [0.05 + bust, 0.258],
    [0.046 + bust * 0.6, 0.29],
    [0.036, 0.312],
    [0.03, 0.362],
    [0.036, 0.422],
    [0.044, 0.482],
    [0.05, 0.55],
    [0.04, 0.65],
    [0.032, 0.722],
    [0.028, 0.8],
    [0.02, 0.93],
    [0.05, 0.984],
    [0.075, 0.994],
    [0.058, 0.999],
    [-0.025, 0.999],
    [-0.032, 0.984],
    [-0.02, 0.95],
    [-0.026, 0.88],
    [-0.042, 0.8],
    [-0.032, 0.722],
    [-0.042, 0.642],
    [-0.046 - bottom * 0.35, 0.585],
    [-0.048 - bottom, 0.522],
    [-0.044 - bottom * 0.6, 0.47],
    [-0.032, 0.412],
    [-0.03, 0.362],
    [-0.038, 0.29],
    [-0.044, 0.222],
    [-0.032, 0.162],
    [-0.02, 0.13],
  ]
  const focusDepth = focus === 'bust' ? bust : bottom
  return (
    <>
      <ellipse
        className="focus-ring"
        cx={focus === 'bust' ? x(0.05 + bust * 0.5) : x(-0.046 - bottom * 0.5)}
        cy={focus === 'bust' ? y(0.262) : y(0.525)}
        rx={(0.06 + focusDepth) * H * depth * 0.6}
        ry={0.075 * H}
      />
      <g className="fig" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx={x(-0.018)} cy={y(0.09)} rx={0.042 * H} ry={0.078 * H} />
        <ellipse cx={x(0.006)} cy={y(0.063)} rx={0.045 * H} ry={0.056 * H} />
        <ellipse cx={x(0.04)} cy={y(0.07)} rx={0.009 * H} ry={0.012 * H} />
        <path d={closedSpline(contour.map(([u, v]): Pt => [x(u), y(v)]))} strokeWidth={0.4} />
      </g>
      <g className="fig-shade" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1={x(-0.008)} y1={y(0.19)} x2={x(-0.012)} y2={y(0.36)} strokeWidth={0.029 * H} />
        <line x1={x(-0.012)} y1={y(0.36)} x2={x(0.004)} y2={y(0.5)} strokeWidth={0.024 * H} />
        <line x1={x(0.004)} y1={y(0.5)} x2={x(0.009)} y2={y(0.555)} strokeWidth={0.021 * H} />
      </g>
    </>
  )
}

/* ---------- Back view of the hips (bottom shape) ---------- */

// Half-widths (viewBox units) at the upper hip and the fullest lower point.
const BOTTOM_SHAPES: Record<string, { upper: number; lower: number }> = {
  Round: { upper: 27, lower: 29.5 },
  Heart: { upper: 21, lower: 33 },
  Square: { upper: 28.5, lower: 28 },
  'V-shape': { upper: 30.5, lower: 22.5 },
}

/** Back view of a woman's hips in fitted shorts. */
export function BottomShapeArt({ option }: { option: string }) {
  const { upper: a, lower: b } = BOTTOM_SHAPES[option] ?? BOTTOM_SHAPES.Round
  const t = 20
  const square = option === 'Square'
  const right: Pt[] = [
    [16, 4],
    [square ? a - 1 : 16 + (a - 16) * 0.6, square ? 16 : 19],
    [a, 34],
    [(a + b) / 2 + (square ? 0 : 0.8), 47],
    [b, 60],
    [b - 1.8, 72],
    [t + 1.5, 85],
    [t, 99],
    [5, 100],
    [2.2, 86],
    [0, 77],
  ]
  const pts = mirrored(right).map(([u, v]): Pt => [50 + u, v])
  return (
    <>
      <path className="fig" d={closedSpline(pts)} strokeWidth={0.4} />
      <g className="fig-line" fill="none" strokeWidth={1.4} strokeLinecap="round">
        <path d="M34 13 Q50 15.5 66 13" />
        <path d="M50 36 Q50.6 55 50 73" />
        {[-1, 1].map((s) => (
          <path key={s} d={`M${50 + s * 2.5} 75 Q${50 + s * b * 0.5} 81 ${50 + s * (b - 4)} 72`} />
        ))}
        <path d={`M${50 - t - 3} 89 Q41 92.5 50 86.5 Q59 92.5 ${50 + t + 3} 89`} />
      </g>
    </>
  )
}
