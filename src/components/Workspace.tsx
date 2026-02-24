import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { v4 as uuidv4 } from 'uuid';
import type { WorkerMessage, WorkerResponse, ProcessPayload } from '../worker/imageWorker';
import { exportRaster, exportSVG } from '../utils/exportUtils';

const Workspace: React.FC = () => {
    const { settings, updateSettings } = useSettings();
    const containerRef = useRef<HTMLDivElement>(null);
    const baseCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

    // Viewport State
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isHoveringFile, setIsHoveringFile] = useState(false);
    const [showOriginal, setShowOriginal] = useState(false);
    const [visualSize, setVisualSize] = useState({ width: 0, height: 0 });

    // Processing State
    const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const workerRef = useRef<Worker | null>(null);
    const currentJobId = useRef<string | null>(null);
    const lastResultRef = useRef<ImageData | null>(null);
    const isExtractingRef = useRef(false); // Sync ref to prevent race with processImage

    // Initialize Worker
    useEffect(() => {
        workerRef.current = new Worker(new URL('../worker/imageWorker.ts', import.meta.url), { type: 'module' });

        workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
            if (e.data.id === currentJobId.current) {
                if (e.data.type === 'RESULT' && e.data.imageData) {
                    lastResultRef.current = e.data.imageData; // Store for export
                    if (e.data.pixelCounts) {
                        updateSettings({ pixelCounts: e.data.pixelCounts });
                    }
                    const canvas = baseCanvasRef.current;
                    const overlayCanvas = overlayCanvasRef.current;
                    if (canvas && overlayCanvas) {
                        const scale = settings.ditherScale || 1;
                        const w = e.data.imageData.width * scale;
                        const h = e.data.imageData.height * scale;

                        canvas.width = w;
                        canvas.height = h;

                        // Only resize overlay if it doesn't match
                        if (overlayCanvas.width !== w || overlayCanvas.height !== h) {
                            overlayCanvas.width = w;
                            overlayCanvas.height = h;
                        }

                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.imageSmoothingEnabled = false;
                            const tempCanvas = document.createElement('canvas');
                            tempCanvas.width = e.data.imageData.width;
                            tempCanvas.height = e.data.imageData.height;
                            tempCanvas.getContext('2d')?.putImageData(e.data.imageData, 0, 0);
                            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
                        }
                    }
                    setIsProcessing(false);
                } else if (e.data.type === 'RESULT' && e.data.payload) { // Extract Palette Result array
                    const hexColors = e.data.payload as string[];

                    // Maintain existing thresholds if possible
                    updateSettings({
                        colorPalette: hexColors.map((hex, idx) => ({
                            id: settings.colorPalette[idx]?.id || uuidv4(),
                            hex: hex,
                            threshold: settings.colorPalette[idx]?.threshold || 1.0
                        }))
                    });
                    setIsExtracting(false);
                    isExtractingRef.current = false;
                    // The settings update will trigger the processImage useEffect naturally.
                } else if (e.data.type === 'ERROR') {
                    console.error('Worker Error:', e.data.error);
                    setIsProcessing(false);
                    setIsExtracting(false);
                    isExtractingRef.current = false;
                }
            }
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Effect for Auto-Extraction Trigger
    // Trigger on image load, extract method change, or palette array SIZE change
    useEffect(() => {
        if (settings.mode !== 'color' || settings.colorPaletteMode !== 'auto' || !sourceImage || !workerRef.current) {
            if (settings.mode === 'bw') setIsExtracting(false); // Safety reset
            return;
        }

        console.log("Triggering auto-extraction due to change in mode/settings");
        isExtractingRef.current = true; // Set synchronously to block processImage in same render
        triggerExtraction();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceImage, settings.colorExtractMethod, settings.colorCount, settings.mode, settings.colorPaletteMode]);

    const triggerExtraction = () => {
        if (!sourceImage || !workerRef.current) return;
        setIsExtracting(true);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 100; // Sample small for speed before sending
        tempCanvas.height = Math.round(sourceImage.height * (100 / sourceImage.width));
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(sourceImage, 0, 0, tempCanvas.width, tempCanvas.height);
        const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

        const jobId = uuidv4();
        currentJobId.current = jobId;

        workerRef.current.postMessage({
            type: 'EXTRACT_PALETTE',
            payload: { imageData, colorExtractMethod: settings.colorExtractMethod, colorPalette: settings.colorPalette, colorCount: settings.colorCount } as any,
            id: jobId
        });
    };

    // Main Process Image Trigger
    useEffect(() => {
        if (!sourceImage || !workerRef.current) return;
        if (isExtractingRef.current || isExtracting) return; // Block if extraction is running (check ref for same-render race)

        processImage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        sourceImage,
        settings.mode,
        settings.width, settings.ditherScale, settings.colorCount,
        settings.bwThreshold, settings.bwMethod, settings.bwFactor, settings.bwStretch,
        settings.colorBlur, settings.colorPalette, isExtracting
    ]);

    const processImage = useCallback(() => {
        if (!sourceImage || !workerRef.current || isExtracting) return;
        setIsProcessing(true);

        const baseWidth = Math.min(settings.width, sourceImage.width);
        const baseHeight = Math.round(sourceImage.height * (baseWidth / sourceImage.width));

        const targetWidth = Math.max(1, Math.floor(baseWidth / settings.ditherScale));
        const targetHeight = Math.max(1, Math.floor(baseHeight / settings.ditherScale));

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        // Apply blur roughly if requested
        if (settings.colorBlur > 0) {
            ctx.filter = `blur(${settings.colorBlur}px)`;
        }
        ctx.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);
        ctx.filter = 'none'; // reset
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);

        const jobId = uuidv4();
        currentJobId.current = jobId;

        const payload: ProcessPayload = {
            imageData,
            mode: settings.mode,
            width: targetWidth,
            bwThreshold: settings.bwThreshold,
            bwMethod: settings.bwMethod,
            bwFactor: settings.bwFactor,
            bwStretch: settings.bwStretch,
            colorBlur: settings.colorBlur,
            colorExtractMethod: settings.colorExtractMethod,
            colorPaletteMode: settings.colorPaletteMode,
            colorPalette: settings.colorPalette,
            colorCount: settings.colorCount,
            colorReplacements: settings.colorReplacements
        };

        workerRef.current.postMessage({ type: 'PROCESS_IMAGE', payload, id: jobId } as WorkerMessage, [imageData.data.buffer]);
    }, [sourceImage, settings, isExtracting]);

    // Viewport Handling
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        if (!containerRef.current) return;
        const zoomSensitivity = 0.001;
        const delta = e.deltaY * -1;
        const newScale = Math.min(Math.max(0.1, scale + delta * zoomSensitivity * scale), 20);
        const rect = containerRef.current.getBoundingClientRect();
        const cursorX = e.clientX - rect.left - rect.width / 2;
        const cursorY = e.clientY - rect.top - rect.height / 2;
        const scaleRatio = newScale / scale;
        const newX = cursorX - (cursorX - position.x) * scaleRatio;
        const newY = cursorY - (cursorY - position.y) * scaleRatio;
        setScale(newScale);
        setPosition({ x: newX, y: newY });
    }, [scale, position]);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('wheel', handleWheel as any, { passive: false });
            return () => container.removeEventListener('wheel', handleWheel as any);
        }
    }, [handleWheel]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.shiftKey) || e.button === 0) {
            // Pan
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsHoveringFile(true); };
    const handleDragLeave = () => setIsHoveringFile(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsHoveringFile(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFile = (file: File) => {
        if (!file.type.startsWith('image/')) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            setSourceImage(img);
            const baseVisualW = Math.min(1000, img.width);
            const baseVisualH = img.height * (baseVisualW / img.width);
            setVisualSize({ width: baseVisualW, height: baseVisualH });
            setScale(1);
            setPosition({ x: 0, y: 0 });
        };
        img.src = url;
    };

    useEffect(() => {
        const handleUploadEvent = (e: CustomEvent<File>) => handleFile(e.detail);
        window.addEventListener('IMAGE_UPLOADED', handleUploadEvent as EventListener);
        return () => window.removeEventListener('IMAGE_UPLOADED', handleUploadEvent as EventListener);
    }, []);

    // Export Listeners
    useEffect(() => {
        const getFilename = () => {
            const now = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
            const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
            return `${settings.originalFilename}_DitherBoss_${dateStr}_${timeStr}`;
        };

        const handlePNGExport = async () => {
            if (!lastResultRef.current || !sourceImage || !baseCanvasRef.current) return;

            const exportCanvas = document.createElement('canvas');

            if (settings.pixelFidelity) {
                exportCanvas.width = baseCanvasRef.current.width;
                exportCanvas.height = baseCanvasRef.current.height;
                exportCanvas.getContext('2d')?.drawImage(baseCanvasRef.current, 0, 0);
            } else {
                exportCanvas.width = sourceImage.width;
                exportCanvas.height = sourceImage.height;
                const ctx = exportCanvas.getContext('2d');
                if (ctx) {
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(baseCanvasRef.current, 0, 0, exportCanvas.width, exportCanvas.height);
                }
            }
            exportRaster(exportCanvas, getFilename(), 'png', settings.exportDpi);
        };

        const handleJPEGExport = async () => {
            if (!lastResultRef.current || !sourceImage || !baseCanvasRef.current) return;

            const exportCanvas = document.createElement('canvas');

            if (settings.pixelFidelity) {
                exportCanvas.width = baseCanvasRef.current.width;
                exportCanvas.height = baseCanvasRef.current.height;
                exportCanvas.getContext('2d')?.drawImage(baseCanvasRef.current, 0, 0);
            } else {
                exportCanvas.width = sourceImage.width;
                exportCanvas.height = sourceImage.height;
                const ctx = exportCanvas.getContext('2d');
                if (ctx) {
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(baseCanvasRef.current, 0, 0, exportCanvas.width, exportCanvas.height);
                }
            }
            exportRaster(exportCanvas, getFilename(), 'jpeg', settings.exportDpi);
        };

        const handleSVGExport = async () => {
            if (!lastResultRef.current || !baseCanvasRef.current) return;
            const hexArr = settings.colorPalette.map(c => c.hex);

            exportSVG(baseCanvasRef.current, getFilename(), settings.mode, hexArr);
        };

        window.addEventListener('EXPORT_PNG', handlePNGExport);
        window.addEventListener('EXPORT_JPEG', handleJPEGExport);
        window.addEventListener('EXPORT_SVG', handleSVGExport);
        return () => {
            window.removeEventListener('EXPORT_PNG', handlePNGExport);
            window.removeEventListener('EXPORT_JPEG', handleJPEGExport);
            window.removeEventListener('EXPORT_SVG', handleSVGExport);
        };
    }, [
        settings.exportDpi,
        settings.mode,
        settings.colorPalette,
        settings.pixelFidelity,
        settings.originalFilename,
        sourceImage,
        settings.pixelCounts // Add to trigger effect
    ]);

    // Handle Overlay rendering
    useEffect(() => {
        const baseCanvas = baseCanvasRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        if (!baseCanvas || !overlayCanvas) return;

        const oCtx = overlayCanvas.getContext('2d', { willReadFrequently: true });
        if (!oCtx) return;

        // Clear overlay always
        oCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        if (!settings.hoveredColor) return; // Nothing hovered

        // Draw matching pixels to overlay
        const bCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
        if (!bCtx) return;

        const imgData = bCtx.getImageData(0, 0, baseCanvas.width, baseCanvas.height);
        const data = imgData.data;

        const outImgData = new ImageData(baseCanvas.width, baseCanvas.height);
        const outData = outImgData.data;

        const hr = parseInt(settings.hoveredColor.slice(1, 3), 16);
        const hg = parseInt(settings.hoveredColor.slice(3, 5), 16);
        const hb = parseInt(settings.hoveredColor.slice(5, 7), 16);

        for (let i = 0; i < data.length; i += 4) {
            let pr = data[i], pg = data[i + 1], pb = data[i + 2], pa = data[i + 3];

            if (pa > 0 && Math.abs(pr - hr) < 5 && Math.abs(pg - hg) < 5 && Math.abs(pb - hb) < 5) {
                outData[i] = pr;
                outData[i + 1] = pg;
                outData[i + 2] = pb;
                outData[i + 3] = 255;
            }
        }
        oCtx.putImageData(outImgData, 0, 0);

    }, [settings.hoveredColor, lastResultRef.current]);

    return (
        <div
            className="flex-1 bg-gray-900 border-l border-gray-800 relative overflow-hidden flex items-center justify-center select-none"
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
            <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(#404040 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                    backgroundPosition: `${position.x}px ${position.y}px`,
                }}
            />

            {isHoveringFile && (
                <div className="absolute inset-0 z-50 bg-indigo-900/40 backdrop-blur-[2px] flex items-center justify-center transition-all">
                    <div className="p-8 border-2 border-indigo-400 border-dashed rounded-xl bg-gray-900/80 shadow-2xl">
                        <p className="text-xl font-bold tracking-widest text-indigo-200">DROP IMAGE HERE</p>
                    </div>
                </div>
            )}

            {!sourceImage ? (
                <div className="flex flex-col items-center justify-center text-gray-500 z-10 w-96 h-64 border-2 border-dashed border-gray-700/50 rounded-xl pointer-events-none bg-gray-900/50 backdrop-blur-sm">
                    <p className="text-xl font-medium tracking-tight text-gray-400 mb-2">Workspace</p>
                    <p className="text-sm">Drag and drop an image to begin.</p>
                </div>
            ) : (
                <div
                    className="relative z-10 origin-center"
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transition: isDragging ? 'none' : 'transform 0.05s ease-out'
                    }}
                >
                    <div className="relative shadow-2xl ring-1 ring-gray-800 pointer-events-none">
                        {/* Layer 1: Base output */}
                        <canvas
                            ref={baseCanvasRef}
                            className="block rendering-pixelated relative z-10"
                            style={{
                                imageRendering: 'pixelated',
                                opacity: showOriginal ? 0 : (settings.hoveredColor ? 0.3 : 1),
                                filter: settings.hoveredColor ? 'grayscale(100%)' : 'none',
                                transition: 'opacity 500ms ease, filter 500ms ease',
                                width: visualSize.width ? `${visualSize.width}px` : 'auto',
                                height: visualSize.height ? `${visualSize.height}px` : 'auto',
                            }}
                        />
                        {/* Layer 2: Overlay (Hover mask) */}
                        <canvas
                            ref={overlayCanvasRef}
                            className={`block rendering-pixelated absolute inset-0 z-30 pointer-events-none transition-opacity duration-500 ease-out ${settings.hoveredColor ? 'opacity-100' : 'opacity-0'}`}
                            style={{
                                imageRendering: 'pixelated',
                                width: visualSize.width ? `${visualSize.width}px` : 'auto',
                                height: visualSize.height ? `${visualSize.height}px` : 'auto',
                                filter: settings.hoveredColor ? `drop-shadow(0 0 12px ${settings.hoveredColor}) blur(0.5px)` : 'none',
                            }}
                        />
                        {/* Layer 3: Original Image (always rendered, fades in/out via opacity) */}
                        {sourceImage && (
                            <img
                                src={sourceImage.src}
                                alt="Original"
                                className="absolute inset-0 object-cover pointer-events-none"
                                style={{
                                    width: visualSize.width ? `${visualSize.width}px` : 'auto',
                                    height: visualSize.height ? `${visualSize.height}px` : 'auto',
                                    opacity: showOriginal ? 1 : 0,
                                    transition: 'opacity 300ms ease',
                                    zIndex: 20,
                                }}
                            />
                        )}
                    </div>
                </div>
            )}

            {sourceImage && (
                <div className="absolute top-4 right-4 bg-gray-950/80 backdrop-blur border border-gray-800 px-3 py-1.5 rounded-lg shadow-lg z-20 flex items-center gap-4 text-[10px] font-mono text-gray-400">
                    <button
                        onMouseDown={() => setShowOriginal(true)}
                        onMouseUp={() => setShowOriginal(false)}
                        onMouseLeave={() => setShowOriginal(false)}
                        onTouchStart={(e) => { e.preventDefault(); setShowOriginal(true); }}
                        onTouchEnd={(e) => { e.preventDefault(); setShowOriginal(false); }}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white px-3 py-1.5 rounded-md backdrop-blur-md transition-all active:scale-95 uppercase font-bold tracking-widest pointer-events-auto shadow-sm"
                    >
                        Hold for Original
                    </button>

                    {(isProcessing || isExtracting) ? (
                        <span className="text-indigo-400 animate-pulse flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> {isExtracting ? 'EXTRACTING PALETTE' : 'PROCESSING...'}
                        </span>
                    ) : (
                        <span className="text-green-500 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500/50 border border-green-500"></span> READY
                        </span>
                    )}

                    <span>ZOOM: {Math.round(scale * 100)}%</span>
                    <button
                        onClick={(e) => { e.stopPropagation(); setScale(1); setPosition({ x: 0, y: 0 }); }}
                        className="hover:text-white transition-colors cursor-pointer mr-2"
                    >
                        RESET
                    </button>

                    {!settings.isAdvancedPanelOpen && (
                        <button
                            onClick={(e) => { e.stopPropagation(); updateSettings({ isAdvancedPanelOpen: true }); }}
                            className="bg-indigo-600/50 hover:bg-indigo-500/80 border border-indigo-400 text-white px-3 py-1.5 rounded-md transition-all uppercase tracking-widest font-bold shadow-[0_0_10px_rgba(79,70,229,0.2)]"
                        >
                            ADVANCED
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default Workspace;
