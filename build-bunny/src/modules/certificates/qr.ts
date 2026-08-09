/**
 * Hand-rolled QR encoder (certificates task contract: "keep it small and
 * pure — do NOT add a dependency"). Implements ISO/IEC 18004 from first
 * principles: GF(256) arithmetic, Reed–Solomon error-correction codewords,
 * the standard module-placement rules (finder / separator / timing /
 * alignment / format info / dark module), and mask selection.
 *
 * Deliberately scoped down for this product's one real use case — encoding
 * a Build Bunny verify URL (`{origin}/verify/{22-char slug}`, ~40–90 ASCII
 * bytes):
 *  - byte mode only (no numeric/alphanumeric/kanji segment optimization —
 *    URLs don't benefit from them enough to earn the extra code);
 *  - error-correction level M only (per the certificates contract);
 *  - versions 1–6 only (max 106 raw bytes at level M) — version 7+ needs an
 *    additional 18-bit version-info block, out of scope for a fixed-shape
 *    URL payload.
 * A longer input throws rather than silently producing a corrupt code.
 *
 * No external reference decoder was available to cross-validate against
 * (no network access in this environment) — see qr.test.ts for how
 * correctness is argued instead: hand-derived Reed–Solomon vectors, the
 * fixed ISO structural constants (finder/timing/dark-module layout), format
 * -info self-consistency (both redundant copies + BCH remainder == 0), and
 * full encode→decode round trips. Recommend a real phone scan of a printed
 * certificate before this ships.
 */

export interface QrMatrix {
  size: number;
  /** modules[row][col] === true means a DARK (printed) module. */
  modules: boolean[][];
}

/** Standard quiet-zone width (in modules) a renderer should pad around the matrix. */
export const QR_QUIET_ZONE_MODULES = 4;

const MAX_VERSION = 6;

// ── GF(256) arithmetic ──────────────────────────────────────────────────
// Primitive polynomial x^8+x^4+x^3+x^2+1 = 0x11D (ISO/IEC 18004 Annex A /
// the standard Reed–Solomon field for QR).
const GF_EXP = new Array<number>(512);
const GF_LOG = new Array<number>(256);
(function buildGf(): void {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]!;
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!;
}

/** Coefficients highest-degree-first; multiply two GF(256) polynomials. */
function polyMul(a: readonly number[], b: readonly number[]): number[] {
  const result = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      result[i + j] = (result[i + j] ?? 0) ^ gfMul(a[i]!, b[j]!);
    }
  }
  return result;
}

/** The Reed–Solomon generator polynomial of the given degree: ∏(x - α^i). */
function rsGeneratorPoly(degree: number): number[] {
  let g: number[] = [1];
  for (let i = 0; i < degree; i++) {
    g = polyMul(g, [1, GF_EXP[i]!]);
  }
  return g;
}

/**
 * Reed–Solomon remainder (the error-correction codewords) for a data
 * codeword sequence, exported for the hand-derived unit-test vectors.
 * `data` is high-degree-first (first byte fed = most significant term).
 */
export function reedSolomonRemainder(data: readonly number[], ecCount: number): number[] {
  const generator = rsGeneratorPoly(ecCount);
  const remainder = [...data, ...new Array<number>(ecCount).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const factor = remainder[i]!;
    if (factor === 0) continue;
    for (let j = 0; j < generator.length; j++) {
      remainder[i + j] = (remainder[i + j] ?? 0) ^ gfMul(generator[j]!, factor);
    }
  }
  return remainder.slice(data.length);
}

// ── Version table (level M, byte mode, versions 1–6) ───────────────────
// dataCodewords/ecCodewordsPerBlock/numBlocks derived from two independently
// -recalled ISO/IEC 18004 quantities (total codewords per version, and the
// byte-mode character-capacity table) cross-checked against each other by
// bit arithmetic — see qr.test.ts for the structural self-check that the
// free (non-function-pattern) module count of the built matrix matches
// dataCodewords+ecCodewords exactly for every supported version.
interface VersionSpec {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewordsPerBlock: number;
  numBlocks: number;
}

const VERSIONS: VersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 16, ecCodewordsPerBlock: 10, numBlocks: 1 },
  { version: 2, size: 25, dataCodewords: 28, ecCodewordsPerBlock: 16, numBlocks: 1 },
  { version: 3, size: 29, dataCodewords: 44, ecCodewordsPerBlock: 26, numBlocks: 1 },
  { version: 4, size: 33, dataCodewords: 64, ecCodewordsPerBlock: 18, numBlocks: 2 },
  { version: 5, size: 37, dataCodewords: 86, ecCodewordsPerBlock: 24, numBlocks: 2 },
  { version: 6, size: 41, dataCodewords: 108, ecCodewordsPerBlock: 16, numBlocks: 4 },
];

/** Byte-mode header: 4-bit mode indicator + 8-bit count indicator (versions 1–9). */
const HEADER_BITS = 4 + 8;

function chooseVersion(byteLength: number): VersionSpec {
  const needed = HEADER_BITS + byteLength * 8;
  const spec = VERSIONS.find((v) => v.dataCodewords * 8 >= needed);
  if (!spec) {
    throw new Error(
      `qr: ${byteLength} bytes exceeds the ${VERSIONS[MAX_VERSION - 1]!.dataCodewords}-byte ` +
        `capacity of the largest supported version (${MAX_VERSION}, level M, byte mode).`,
    );
  }
  return spec;
}

// ── Bit buffer ───────────────────────────────────────────────────────────

class BitWriter {
  private bits: boolean[] = [];

  pushBits(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push(((value >> i) & 1) === 1);
    }
  }

  get length(): number {
    return this.bits.length;
  }

  toBits(): boolean[] {
    return this.bits;
  }
}

/** Byte-mode segment → padded data codewords for the given version. */
function buildDataCodewords(bytes: Uint8Array, spec: VersionSpec): number[] {
  const capacityBits = spec.dataCodewords * 8;
  const writer = new BitWriter();
  writer.pushBits(0b0100, 4); // byte-mode indicator
  writer.pushBits(bytes.length, 8); // count indicator (versions 1–9)
  for (const byte of bytes) writer.pushBits(byte, 8);

  const remaining = capacityBits - writer.length;
  writer.pushBits(0, Math.min(4, Math.max(0, remaining))); // terminator (≤4 bits)

  const bits = writer.toBits();
  while (bits.length % 8 !== 0) bits.push(false); // pad to a byte boundary

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (bits[i + b] ? 1 : 0);
    codewords.push(byte);
  }

  // Fill remaining capacity with the standard alternating pad codewords.
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < spec.dataCodewords) {
    codewords.push(padBytes[padIndex % 2]!);
    padIndex++;
  }
  return codewords;
}

/** Split into equal-sized blocks (every supported version divides evenly), RS-encode each, interleave. */
function buildFinalCodewordSequence(dataCodewords: number[], spec: VersionSpec): number[] {
  const perBlock = spec.dataCodewords / spec.numBlocks;
  const blocks: number[][] = [];
  for (let b = 0; b < spec.numBlocks; b++) {
    blocks.push(dataCodewords.slice(b * perBlock, (b + 1) * perBlock));
  }
  const ecBlocks = blocks.map((block) => reedSolomonRemainder(block, spec.ecCodewordsPerBlock));

  const out: number[] = [];
  for (let i = 0; i < perBlock; i++) {
    for (const block of blocks) out.push(block[i]!);
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (const block of ecBlocks) out.push(block[i]!);
  }
  return out;
}

// ── Matrix structure (finder / separator / timing / alignment / dark module) ──

/** Alignment pattern center for versions 2–6 (single extra pattern) — 4·version+10. */
function alignmentCenter(version: number): number | null {
  return version === 1 ? null : 4 * version + 10;
}

function paintFinder(modules: boolean[][], reserved: boolean[][], topRow: number, leftCol: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const row = topRow + r;
      const col = leftCol + c;
      if (row < 0 || col < 0 || row >= modules.length || col >= modules.length) continue;
      reserved[row]![col] = true;
      if (r < 0 || r > 6 || c < 0 || c > 6) {
        modules[row]![col] = false; // separator ring
        continue;
      }
      const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      modules[row]![col] = onBorder || inCore;
    }
  }
}

function paintAlignment(modules: boolean[][], reserved: boolean[][], center: number): void {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const row = center + r;
      const col = center + c;
      reserved[row]![col] = true;
      const onBorder = r === -2 || r === 2 || c === -2 || c === 2;
      const isCenter = r === 0 && c === 0;
      modules[row]![col] = onBorder || isCenter;
    }
  }
}

function paintTiming(modules: boolean[][], reserved: boolean[][], size: number): void {
  for (let i = 8; i <= size - 9; i++) {
    const dark = i % 2 === 0;
    modules[6]![i] = dark;
    reserved[6]![i] = true;
    modules[i]![6] = dark;
    reserved[i]![6] = true;
  }
}

/** The two redundant 15-cell coordinate paths format info is written along. */
function formatInfoCoordinates(size: number): [[number, number][], [number, number][]] {
  const copyA: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const copyB: [number, number][] = [
    [8, size - 1], [8, size - 2], [8, size - 3], [8, size - 4],
    [8, size - 5], [8, size - 6], [8, size - 7], [8, size - 8],
    [size - 7, 8], [size - 6, 8], [size - 5, 8], [size - 4, 8],
    [size - 3, 8], [size - 2, 8], [size - 1, 8],
  ];
  return [copyA, copyB];
}

/** BCH(15,5) remainder for format info, generator 0x537 (degree 10). */
function formatBchRemainder(dataShifted: number): number {
  let value = dataShifted;
  for (let i = 14; i >= 10; i--) {
    if ((value >> i) & 1) value ^= 0x537 << (i - 10);
  }
  return value & 0x3ff;
}

/** Level M format bits = 00; mask is 3 bits. Exported for the BCH self-check test. */
export function formatInfoValue(maskPattern: number): number {
  const data = (0b00 << 3) | maskPattern; // EC level M = 00
  const dataShifted = data << 10;
  const raw = dataShifted | formatBchRemainder(dataShifted);
  return raw ^ 0x5412;
}

function paintReservedButUnknownAreas(reserved: boolean[][], size: number): void {
  // Format info strips + the always-dark module.
  for (const path of formatInfoCoordinates(size)) {
    for (const [r, c] of path) reserved[r]![c] = true;
  }
  reserved[size - 8]![8] = true;
}

const MASK_FNS: ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => {
    void c;
    return r % 2 === 0;
  },
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function penaltyScore(modules: boolean[][], size: number): number {
  let score = 0;

  // N1: runs of ≥5 same-colour modules, per row and per column.
  const scanRuns = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < size; i++) {
      let runLen = 1;
      let prev = get(i, 0);
      for (let j = 1; j < size; j++) {
        const val = get(i, j);
        if (val === prev) {
          runLen++;
        } else {
          if (runLen >= 5) score += 3 + (runLen - 5);
          runLen = 1;
          prev = val;
        }
      }
      if (runLen >= 5) score += 3 + (runLen - 5);
    }
  };
  scanRuns((i, j) => modules[i]![j]!);
  scanRuns((i, j) => modules[j]![i]!);

  // N2: 2×2 blocks of the same colour.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r]![c]!;
      if (
        modules[r]![c + 1] === v &&
        modules[r + 1]![c] === v &&
        modules[r + 1]![c + 1] === v
      ) {
        score += 3;
      }
    }
  }

  // N3: finder-like 1:1:3:1:1 patterns with a 4-module light run on one side.
  const pattern = [true, false, true, true, true, false, true, false, false, false, false];
  const patternRev = [...pattern].reverse();
  const matches = (vals: boolean[], start: number): boolean => {
    for (let k = 0; k < pattern.length; k++) {
      if (vals[start + k] !== pattern[k] && vals[start + k] !== patternRev[k]) return false;
    }
    return true;
  };
  for (let i = 0; i < size; i++) {
    const row = Array.from({ length: size }, (_, j) => modules[i]![j]!);
    const col = Array.from({ length: size }, (_, j) => modules[j]![i]!);
    for (let j = 0; j <= size - pattern.length; j++) {
      if (matches(row, j)) score += 40;
      if (matches(col, j)) score += 40;
    }
  }

  // N4: overall dark proportion vs. 50%.
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (modules[r]![c]) dark++;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

// ── Public API ───────────────────────────────────────────────────────────

export function encodeQr(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  const spec = chooseVersion(bytes.length);
  const dataCodewords = buildDataCodewords(bytes, spec);
  const finalCodewords = buildFinalCodewordSequence(dataCodewords, spec);

  const bits: boolean[] = [];
  for (const byte of finalCodewords) {
    for (let i = 7; i >= 0; i--) bits.push(((byte >> i) & 1) === 1);
  }

  const size = spec.size;
  const modules: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));

  paintFinder(modules, reserved, 0, 0);
  paintFinder(modules, reserved, 0, size - 7);
  paintFinder(modules, reserved, size - 7, 0);
  const center = alignmentCenter(spec.version);
  if (center !== null) paintAlignment(modules, reserved, center);
  paintTiming(modules, reserved, size);
  paintReservedButUnknownAreas(reserved, size);
  reserved[size - 8]![8] = true;
  modules[size - 8]![8] = true; // dark module — always on

  // Zigzag placement, skipping every reserved (function-pattern) cell.
  let bitIndex = 0;
  let col = size - 1;
  let upward = true;
  while (col > 0) {
    if (col === 6) col -= 1; // the whole timing column is skipped
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (reserved[row]![c]) continue;
        const bit = bitIndex < bits.length ? bits[bitIndex]! : false;
        modules[row]![c] = bit;
        bitIndex++;
      }
    }
    col -= 2;
    upward = !upward;
  }

  // Try every mask on a copy of the unmasked matrix; keep the lowest-penalty one.
  let bestMask = 0;
  let bestScore = Infinity;
  let bestModules = modules;
  for (let mask = 0; mask < 8; mask++) {
    const maskFn = MASK_FNS[mask]!;
    const candidate = modules.map((row) => [...row]);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (reserved[r]![c]) continue;
        if (maskFn(r, c)) candidate[r]![c] = !candidate[r]![c];
      }
    }
    const score = penaltyScore(candidate, size);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
      bestModules = candidate;
    }
  }

  // Write format info (both redundant copies) for the chosen mask.
  const format = formatInfoValue(bestMask);
  const [copyA, copyB] = formatInfoCoordinates(size);
  for (let i = 0; i < 15; i++) {
    const bit = ((format >> (14 - i)) & 1) === 1;
    const [ra, ca] = copyA[i]!;
    bestModules[ra]![ca] = bit;
    const [rb, cb] = copyB[i]!;
    bestModules[rb]![cb] = bit;
  }

  return { size, modules: bestModules };
}
