import piexif from 'piexifjs';
// @ts-ignore
import ImageTracer from 'imagetracerjs';
import { saveAs } from 'file-saver';

/**
 * Injects DPI into a base64 Data URL (JPEG) using Exif metadata.
 */
function injectDPI(dataUrl: string, dpi: number): string {
    // Only works for JPEG with Piexif
    if (!dataUrl.startsWith('data:image/jpeg')) return dataUrl;

    try {
        const zeroth: any = {};
        zeroth[piexif.ImageIFD.XResolution] = [dpi, 1];
        zeroth[piexif.ImageIFD.YResolution] = [dpi, 1];
        zeroth[piexif.ImageIFD.ResolutionUnit] = 2; // Inches

        const exifObj = { "0th": zeroth };
        const exifBytes = piexif.dump(exifObj);
        return piexif.insert(exifBytes, dataUrl);
    } catch (e) {
        console.error("DPI injection failed:", e);
        return dataUrl;
    }
}

/**
 * Triggers a download of a raster image (PNG or JPG) from a canvas.
 */
export function exportRaster(canvas: HTMLCanvasElement, filename: string, format: 'png' | 'jpeg', dpi: 72 | 300) {
    if (format === 'png') {
        canvas.toBlob((blob) => {
            if (blob) {
                // Ensure filename has extension exactly once
                const cleanName = filename.toLowerCase().endsWith('.png') ? filename : `${filename}.png`;
                saveAs(blob, cleanName);
            }
        }, 'image/png');
    } else {
        const quality = 1.0;
        if (dpi === 300) {
            // For 300 DPI, we still need to convert to DataURL to inject EXIF
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            const finalDataUrl = injectDPI(dataUrl, 300);
            fetch(finalDataUrl)
                .then(res => res.blob())
                .then(blob => {
                    const cleanName = filename.toLowerCase().endsWith('.jpg') ? filename : `${filename}.jpg`;
                    saveAs(blob, cleanName);
                });
        } else {
            // Native blob saving for 72DPI (standard)
            canvas.toBlob((blob) => {
                if (blob) {
                    const cleanName = filename.toLowerCase().endsWith('.jpg') ? filename : `${filename}.jpg`;
                    saveAs(blob, cleanName);
                }
            }, 'image/jpeg', quality);
        }
    }
}

/**
 * Traces the canvas data to SVG using ImageTracer.js
 */
export function exportSVG(canvas: HTMLCanvasElement, filename: string, mode: 'bw' | 'color', paletteHex: string[]) {
    const dataUrl = canvas.toDataURL('image/png');

    // Config based on ImageTracer.js standard options
    const options: any = {
        scale: 1, // Don't scale the coordinates, keep pixel perfect
        corsenabled: false,
        layering: 0, // 0 for sequential layering
        // Settings tuned for pixelart style
        ltres: 0.1,
        qtres: 0.1,
        pathomit: 0,
        rightangleenhance: true,
    };

    if (mode === 'color' && paletteHex && paletteHex.length > 0) {
        // Custom palette
        options.pal = paletteHex.map(hex => {
            const r = parseInt(hex.substring(1, 3), 16);
            const g = parseInt(hex.substring(3, 5), 16);
            const b = parseInt(hex.substring(5, 7), 16);
            return { r, g, b, a: 255 };
        }).concat([{ r: 0, g: 0, b: 0, a: 0 }]); // Add trans
        options.colorquantcycles = 1;
    } else {
        // B&W
        options.pal = [
            { r: 0, g: 0, b: 0, a: 255 },
            { r: 255, g: 255, b: 255, a: 255 },
            { r: 0, g: 0, b: 0, a: 0 }
        ];
        options.colorquantcycles = 1;
    }

    ImageTracer.imageToSVG(
        dataUrl,
        (svgstr: string) => {
            const blob = new Blob([svgstr], { type: "image/svg+xml;charset=utf-8" });
            saveAs(blob, `${filename}.svg`);
        },
        options
    );
}
