import { describe, expect, it } from "vitest";

import { encodeQr, formatInfoValue, reedSolomonRemainder, type QrMatrix } from "@/modules/certificates/qr";

/**
 * Hand-rolled QR encoder tests. No external QR reference/decoder was
 * reachable from this environment, so correctness is argued three ways:
 *  1. Reed–Solomon vectors computed BY HAND (shown in the comments below) from
 *     the GF(256) spec (primitive polynomial 0x11D) — independent of the
 *     encoder's own recollection of ISO version-capacity tables.
 *  2. Fixed ISO/IEC 18004 structural constants that are unambiguous and
 *     version-independent (finder-pattern shape, timing-pattern alternation,
 *     the always-dark module, format-info redundancy + its BCH property).
 *  3. Full encode→decode round trips using an INDEPENDENTLY-written decoder
 *     (duplicated placement/mask logic, not shared code) for the two
 *     single-block versions, proving bit ordering and masking agree.
 */

// ── 1. Reed–Solomon, hand-derived ───────────────────────────────────────
// GF(256), primitive poly 0x11D ⇒ exp(0)=1, exp(1)=2. Generator(degree 2) =
// (x - exp(0))(x - exp(1)) = (x+1)(x+2) = x² + (1·2 XOR 1·1)x + 1·2
//                           = x² + 3x + 2  →  coefficients [1, 3, 2].
// Dividing message "1" (as x², i.e. [1,0,0]) by [1,3,2]:
//   [1,0,0] XOR (1·[1,3,2] padded) = [1^1, 0^3, 0^2] = [0,3,2] → remainder [3,2].
describe("reedSolomonRemainder — hand-derived GF(256) vectors", () => {
  it("message [1], 2 EC codewords → [3, 2]", () => {
    expect(reedSolomonRemainder([1], 2)).toEqual([3, 2]);
  });

  it("message [1, 1], 2 EC codewords → [4, 4]", () => {
    // [1,1,0,0] ⊕ (1·[1,3,2] @0) = [0,2,2,0]; next term 2 ⊕ (2·[1,3,2] @1),
    // where 2·[1,3,2] = [2, gfMul(3,2)=6, gfMul(2,2)=4] → [0,2,6,4] aligned:
    // [0,2,2,0] ⊕ [0,2,6,4] = [0,0,4,4] → remainder [4,4].
    expect(reedSolomonRemainder([1, 1], 2)).toEqual([4, 4]);
  });

  it("the all-zero message always produces an all-zero remainder (linearity)", () => {
    expect(reedSolomonRemainder([0, 0, 0, 0], 10)).toEqual(new Array(10).fill(0));
  });

  it("remainder length always equals the requested EC codeword count", () => {
    expect(reedSolomonRemainder([5, 200, 17, 3], 16)).toHaveLength(16);
  });
});

// ── 2. Format info: fixed ISO structural properties ─────────────────────

/** Binary (GF(2)) polynomial remainder — independent re-implementation. */
function gf2ModRemainder(value: number, generator: number, generatorBits: number): number {
  let v = value;
  const highBit = generatorBits - 1;
  for (let i = 20; i >= highBit; i--) {
    if ((v >> i) & 1) v ^= generator << (i - highBit);
  }
  return v;
}

describe("formatInfoValue — BCH(15,5) systematic-code property", () => {
  it("every mask pattern's pre-mask codeword divides evenly by the generator (remainder 0)", () => {
    for (let mask = 0; mask < 8; mask++) {
      const masked = formatInfoValue(mask);
      const raw = masked ^ 0x5412; // undo the fixed XOR mask
      expect(gf2ModRemainder(raw, 0x537, 11)).toBe(0);
    }
  });

  it("the low 3 bits of the recovered data value round-trip the mask pattern", () => {
    for (let mask = 0; mask < 8; mask++) {
      const raw = formatInfoValue(mask) ^ 0x5412;
      const data5 = raw >>> 10;
      expect(data5 & 0b111).toBe(mask);
      expect(data5 >> 3).toBe(0b00); // EC level M
    }
  });

  it("is a pure function of the mask pattern (deterministic)", () => {
    expect(formatInfoValue(3)).toBe(formatInfoValue(3));
  });
});

// ── 3. Structural matrix checks (finder / timing / dark module / format redundancy) ──

const FINDER_7X7 = [
  "1111111",
  "1000001",
  "1011101",
  "1011101",
  "1011101",
  "1000001",
  "1111111",
].map((row) => row.split("").map((ch) => ch === "1"));

function assertFinderAt(matrix: QrMatrix, topRow: number, leftCol: number): void {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      expect(matrix.modules[topRow + r]![leftCol + c]).toBe(FINDER_7X7[r]![c]);
    }
  }
}

/** Independently-listed format-info coordinate paths (duplicated from qr.ts on purpose). */
function formatCoordinates(size: number): [[number, number][], [number, number][]] {
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

function readFormatCopy(matrix: QrMatrix, path: [number, number][]): number {
  let value = 0;
  for (const [r, c] of path) value = (value << 1) | (matrix.modules[r]![c] ? 1 : 0);
  return value;
}

const SAMPLE_URL = "https://buildbunny.example/verify/AbCdEfGhIjKlMnOpQrStUv";

function versionOf(size: number): number {
  return (size - 17) / 4;
}

describe("encodeQr — ISO/IEC 18004 structural invariants", () => {
  const cases = ["HI", SAMPLE_URL, "https://x.test/verify/short-slug-1234567890"];

  for (const text of cases) {
    it(`"${text.slice(0, 24)}…" produces a well-formed matrix`, () => {
      const matrix = encodeQr(text);
      const version = versionOf(matrix.size);
      expect(Number.isInteger(version)).toBe(true);
      expect(version).toBeGreaterThanOrEqual(1);
      expect(version).toBeLessThanOrEqual(6);
      expect(matrix.modules).toHaveLength(matrix.size);
      for (const row of matrix.modules) expect(row).toHaveLength(matrix.size);

      // Finder patterns at all three corners, exact shape.
      assertFinderAt(matrix, 0, 0);
      assertFinderAt(matrix, 0, matrix.size - 7);
      assertFinderAt(matrix, matrix.size - 7, 0);

      // Timing pattern alternates dark/light starting dark at column/row 8.
      for (let i = 8; i <= matrix.size - 9; i++) {
        expect(matrix.modules[6]![i]).toBe(i % 2 === 0);
        expect(matrix.modules[i]![6]).toBe(i % 2 === 0);
      }

      // The always-dark module.
      expect(matrix.modules[matrix.size - 8]![8]).toBe(true);

      // Both redundant format-info copies decode to the identical value, and
      // that value is a valid (remainder-0) BCH codeword for level M.
      const [copyA, copyB] = formatCoordinates(matrix.size);
      const a = readFormatCopy(matrix, copyA);
      const b = readFormatCopy(matrix, copyB);
      expect(a).toBe(b);
      const raw = a ^ 0x5412;
      expect(gf2ModRemainder(raw, 0x537, 11)).toBe(0);
      expect(raw >>> 13).toBe(0b00); // EC level M encoded as 00
    });
  }

  it("throws instead of silently truncating oversized input", () => {
    expect(() => encodeQr("x".repeat(200))).toThrow(/exceeds/);
  });

  it("is deterministic for the same input", () => {
    const a = encodeQr(SAMPLE_URL);
    const b = encodeQr(SAMPLE_URL);
    expect(a.modules).toEqual(b.modules);
  });

  it("picks the smallest version that fits (byte-length monotonic)", () => {
    const short = encodeQr("a");
    const long = encodeQr("a".repeat(90));
    expect(long.size).toBeGreaterThan(short.size);
  });
});

// ── 4. Full round trip (single-block versions 1–2): independent decoder ──

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

/** Single-block-only (v1/v2) decoder, written independently of qr.ts's encoder. */
function decodeSingleBlock(matrix: QrMatrix, dataCodewordCount: number): string {
  const size = matrix.size;
  const version = versionOf(size);
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));

  const markFinder = (topRow: number, leftCol: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = topRow + r;
        const col = leftCol + c;
        if (row < 0 || col < 0 || row >= size || col >= size) continue;
        reserved[row]![col] = true;
      }
    }
  };
  markFinder(0, 0);
  markFinder(0, size - 7);
  markFinder(size - 7, 0);
  for (let i = 8; i <= size - 9; i++) {
    reserved[6]![i] = true;
    reserved[i]![6] = true;
  }
  if (version !== 1) {
    const center = 4 * version + 10;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) reserved[center + r]![center + c] = true;
    }
  }
  const [copyA, copyB] = formatCoordinates(size);
  for (const [r, c] of [...copyA, ...copyB]) reserved[r]![c] = true;
  reserved[size - 8]![8] = true;

  const formatValue = readFormatCopy(matrix, copyA);
  const data5 = (formatValue ^ 0x5412) >>> 10;
  const maskPattern = data5 & 0b111;
  const maskFn = MASK_FNS[maskPattern]!;

  const bits: boolean[] = [];
  let col = size - 1;
  let upward = true;
  while (col > 0) {
    if (col === 6) col -= 1;
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (reserved[row]![c]) continue;
        const raw = matrix.modules[row]![c]!;
        bits.push(maskFn(row, c) ? !raw : raw);
      }
    }
    col -= 2;
    upward = !upward;
  }

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8 && i + b < bits.length; b++) byte = (byte << 1) | (bits[i + b] ? 1 : 0);
    codewords.push(byte);
  }
  const dataOnly = codewords.slice(0, dataCodewordCount);

  const mode = dataOnly[0]! >> 4;
  expect(mode).toBe(0b0100); // byte mode
  const countHigh = ((dataOnly[0]! & 0b1111) << 4) | (dataOnly[1]! >> 4);
  const byteCount = countHigh;
  const out = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    const lowNibble = dataOnly[1 + i]! & 0b1111;
    const highNibble = dataOnly[2 + i]! >> 4;
    out[i] = (lowNibble << 4) | highNibble;
  }
  return new TextDecoder().decode(out);
}

describe("encodeQr → independent decoder round trip", () => {
  it("recovers a short string encoded at version 1", () => {
    const matrix = encodeQr("HI");
    expect(versionOf(matrix.size)).toBe(1);
    expect(decodeSingleBlock(matrix, 16)).toBe("HI");
  });

  it("recovers a longer string encoded at version 2", () => {
    const text = "https://x.test/v/ab"; // 20 bytes — exceeds v1's 16-byte capacity
    const matrix = encodeQr(text);
    expect(versionOf(matrix.size)).toBe(2);
    expect(decodeSingleBlock(matrix, 28)).toBe(text);
  });
});
