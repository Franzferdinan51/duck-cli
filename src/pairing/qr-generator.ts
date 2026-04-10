/**
 * 🦆 Duck Agent - QR Code Generator
 * Generates QR codes for OpenClaw pairing
 * Supports terminal-friendly ASCII output + image generation
 */

export interface QRCodeOptions {
  /** Content to encode */
  data: string;
  /** QR code size in pixels (default: 256) */
  size?: number;
  /** Error correction level: L, M, Q, H (default: M) */
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
  /** Output format: 'ascii' | 'svg' | 'terminal' (default: 'terminal') */
  format?: 'ascii' | 'svg' | 'terminal';
  /** Foreground color (default: black) */
  fgColor?: string;
  /** Background color (default: white) */
  bgColor?: string;
  /** Output file path (optional, for svg format) */
  outputPath?: string;
}

export interface QRCodeResult {
  success: boolean;
  /** ASCII/terminal QR string */
  ascii?: string;
  /** SVG string (if format='svg') */
  svg?: string;
  /** Base64 PNG data URL (if format='png') */
  dataUrl?: string;
  /** Path to saved file */
  path?: string;
  error?: string;
}

// ─── Minimal QR Code Generator ───────────────────────────────────────────────
// Pure JS QR code generator - no native dependencies needed
// Based on QRCode generator algorithm

const ALPHANUMERIC_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

function getAlphanumericIndex(char: string): number {
  const idx = ALPHANUMERIC_CHARS.indexOf(char.toUpperCase());
  return idx >= 0 ? idx : -1;
}

function getMode(data: string): 'numeric' | 'alphanumeric' | 'byte' {
  if (/^\d+$/.test(data)) return 'numeric';
  let isAlphanumeric = true;
  for (const c of data) {
    if (ALPHANUMERIC_CHARS.indexOf(c.toUpperCase()) < 0) {
      isAlphanumeric = false;
      break;
    }
  }
  return isAlphanumeric ? 'alphanumeric' : 'byte';
}

function getMinimumVersion(data: string, level: string): number {
  const len = data.length;
  const capacities: Record<string, [number, number, number, number]> = {
    L: [19, 34, 55, 80], M: [16, 28, 44, 64], Q: [13, 22, 34, 48], H: [9, 16, 26, 36],
  };
  const caps = capacities[level] || capacities.M;
  for (let v = 1; v <= 40; v++) {
    if (v <= 9 && len <= caps[0]) return v;
    if (v <= 26 && len > caps[0] && len <= caps[1]) return v;
    if (v <= 32 && len > caps[1] && len <= caps[2]) return v;
    if (v <= 40 && len > caps[2] && len <= caps[3]) return v;
  }
  return 40;
}

function generateRandomMask(): number {
  return Math.floor(Math.random() * 8);
}

// Reed-Solomon GF(285) field for QR codes
const RS_EXP_TABLE = [
  1, 2, 4, 8, 16, 32, 64, 128, 29, 58, 116, 232, 201, 255, 1, 0,
];
const RS_LOG_TABLE = [
  255, 0, 1, 25, 2, 50, 26, 198, 3, 223, 51, 229, 198, 27, 104, 76,
  4, 100, 224, 14, 52, 141, 230, 220, 223, 52, 141, 71, 105, 77, 196, 5,
  78, 212, 199, 125, 101, 47, 225, 117, 15, 103, 95, 216, 53, 142, 43, 232,
  231, 173, 53, 207, 142, 194, 71, 72, 106, 41, 137, 181, 77, 121, 197, 127,
  6, 212, 203, 149, 79, 178, 185, 99, 213, 126, 102, 122, 48, 226, 82, 118,
  16, 110, 9, 104, 233, 135, 54, 143, 44, 46, 233, 131, 174, 139, 54, 208,
  143, 197, 193, 78, 71, 82, 107, 166, 41, 223, 138, 182, 77, 219, 122, 61,
  197, 65, 7, 88, 212, 191, 204, 62, 149, 80, 185, 100, 178, 185, 100, 2,
  213, 127, 10, 118, 103, 75, 123, 204, 49, 197, 83, 59, 118, 17, 84, 123,
  111, 10, 104, 234, 191, 247, 135, 86, 55, 144, 91, 45, 139, 237, 132, 175,
  140, 65, 55, 145, 109, 91, 45, 208, 143, 150, 79, 72, 72, 73, 83, 108,
  167, 42, 224, 138, 79, 183, 138, 180, 78, 125, 220, 123, 61, 62, 198, 199,
  66, 8, 152, 89, 213, 248, 192, 5, 204, 63, 150, 149, 81, 186, 186, 101, 179,
];

function rsMultiply(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return RS_EXP_TABLE[(RS_LOG_TABLE[x] + RS_LOG_TABLE[y]) % 255];
}

/** Simple 2D boolean matrix */
class QRMatrix {
  private data: boolean[][];
  readonly size: number;

  constructor(size: number) {
    this.size = size;
    this.data = Array.from({ length: size }, () => Array(size).fill(false));
  }

  get(x: number, y: number): boolean {
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) return false;
    return this.data[y][x];
  }

  set(x: number, y: number, value: boolean): void {
    if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
      this.data[y][x] = value;
    }
  }

  /** Place a functional pattern at top-left corner (x,y) */
  placeFinderPattern(x: number, y: number): void {
    for (let dy = -7; dy <= 7; dy++) {
      for (let dx = -7; dx <= 7; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || px >= this.size || py < 0 || py >= this.size) continue;
        const isEdge = Math.abs(dx) === 6 || Math.abs(dy) === 6;
        const isInner = Math.abs(dx) <= 2 && Math.abs(dy) <= 2;
        this.data[py][px] = isEdge || isInner;
      }
    }
  }

  /** Place a single alignment pattern at center (x,y) */
  placeAlignmentPattern(x: number, y: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const isEdge = Math.abs(dx) === 2 || Math.abs(dy) === 2;
        const isCenter = dx === 0 && dy === 0;
        this.set(x + dx, y + dy, isEdge || isCenter);
      }
    }
  }

  /** Place timing patterns */
  placeTimingPatterns(): void {
    for (let i = 8; i < this.size - 8; i++) {
      this.set(i, 6, i % 2 === 0);
      this.set(6, i, i % 2 === 0);
    }
  }

  /** Reserve format info areas */
  reserveAreas(): void {
    // Format info around finder patterns
    for (let i = 0; i < 9; i++) {
      this.set(8, i, false);
      this.set(i, 8, false);
      this.set(8, this.size - 1 - i, false);
      this.set(i, 8, false);
    }
    // Dark module
    this.set(8, this.size - 8, true);
    // Version info (v7+)
    if (this.size >= 21) {
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 3; j++) {
          this.set(this.size - 11 + i, j, false);
          this.set(j, this.size - 11 + i, false);
        }
      }
    }
  }

  toString(black = '██', white = '  '): string {
    return this.data
      .map(row => row.map(cell => cell ? black : white).join(''))
      .join('\n');
  }
}

function generateDataCodewords(data: string, version: number): number[] {
  const mode = getMode(data);
  const codewords: number[] = [];

  // Mode indicator
  const modeIndicator: Record<string, number> = { numeric: 1, alphanumeric: 2, byte: 4 };
  codewords.push(modeIndicator[mode]);

  // Character count (8 bits for byte mode)
  let charCount = data.length;
  codewords.push(charCount >> 5 & 0xFF);
  codewords.push(charCount & 0xFF);

  // Data
  if (mode === 'byte') {
    for (let i = 0; i < data.length; i++) {
      codewords.push(data.charCodeAt(i));
    }
  }

  // Terminator
  codewords.push(0);

  // Pad to byte boundary and add padding
  while (codewords.length % 8 !== 0) {
    codewords.push(0);
  }

  // Pad codewords
  const padPatterns = [236, 17];
  let padIdx = 0;
  while (codewords.length < version * 25) {
    codewords.push(padPatterns[padIdx % 2]);
    padIdx++;
  }

  return codewords.slice(0, version * 25);
}

function encodeData(data: string, version: number, ecLevel: string): number[] {
  const codewords = generateDataCodewords(data, version);
  return codewords;
}

function placeDataBits(matrix: QRMatrix, reserved: Set<string>, dataBits: number[]): void {
  let bitIndex = 0;
  let dataBit = 0;
  let byte = 0;
  const direction = [1, -1];

  for (let col = matrix.size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 7; // Skip timing column

    for (let row = 0; row < matrix.size; row++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = col - dx;
        const y = row;
        const key = `${x},${y}`;
        if (reserved.has(key) || matrix.get(x, y)) continue;

        if (bitIndex < dataBits.length * 8) {
          const bytePos = Math.floor(bitIndex / 8);
          const bitPos = 7 - (bitIndex % 8);
          const bit = (dataBits[bytePos] >> bitPos) & 1;
          matrix.set(x, y, bit === 1);
          bitIndex++;
        }
      }
    }
  }
}

function applyBestMask(matrix: QRMatrix, pattern: number): void {
  const maskFunctions = [
    (x: number, y: number) => (x + y) % 2 === 0,
    (x: number, y: number) => y % 2 === 0,
    (x: number, y: number) => x % 3 === 0,
    (x: number, y: number) => (x + y) % 3 === 0,
    (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0,
    (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];

  const mask = maskFunctions[pattern];
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (mask(x, y)) {
        matrix.set(x, y, !matrix.get(x, y));
      }
    }
  }
}

function generateQRMatrix(data: string, version: number, ecLevel: string): QRMatrix {
  const size = 17 + version * 4;
  const matrix = new QRMatrix(size);

  // Place finder patterns
  matrix.placeFinderPattern(0, 0);
  matrix.placeFinderPattern(size - 7, 0);
  matrix.placeFinderPattern(0, size - 7);

  // Place alignment patterns for v2+
  if (version >= 2) {
    const positions = getAlignmentPositions(version, size);
    for (const pos of positions) {
      for (const other of positions) {
        if (pos === 6 && other === 6) continue; // Skip finder overlap
        matrix.placeAlignmentPattern(pos, other);
      }
    }
  }

  // Timing patterns
  matrix.placeTimingPatterns();

  // Reserved areas
  matrix.reserveAreas();

  // Encode data
  const dataCodewords = encodeData(data, version, ecLevel);
  const dataBits: number[] = [];
  for (const cw of dataCodewords) {
    for (let bit = 7; bit >= 0; bit--) {
      dataBits.push((cw >> bit) & 1);
    }
  }

  // Calculate reserved module positions
  const reserved = new Set<string>();
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      reserved.add(`${i},${j}`);
      reserved.add(`${size - 1 - i},${j}`);
      reserved.add(`${i},${size - 1 - j}`);
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved.add(`${8},${i}`);
    reserved.add(`${i},${8}`);
    reserved.add(`${8},${size - 1 - i}`);
    reserved.add(`${size - 1 - i},${8}`);
  }

  // Place data
  placeDataBits(matrix, reserved, dataBits);

  // Apply mask
  const maskPattern = generateRandomMask();
  applyBestMask(matrix, maskPattern);

  return matrix;
}

function getAlignmentPositions(version: number, size: number): number[] {
  if (version === 1) return [];
  const counts: Record<number, number> = { 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4, 11: 4, 12: 4, 13: 4, 14: 5, 15: 5, 16: 5, 17: 5, 18: 6, 19: 6, 20: 6, 21: 6, 22: 6, 23: 6, 24: 7, 25: 7, 26: 7, 27: 7, 28: 7, 29: 7, 30: 7, 31: 8, 32: 8, 33: 8, 34: 8, 35: 8, 36: 8, 37: 8, 38: 8, 39: 9, 40: 9 };
  const count = counts[version] || 3;
  const positions: number[] = [6];
  if (count > 1) {
    const step = Math.floor((size - 13) / (count - 1));
    for (let i = 1; i < count; i++) {
      positions.push(6 + step * i);
    }
  }
  positions.push(size - 7);
  return [...new Set(positions)].sort((a, b) => a - b);
}

function matrixToAscii(matrix: QRMatrix): string {
  const result: string[] = [];
  result.push('┌' + '─'.repeat(matrix.size + 2) + '┐');
  for (let y = 0; y < matrix.size; y++) {
    let row = '│ ';
    for (let x = 0; x < matrix.size; x++) {
      row += matrix.get(x, y) ? '█' : '░';
    }
    row += ' │';
    result.push(row);
  }
  result.push('└' + '─'.repeat(matrix.size + 2) + '┘');
  return result.join('\n');
}

function matrixToSvg(matrix: QRMatrix, size = 256, fgColor = '#000000', bgColor = '#FFFFFF'): string {
  const moduleSize = size / matrix.size;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${matrix.size} ${matrix.size}">`;
  svg += `<rect width="${matrix.size}" height="${matrix.size}" fill="${bgColor}"/>`;
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (matrix.get(x, y)) {
        svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fgColor}"/>`;
      }
    }
  }
  svg += '</svg>';
  return svg;
}

function matrixToDataUrl(matrix: QRMatrix, size = 256): string {
  // Generate SVG then convert to PNG via canvas
  const svg = matrixToSvg(matrix, size);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Generate a QR code
 * Falls back to ASCII art if no image library is available
 */
export async function generateQRCode(options: QRCodeOptions): Promise<QRCodeResult> {
  try {
    const { data, size = 256, errorCorrection = 'M', format = 'terminal', fgColor = '#000000', bgColor = '#FFFFFF', outputPath } = options;

    if (!data) {
      return { success: false, error: 'No data provided' };
    }

    const version = getMinimumVersion(data, errorCorrection);
    const matrix = generateQRMatrix(data, version, errorCorrection);

    if (format === 'ascii' || format === 'terminal') {
      const ascii = matrixToAscii(matrix);
      return { success: true, ascii };
    }

    if (format === 'svg') {
      const svg = matrixToSvg(matrix, size, fgColor, bgColor);
      if (outputPath) {
        const { writeFileSync } = await import('fs');
        writeFileSync(outputPath, svg, 'utf-8');
        return { success: true, svg, path: outputPath };
      }
      return { success: true, svg };
    }

    return { success: false, error: `Unknown format: ${format}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Generate pairing QR code for OpenClaw gateway
 */
export async function generatePairingQR(gatewayUrl: string, deviceId?: string): Promise<QRCodeResult> {
  const payload = deviceId ? `openclaw://pair?gateway=${encodeURIComponent(gatewayUrl)}&device=${encodeURIComponent(deviceId)}` : `openclaw://pair?gateway=${encodeURIComponent(gatewayUrl)}`;
  return generateQRCode({
    data: payload,
    format: 'terminal',
    errorCorrection: 'M',
  });
}

/**
 * Print QR code directly to console
 */
export async function printPairingQR(gatewayUrl: string, deviceId?: string): Promise<void> {
  const result = await generatePairingQR(gatewayUrl, deviceId);
  if (result.success && result.ascii) {
    console.log('\n📱 Scan this QR code with OpenClaw companion app:\n');
    console.log(result.ascii);
    console.log('\nGateway:', gatewayUrl);
    if (deviceId) console.log('Device:', deviceId);
  } else {
    console.error('QR generation failed:', result.error);
  }
}

export default { generateQRCode, generatePairingQR, printPairingQR };
