// src/worker/imageWorker.ts

export type WorkerMessageType = 'PROCESS_IMAGE' | 'EXTRACT_PALETTE';

export interface ProcessPayload {
    imageData: ImageData;
    mode: 'bw' | 'color';
    width: number;
    bwThreshold: number;
    bwMethod: string;
    bwFactor: number;
    bwStretch: number;
    colorBlur: number;
    colorExtractMethod: string;
    colorPaletteMode: string;
    colorPalette: any[];
    colorCount: number;
    colorReplacements: Record<string, string>;
}

export interface WorkerMessage {
    type: WorkerMessageType;
    payload: ProcessPayload;
    id: string;
}

export interface WorkerResponse {
    type: 'RESULT' | 'ERROR' | 'PROGRESS';
    id: string;
    payload?: any;
    imageData?: ImageData;
    error?: string;
    progress?: number;
    pixelCounts?: Record<string, number>; // Added for Advanced System
}

export default {} as typeof Worker & { new(): Worker };

if (typeof self !== 'undefined') {
    self.addEventListener('message', async (e: MessageEvent<WorkerMessage>) => {
        const { type, payload, id } = e.data;
        try {
            if (type === 'PROCESS_IMAGE') {
                const { imageData: resultImageData, pixelCounts } = processImage(payload);
                (self as any).postMessage({
                    type: 'RESULT',
                    id,
                    imageData: resultImageData,
                    pixelCounts
                } as WorkerResponse, [resultImageData.data.buffer]);
            } else if (type === 'EXTRACT_PALETTE') {
                const colors = extractPalette(payload);
                (self as any).postMessage({
                    type: 'RESULT',
                    id,
                    payload: colors // Array of Hex strings
                } as WorkerResponse);
            }
        } catch (err: any) {
            (self as any).postMessage({
                type: 'ERROR',
                id,
                error: err.message
            } as WorkerResponse);
        }
    });
}

function processImage(opts: ProcessPayload): { imageData: ImageData, pixelCounts: Record<string, number> } {
    if (opts.mode === 'bw') {
        return processBlackAndWhite(opts);
    } else {
        return processColor(opts);
    }
}

const getLuminance = (r: number, g: number, b: number) => (r * 0.299 + g * 0.587 + b * 0.114);



function processBlackAndWhite(opts: ProcessPayload): { imageData: ImageData, pixelCounts: Record<string, number> } {
    const { imageData, bwThreshold, bwMethod, bwFactor, bwStretch } = opts;
    const width = imageData.width;
    const height = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);

    // 1. Convert to Grayscale & Apply Stretch
    const grayData = new Float32Array(width * height);
    let minL = 255, maxL = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const l = getLuminance(r, g, b);
        grayData[i / 4] = l;
        if (l < minL) minL = l;
        if (l > maxL) maxL = l;
    }

    if (bwMethod === 'stretch' && bwStretch !== 0) {
        const range = maxL - minL || 1;
        const stretchMult = 1 + (bwStretch / 100);
        for (let i = 0; i < grayData.length; i++) {
            let normalized = (grayData[i] - minL) / range; // 0 to 1
            // Apply stretch around center 0.5
            normalized = ((normalized - 0.5) * stretchMult) + 0.5;
            grayData[i] = Math.max(0, Math.min(255, normalized * 255));
        }
    }

    // Helper to get/set pixel in 1D array
    const getP = (x: number, y: number) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return 0;
        return grayData[y * width + x];
    };
    const addP = (x: number, y: number, amount: number) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return;
        grayData[y * width + x] += amount;
    };

    // 2. Apply chosen Dithering Algorithm
    if (bwMethod === 'bitmap') {
        for (let i = 0; i < grayData.length; i++) {
            grayData[i] = grayData[i] > bwThreshold ? 255 : 0;
        }
    } else if (bwMethod === 'random') {
        for (let i = 0; i < grayData.length; i++) {
            const noise = (Math.random() - 0.5) * (bwFactor * 255);
            grayData[i] = (grayData[i] + noise) > bwThreshold ? 255 : 0;
        }
    } else if (bwMethod === 'floyd') {
        for (let y = 0; y < height; y++) {
            const reverse = y % 2 !== 0;
            const xStart = reverse ? width - 1 : 0;
            const xEnd = reverse ? -1 : width;
            const xStep = reverse ? -1 : 1;
            const dx = reverse ? -1 : 1;

            for (let x = xStart; x !== xEnd; x += xStep) {
                const oldVal = getP(x, y);
                const newVal = oldVal > bwThreshold ? 255 : 0;
                grayData[y * width + x] = newVal;
                const err = (oldVal - newVal) * bwFactor;

                addP(x + dx, y, err * 0.4375);
                addP(x - dx, y + 1, err * 0.1875);
                addP(x, y + 1, err * 0.3125);
                addP(x + dx, y + 1, err * 0.0625);
            }
        }
    } else if (bwMethod === 'atkinson') {
        for (let y = 0; y < height; y++) {
            const reverse = y % 2 !== 0;
            const xStart = reverse ? width - 1 : 0;
            const xEnd = reverse ? -1 : width;
            const xStep = reverse ? -1 : 1;
            const dx = reverse ? -1 : 1;

            for (let x = xStart; x !== xEnd; x += xStep) {
                const oldVal = getP(x, y);
                const newVal = oldVal > bwThreshold ? 255 : 0;
                grayData[y * width + x] = newVal;
                const err = (oldVal - newVal) * bwFactor;
                const eighth = err * 0.125;

                addP(x + dx, y, eighth);
                addP(x + 2 * dx, y, eighth);
                addP(x - dx, y + 1, eighth);
                addP(x, y + 1, eighth);
                addP(x + dx, y + 1, eighth);
                addP(x, y + 2, eighth);
            }
        }
    } else if (bwMethod === 'jarvis') {
        for (let y = 0; y < height; y++) {
            const reverse = y % 2 !== 0;
            const xStart = reverse ? width - 1 : 0;
            const xEnd = reverse ? -1 : width;
            const xStep = reverse ? -1 : 1;
            const dx = reverse ? -1 : 1;

            for (let x = xStart; x !== xEnd; x += xStep) {
                const oldVal = getP(x, y);
                const newVal = oldVal > bwThreshold ? 255 : 0;
                grayData[y * width + x] = newVal;
                const err = (oldVal - newVal) * bwFactor / 48;

                addP(x + dx, y, err * 7);
                addP(x + 2 * dx, y, err * 5);
                addP(x - 2 * dx, y + 1, err * 3);
                addP(x - dx, y + 1, err * 5);
                addP(x, y + 1, err * 7);
                addP(x + dx, y + 1, err * 5);
                addP(x + 2 * dx, y + 1, err * 3);
                addP(x - 2 * dx, y + 2, err * 1);
                addP(x - dx, y + 2, err * 3);
                addP(x, y + 2, err * 5);
                addP(x + dx, y + 2, err * 3);
                addP(x + 2 * dx, y + 2, err * 1);
            }
        }
    } else if (bwMethod === 'stucki') {
        for (let y = 0; y < height; y++) {
            const reverse = y % 2 !== 0;
            const xStart = reverse ? width - 1 : 0;
            const xEnd = reverse ? -1 : width;
            const xStep = reverse ? -1 : 1;
            const dx = reverse ? -1 : 1;

            for (let x = xStart; x !== xEnd; x += xStep) {
                const oldVal = getP(x, y);
                const newVal = oldVal > bwThreshold ? 255 : 0;
                grayData[y * width + x] = newVal;
                const err = (oldVal - newVal) * bwFactor / 42;

                addP(x + dx, y, err * 8);
                addP(x + 2 * dx, y, err * 4);
                addP(x - 2 * dx, y + 1, err * 2);
                addP(x - dx, y + 1, err * 4);
                addP(x, y + 1, err * 8);
                addP(x + dx, y + 1, err * 4);
                addP(x + 2 * dx, y + 1, err * 2);
                addP(x - 2 * dx, y + 2, err * 1);
                addP(x - dx, y + 2, err * 2);
                addP(x, y + 2, err * 4);
                addP(x + dx, y + 2, err * 2);
                addP(x + 2 * dx, y + 2, err * 1);
            }
        }
    } else if (bwMethod === 'bluenoise') {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const magic = 0.06711056 * x + 0.00583715 * y;
                const ign = (52.9829189 * (magic - Math.floor(magic))) % 1.0;
                const bias = (ign - 0.5) * (bwFactor * 255);
                const val = (getP(x, y) + bias) > bwThreshold ? 255 : 0;
                grayData[y * width + x] = val;
            }
        }
    } else if (bwMethod.startsWith('bayer') || bwMethod.startsWith('clustered')) {
        let matrix: number[][] = [];
        let size = 2;
        let div = 4;

        if (bwMethod === 'bayer2') {
            matrix = [[0, 2], [3, 1]];
            size = 2;
            div = 4;
        } else if (bwMethod === 'bayer4') {
            matrix = [
                [0, 8, 2, 10],
                [12, 4, 14, 6],
                [3, 11, 1, 9],
                [15, 7, 13, 5]
            ];
            size = 4;
            div = 16;
        } else if (bwMethod === 'bayer8') {
            matrix = [
                [0, 32, 8, 40, 2, 34, 10, 42],
                [48, 16, 56, 24, 50, 18, 58, 26],
                [12, 44, 4, 36, 14, 46, 6, 38],
                [60, 28, 52, 20, 62, 30, 54, 22],
                [3, 35, 11, 43, 1, 33, 9, 41],
                [51, 19, 59, 27, 49, 17, 57, 25],
                [15, 47, 7, 39, 13, 45, 5, 37],
                [63, 31, 55, 23, 61, 29, 53, 21]
            ];
            size = 8;
            div = 64;
        } else if (bwMethod === 'clustered4') {
            matrix = [
                [12, 5, 6, 13],
                [4, 0, 1, 7],
                [11, 3, 2, 8],
                [15, 10, 9, 14]
            ];
            size = 4;
            div = 16;
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const oldVal = getP(x, y);
                const thresholdMap = (matrix[y % size][x % size] + 0.5) / div * 255;
                const bias = bwThreshold - 128; // Bias slider
                const newVal = (oldVal + bias) > thresholdMap ? 255 : 0;
                grayData[y * width + x] = newVal;
            }
        }
    }

    // 3. Reconstruct ImageData & Count Pixels
    const pixelCounts: Record<string, number> = {};
    for (let i = 0; i < data.length; i += 4) {
        const p = grayData[i / 4] > 127 ? 255 : 0; // It's already clamped to 0 or 255 by logic above, except stretch
        const oldA = data[i + 3];
        const finalA = oldA === 0 ? 0 : 255;
        data[i] = p;
        data[i + 1] = p;
        data[i + 2] = p;
        data[i + 3] = finalA; // Preserve transparent holes

        if (finalA > 0) {
            const hex = "#" + (1 << 24 | p << 16 | p << 8 | p).toString(16).slice(1);
            pixelCounts[hex] = (pixelCounts[hex] || 0) + 1;
        }
    }

    return { imageData: new ImageData(data, width, height), pixelCounts };
}

// === COLOR PROCESSING ===

function processColor(opts: ProcessPayload): { imageData: ImageData, pixelCounts: Record<string, number> } {
    const { imageData, colorPalette, bwMethod, bwFactor, bwStretch, colorReplacements } = opts;
    const width = imageData.width;
    const height = imageData.height;
    const data = new Uint8ClampedArray(imageData.data);

    const paletteCount = colorPalette.length;
    const paletteData = new Float32Array(paletteCount * 4); // r, g, b, threshold
    for (let j = 0; j < paletteCount; j++) {
        const hex = colorPalette[j].hex.replace('#', '');
        paletteData[j * 4] = parseInt(hex.substring(0, 2), 16);
        paletteData[j * 4 + 1] = parseInt(hex.substring(2, 4), 16);
        paletteData[j * 4 + 2] = parseInt(hex.substring(4, 6), 16);
        paletteData[j * 4 + 3] = colorPalette[j].threshold;
    }

    const addP = (x: number, y: number, errR: number, errG: number, errB: number) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return;
        const i = (y * width + x) * 4;
        data[i] = Math.max(0, Math.min(255, data[i] + errR));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + errG));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + errB));
    };

    let isOrdered = false;
    let mSize = 2;
    let matrixDiv = 4;
    let matrix: number[][] = [];
    if (bwMethod === 'bayer2') {
        isOrdered = true; matrix = [[0, 2], [3, 1]]; mSize = 2; matrixDiv = 4;
    } else if (bwMethod === 'bayer4') {
        isOrdered = true; matrix = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]; mSize = 4; matrixDiv = 16;
    } else if (bwMethod === 'bayer8') {
        isOrdered = true; matrix = [
            [0, 32, 8, 40, 2, 34, 10, 42],
            [48, 16, 56, 24, 50, 18, 58, 26],
            [12, 44, 4, 36, 14, 46, 6, 38],
            [60, 28, 52, 20, 62, 30, 54, 22],
            [3, 35, 11, 43, 1, 33, 9, 41],
            [51, 19, 59, 27, 49, 17, 57, 25],
            [15, 47, 7, 39, 13, 45, 5, 37],
            [63, 31, 55, 23, 61, 29, 53, 21]
        ]; mSize = 8; matrixDiv = 64;
    } else if (bwMethod === 'clustered4') {
        isOrdered = true; matrix = [
            [12, 5, 6, 13],
            [4, 0, 1, 7],
            [11, 3, 2, 8],
            [15, 10, 9, 14]
        ]; mSize = 4; matrixDiv = 16;
    }

    for (let y = 0; y < height; y++) {
        const reverse = (['floyd', 'atkinson', 'jarvis', 'stucki'].includes(bwMethod)) && (y % 2 !== 0);
        const xStart = reverse ? width - 1 : 0;
        const xEnd = reverse ? -1 : width;
        const xStep = reverse ? -1 : 1;
        const dx = reverse ? -1 : 1;

        for (let x = xStart; x !== xEnd; x += xStep) {
            const i = (y * width + x) * 4;

            const oldA = data[i + 3];
            // Removed: if (data[i + 3] === 0) continue; // Allow transparency holes to diffuse error

            const oldR = data[i];
            const oldG = data[i + 1];
            const oldB = data[i + 2];

            let queryR = oldR;
            let queryG = oldG;
            let queryB = oldB;

            if (bwMethod === 'stretch') {
                const stretchMult = 1 + (bwStretch / 100);
                const shift = ((stretchMult - 1) * 255) / 2;
                queryR = (oldR * stretchMult) - shift;
                queryG = (oldG * stretchMult) - shift;
                queryB = (oldB * stretchMult) - shift;
            } else if (bwMethod === 'random') {
                const bias = (Math.random() - 0.5) * (bwFactor * 255);
                queryR = oldR + bias;
                queryG = oldG + bias;
                queryB = oldB + bias;
            } else if (bwMethod === 'bluenoise') {
                const magic = 0.06711056 * x + 0.00583715 * y;
                const ign = (52.9829189 * (magic - Math.floor(magic))) % 1.0;
                const bias = (ign - 0.5) * (bwFactor * 255);
                queryR = oldR + bias;
                queryG = oldG + bias;
                queryB = oldB + bias;
            } else if (isOrdered) {
                const bVal = matrix[y % mSize][x % mSize];
                const bias = (((bVal + 0.5) / matrixDiv) - 0.5) * (bwFactor * 255);
                queryR = oldR + bias;
                queryG = oldG + bias;
                queryB = oldB + bias;
            }

            queryR = Math.max(0, Math.min(255, queryR));
            queryG = Math.max(0, Math.min(255, queryG));
            queryB = Math.max(0, Math.min(255, queryB));

            let closestIdx = 0;
            let minDist = Infinity;

            for (let j = 0; j < paletteCount; j++) {
                const pr = paletteData[j * 4];
                const pg = paletteData[j * 4 + 1];
                const pb = paletteData[j * 4 + 2];

                // Inline Redmean Distance
                const r_mean = (queryR + pr) / 2;
                const dr = queryR - pr;
                const dg = queryG - pg;
                const db = queryB - pb;
                const dist = (2 + r_mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r_mean) / 256) * db * db;

                if (dist < minDist) {
                    minDist = dist;
                    closestIdx = j;
                }
            }

            const matchColorR = paletteData[closestIdx * 4];
            const matchColorG = paletteData[closestIdx * 4 + 1];
            const matchColorB = paletteData[closestIdx * 4 + 2];
            const matchThreshold = paletteData[closestIdx * 4 + 3];
            const matchHex = "#" + (1 << 24 | matchColorR << 16 | matchColorG << 8 | matchColorB).toString(16).slice(1);

            let finalOutputR = matchColorR;
            let finalOutputG = matchColorG;
            let finalOutputB = matchColorB;

            if (colorReplacements && colorReplacements[matchHex]) {
                const repHex = colorReplacements[matchHex];
                finalOutputR = parseInt(repHex.slice(1, 3), 16);
                finalOutputG = parseInt(repHex.slice(3, 5), 16);
                finalOutputB = parseInt(repHex.slice(5, 7), 16);
            }

            const L = getLuminance(oldR, oldG, oldB) / 255.0;

            if (L <= matchThreshold) {
                data[i] = finalOutputR;
                data[i + 1] = finalOutputG;
                data[i + 2] = finalOutputB;
                data[i + 3] = oldA === 0 ? 0 : 255; // Preserve transparent holes
            } else {
                data[i] = 0;
                data[i + 1] = 0;
                data[i + 2] = 0;
                data[i + 3] = 0;
            }

            // CRITICAL: Error diffusion must still compute from the ORIGINAL matched color
            const errR = (oldR - matchColorR) * bwFactor;
            const errG = (oldG - matchColorG) * bwFactor;
            const errB = (oldB - matchColorB) * bwFactor;

            if (bwMethod === 'floyd') {
                addP(x + dx, y, errR * 0.4375, errG * 0.4375, errB * 0.4375);
                addP(x - dx, y + 1, errR * 0.1875, errG * 0.1875, errB * 0.1875);
                addP(x, y + 1, errR * 0.3125, errG * 0.3125, errB * 0.3125);
                addP(x + dx, y + 1, errR * 0.0625, errG * 0.0625, errB * 0.0625);
            } else if (bwMethod === 'atkinson') {
                const eighthR = errR * 0.125, eighthG = errG * 0.125, eighthB = errB * 0.125;
                addP(x + dx, y, eighthR, eighthG, eighthB);
                addP(x + 2 * dx, y, eighthR, eighthG, eighthB);
                addP(x - dx, y + 1, eighthR, eighthG, eighthB);
                addP(x, y + 1, eighthR, eighthG, eighthB);
                addP(x + dx, y + 1, eighthR, eighthG, eighthB);
                addP(x, y + 2, eighthR, eighthG, eighthB);
            } else if (bwMethod === 'jarvis') {
                const r48 = errR / 48, g48 = errG / 48, b48 = errB / 48;
                addP(x + dx, y, r48 * 7, g48 * 7, b48 * 7);
                addP(x + 2 * dx, y, r48 * 5, g48 * 5, b48 * 5);
                addP(x - 2 * dx, y + 1, r48 * 3, g48 * 3, b48 * 3);
                addP(x - dx, y + 1, r48 * 5, g48 * 5, b48 * 5);
                addP(x, y + 1, r48 * 7, g48 * 7, b48 * 7);
                addP(x + dx, y + 1, r48 * 5, g48 * 5, b48 * 5);
                addP(x + 2 * dx, y + 1, r48 * 3, g48 * 3, b48 * 3);
                addP(x - 2 * dx, y + 2, r48 * 1, g48 * 1, b48 * 1);
                addP(x - dx, y + 2, r48 * 3, g48 * 3, b48 * 3);
                addP(x, y + 2, r48 * 5, g48 * 5, b48 * 5);
                addP(x + dx, y + 2, r48 * 3, g48 * 3, b48 * 3);
                addP(x + 2 * dx, y + 2, r48 * 1, g48 * 1, b48 * 1);
            } else if (bwMethod === 'stucki') {
                const r42 = errR / 42, g42 = errG / 42, b42 = errB / 42;
                addP(x + dx, y, r42 * 8, g42 * 8, b42 * 8);
                addP(x + 2 * dx, y, r42 * 4, g42 * 4, b42 * 4);
                addP(x - 2 * dx, y + 1, r42 * 2, g42 * 2, b42 * 2);
                addP(x - dx, y + 1, r42 * 4, g42 * 4, b42 * 4);
                addP(x, y + 1, r42 * 8, g42 * 8, b42 * 8);
                addP(x + dx, y + 1, r42 * 4, g42 * 4, b42 * 4);
                addP(x + 2 * dx, y + 1, r42 * 2, g42 * 2, b42 * 2);
                addP(x - 2 * dx, y + 2, r42 * 1, g42 * 1, b42 * 1);
                addP(x - dx, y + 2, r42 * 2, g42 * 2, b42 * 2);
                addP(x, y + 2, r42 * 4, g42 * 4, b42 * 4);
                addP(x + dx, y + 2, r42 * 2, g42 * 2, b42 * 2);
                addP(x + 2 * dx, y + 2, r42 * 1, g42 * 1, b42 * 1);
            }
        }
    }

    const pixelCounts: Record<string, number> = {};

    // Apply color replacements (Advanced Panel Swap)
    const hasReplacements = colorReplacements && Object.keys(colorReplacements).length > 0;
    if (hasReplacements) {
        // Pre-parse replacement map for speed
        const rMap: Map<number, [number, number, number]> = new Map();
        for (const [fromHex, toHex] of Object.entries(colorReplacements)) {
            const fh = fromHex.replace('#', '');
            const th = toHex.replace('#', '');
            const key = (parseInt(fh.slice(0, 2), 16) << 16) | (parseInt(fh.slice(2, 4), 16) << 8) | parseInt(fh.slice(4, 6), 16);
            const tr = parseInt(th.slice(0, 2), 16);
            const tg = parseInt(th.slice(2, 4), 16);
            const tb = parseInt(th.slice(4, 6), 16);
            rMap.set(key, [tr, tg, tb]);
        }
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
            const rep = rMap.get(key);
            if (rep) {
                data[i] = rep[0];
                data[i + 1] = rep[1];
                data[i + 2] = rep[2];
            }
        }
    }

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const hex = "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
            pixelCounts[hex] = (pixelCounts[hex] || 0) + 1;
        }
    }

    return { imageData: new ImageData(data, width, height), pixelCounts };
}

// Helper: LAB Conversion
function rgbToLab(r: number, g: number, b: number) {
    let r_s = r / 255, g_s = g / 255, b_s = b / 255;
    r_s = r_s > 0.04045 ? Math.pow((r_s + 0.055) / 1.055, 2.4) : r_s / 12.92;
    g_s = g_s > 0.04045 ? Math.pow((g_s + 0.055) / 1.055, 2.4) : g_s / 12.92;
    b_s = b_s > 0.04045 ? Math.pow((b_s + 0.055) / 1.055, 2.4) : b_s / 12.92;
    const x = (r_s * 0.4124 + g_s * 0.3576 + b_s * 0.1805) / 0.95047;
    const y = (r_s * 0.2126 + g_s * 0.7152 + b_s * 0.0722) / 1.00000;
    const z = (r_s * 0.0193 + g_s * 0.1192 + b_s * 0.9505) / 1.08883;
    const fx = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
    const fy = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
    const fz = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;
    return [(116 * fy) - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function extractPalette(opts: ProcessPayload): string[] {
    const { imageData, colorExtractMethod, colorPalette } = opts;
    const targetK = colorPalette.length;
    const data = imageData.data;

    // 1. Sample max 10,000 pixels for speed
    const samples: { r: number, g: number, b: number }[] = [];
    const step = Math.max(1, Math.floor((data.length / 4) / 10000));

    for (let i = 0; i < data.length; i += 4 * step) {
        if (data[i + 3] > 0) {
            samples.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
        }
    }

    if (samples.length === 0) return Array(targetK).fill('#000000');

    if (colorExtractMethod === 'kmeans') {
        return extractKMeans(samples, targetK);
    } else if (colorExtractMethod === 'histogram') {
        return extractHistogram(samples, targetK);
    } else if (colorExtractMethod === 'hue') {
        return extractHueClustering(samples, targetK);
    } else if (colorExtractMethod === 'extreme') {
        return extractExtreme(samples, targetK);
    } else if (colorExtractMethod === 'pronounced') {
        return extractPronounced(samples, targetK);
    } else if (colorExtractMethod === 'varied') {
        return extractVaried(samples, targetK);
    } else if (colorExtractMethod === 'distant') {
        return extractDistant(samples, targetK);
    } else if (colorExtractMethod === 'contrasting') {
        return extractContrasting(samples, targetK);
    } else {
        return extractMedianCut(samples, targetK);
    }
}

// Simple K-Means in LAB space as requested for human eye accuracy
// Helper functions defined above
function extractKMeans(samples: { r: number, g: number, b: number }[], k: number): string[] {
    // We convert samples to lab once
    const labSamples = samples.map(s => {
        const lab = rgbToLab(s.r, s.g, s.b);
        return { l: lab[0], a: lab[1], b: lab[2], point: s };
    });

    let centroids = [];
    for (let i = 0; i < k; i++) {
        centroids.push(labSamples[Math.floor(Math.random() * labSamples.length)]);
    }

    let iterations = 0;
    let changed = true;
    let assignments = new Array(labSamples.length).fill(0);

    while (changed && iterations < 20) {
        changed = false;
        iterations++;

        for (let i = 0; i < labSamples.length; i++) {
            const p = labSamples[i];
            let minDist = Infinity;
            let bestK = 0;
            for (let j = 0; j < k; j++) {
                const c = centroids[j];
                const dist = (p.l - c.l) ** 2 + (p.a - c.a) ** 2 + (p.b - c.b) ** 2;
                if (dist < minDist) {
                    minDist = dist;
                    bestK = j;
                }
            }
            if (assignments[i] !== bestK) {
                changed = true;
                assignments[i] = bestK;
            }
        }

        const sums = Array.from({ length: k }, () => ({ l: 0, a: 0, b: 0, point: { r: 0, g: 0, b: 0 }, count: 0 }));
        for (let i = 0; i < labSamples.length; i++) {
            const cluster = assignments[i];
            sums[cluster].l += labSamples[i].l;
            sums[cluster].a += labSamples[i].a;
            sums[cluster].b += labSamples[i].b;
            sums[cluster].point.r += labSamples[i].point.r; // Accumulate RGB to easily get average RGB 
            sums[cluster].point.g += labSamples[i].point.g;
            sums[cluster].point.b += labSamples[i].point.b;
            sums[cluster].count += 1;
        }

        for (let j = 0; j < k; j++) {
            if (sums[j].count > 0) {
                centroids[j] = {
                    l: sums[j].l / sums[j].count,
                    a: sums[j].a / sums[j].count,
                    b: sums[j].b / sums[j].count,
                    point: {
                        r: Math.round(sums[j].point.r / sums[j].count),
                        g: Math.round(sums[j].point.g / sums[j].count),
                        b: Math.round(sums[j].point.b / sums[j].count),
                    }
                };
            }
        }
    }

    return centroids.map(c => rgbToHex(c.point.r, c.point.g, c.point.b));
}

// Median Cut implementation natively uses RGB as requested "greatest range"
function extractMedianCut(samples: { r: number, g: number, b: number }[], k: number): string[] {
    let boxes = [samples];

    while (boxes.length < k) {
        let splitBoxIdx = -1;
        let maxRange = -1;
        let longestChannel: 'r' | 'g' | 'b' = 'r';

        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            if (box.length < 2) continue;
            let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
            for (let j = 0; j < box.length; j++) {
                const p = box[j];
                if (p.r < minR) minR = p.r; if (p.r > maxR) maxR = p.r;
                if (p.g < minG) minG = p.g; if (p.g > maxG) maxG = p.g;
                if (p.b < minB) minB = p.b; if (p.b > maxB) maxB = p.b;
            }
            const rRange = maxR - minR;
            const gRange = maxG - minG;
            const bRange = maxB - minB;

            const currentMax = Math.max(rRange, gRange, bRange);
            if (currentMax > maxRange) {
                maxRange = currentMax;
                splitBoxIdx = i;
                if (currentMax === rRange) longestChannel = 'r';
                else if (currentMax === gRange) longestChannel = 'g';
                else longestChannel = 'b';
            }
        }

        if (splitBoxIdx === -1) break;

        const targetBox = boxes[splitBoxIdx];
        targetBox.sort((a, b) => a[longestChannel] - b[longestChannel]);
        const mid = Math.floor(targetBox.length / 2);
        const box1 = targetBox.slice(0, mid);
        const box2 = targetBox.slice(mid);

        boxes.splice(splitBoxIdx, 1, box1, box2);
    }

    return boxes.map(box => {
        let rSum = 0, gSum = 0, bSum = 0;
        for (let i = 0; i < box.length; i++) {
            rSum += box[i].r; gSum += box[i].g; bSum += box[i].b;
        }
        return rgbToHex(Math.round(rSum / box.length), Math.round(gSum / box.length), Math.round(bSum / box.length));
    });
}

function rgbToHex(r: number, g: number, b: number) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

function rgbToHsl(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, l * 100];
}

function extractHistogram(samples: { r: number, g: number, b: number }[], k: number): string[] {
    const counts = new Map<string, number>();
    for (const s of samples) {
        const qr = (s.r >> 3) << 3;
        const qg = (s.g >> 3) << 3;
        const qb = (s.b >> 3) << 3;
        const key = `${qr},${qg},${qb}`;
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const res = sorted.slice(0, k).map(entry => {
        const [r, g, b] = entry[0].split(',').map(Number);
        return rgbToHex(r, g, b);
    });
    while (res.length < k) res.push("#000000");
    return res;
}

function extractHueClustering(samples: { r: number, g: number, b: number }[], k: number): string[] {
    const bins = Array.from({ length: 36 }, () => [] as { h: number, s: number, l: number, r: number, g: number, b: number }[]);
    for (const s of samples) {
        const [h, sat, l] = rgbToHsl(s.r, s.g, s.b);
        const binIdx = Math.floor(h / 10) % 36;
        bins[binIdx].push({ h, s: sat, l, r: s.r, g: s.g, b: s.b });
    }
    bins.sort((a, b) => b.length - a.length);
    const topBins = bins.slice(0, k);
    const result: string[] = [];
    for (const bin of topBins) {
        if (bin.length === 0) continue;
        let best = bin[0];
        for (const p of bin) if (p.s > best.s) best = p;
        result.push(rgbToHex(best.r, best.g, best.b));
    }
    while (result.length < k) result.push("#000000");
    return result.slice(0, k);
}

function extractExtreme(samples: { r: number, g: number, b: number }[], k: number): string[] {
    const hsmap = samples.map(s => {
        const [h, sat, l] = rgbToHsl(s.r, s.g, s.b);
        return { r: s.r, g: s.g, b: s.b, h, s: sat, l };
    });
    const lightest = [...hsmap].sort((a, b) => b.l - a.l)[0];
    const darkest = [...hsmap].sort((a, b) => a.l - b.l)[0];
    const mostSat = [...hsmap].sort((a, b) => b.s - a.s)[0];
    const leastSat = [...hsmap].sort((a, b) => a.s - b.s)[0];
    const resultColors = [lightest, darkest, mostSat, leastSat].filter(x => x !== undefined);

    if (resultColors.length < k) {
        const mids = [...hsmap].sort((a, b) => Math.abs(a.l - 50) - Math.abs(b.l - 50));
        for (const m of mids) {
            if (resultColors.length >= k) break;
            if (!resultColors.includes(m)) resultColors.push(m);
        }
    }
    const res = resultColors.slice(0, k).map(c => rgbToHex(c.r, c.g, c.b));
    while (res.length < k) res.push("#000000");
    return res;
}

function extractPronounced(samples: { r: number, g: number, b: number }[], k: number): string[] {
    const scored = samples.map(s => {
        const [, sat, l] = rgbToHsl(s.r, s.g, s.b);
        const score = sat * (1 - Math.abs(l - 50) / 50);
        return { r: s.r, g: s.g, b: s.b, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const res: string[] = [];
    const seen = new Set<string>();
    for (const s of scored) {
        const hex = rgbToHex(s.r, s.g, s.b);
        if (!seen.has(hex)) {
            seen.add(hex);
            res.push(hex);
        }
        if (res.length === k) break;
    }
    while (res.length < k) res.push("#000000");
    return res;
}

function extractVaried(samples: { r: number, g: number, b: number }[], k: number): string[] {
    const bins = Array.from({ length: 36 }, () => [] as { h: number, s: number, l: number, r: number, g: number, b: number }[]);
    for (const s of samples) {
        const [h, sat, l] = rgbToHsl(s.r, s.g, s.b);
        const binIdx = Math.floor(h / 10) % 36;
        bins[binIdx].push({ h, s: sat, l, r: s.r, g: s.g, b: s.b });
    }

    const populatedBins = bins.map((b, i) => ({ idx: i, bin: b })).filter(x => x.bin.length > 0);
    if (populatedBins.length === 0) return Array(k).fill("#000000");

    const result: string[] = [];
    const step = Math.max(1, populatedBins.length / k);
    for (let i = 0; i < k; i++) {
        const targetIdx = Math.floor(i * step) % populatedBins.length;
        const bin = populatedBins[targetIdx].bin;
        if (bin && bin.length > 0) {
            let best = bin[0];
            for (const p of bin) if (p.s > best.s) best = p;
            const hex = rgbToHex(best.r, best.g, best.b);
            if (!result.includes(hex)) result.push(hex);
        }
    }
    if (result.length < k) {
        let allColors = [];
        for (const bin of bins) {
            let best = bin[0];
            if (!best) continue;
            for (const p of bin) if (p.s > best.s) best = p;
            allColors.push(best);
        }
        allColors.sort((a, b) => b.s - a.s);
        for (const c of allColors) {
            if (result.length >= k) break;
            const hex = rgbToHex(c.r, c.g, c.b);
            if (!result.includes(hex)) result.push(hex);
        }
    }
    while (result.length < k) result.push("#000000");
    return result.slice(0, k);
}

function extractDistant(samples: { r: number, g: number, b: number }[], k: number): string[] {
    const labSamples = samples.map(s => {
        const lab = rgbToLab(s.r, s.g, s.b);
        return { l: lab[0], a: lab[1], lb: lab[2], r: s.r, g: s.g, b: s.b };
    });
    const result = [labSamples[Math.floor(Math.random() * labSamples.length)]];

    while (result.length < k) {
        let maxMinDist = -1;
        let bestCandidate = labSamples[0];

        for (const sample of labSamples) {
            let minDist = Infinity;
            for (const picked of result) {
                const distSq = (sample.l - picked.l) ** 2 + (sample.a - picked.a) ** 2 + (sample.lb - picked.lb) ** 2;
                if (distSq < minDist) minDist = distSq;
            }
            if (minDist > maxMinDist) {
                maxMinDist = minDist;
                bestCandidate = sample;
            }
        }
        result.push(bestCandidate);
    }
    return result.map(c => rgbToHex(c.r, c.g, c.b));
}

function extractContrasting(samples: { r: number, g: number, b: number }[], k: number): string[] {
    const lumSamples = samples.map(s => {
        const l = getLuminance(s.r, s.g, s.b) / 255.0; // 0 to 1
        return { r: s.r, g: s.g, b: s.b, lum: l };
    });

    let brightest = lumSamples[0];
    for (const s of lumSamples) if (s.lum > brightest.lum) brightest = s;
    const result = [brightest];

    while (result.length < k) {
        let maxMinContrast = -1;
        let bestCandidate = lumSamples[0];

        for (const sample of lumSamples) {
            let minContrast = Infinity;
            for (const picked of result) {
                const l1 = Math.max(sample.lum, picked.lum);
                const l2 = Math.min(sample.lum, picked.lum);
                const contrast = (l1 + 0.05) / (l2 + 0.05);
                if (contrast < minContrast) minContrast = contrast;
            }
            if (minContrast > maxMinContrast) {
                maxMinContrast = minContrast;
                bestCandidate = sample;
            }
        }
        result.push(bestCandidate);
    }
    return result.map(c => rgbToHex(c.r, c.g, c.b));
}
