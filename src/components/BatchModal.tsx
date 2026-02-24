import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { v4 as uuidv4 } from 'uuid';
import type { ProcessPayload, WorkerMessage, WorkerResponse } from '../worker/imageWorker';


export const BatchModal: React.FC = () => {
    const { settings } = useSettings();
    const [isOpen, setIsOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [statusText, setStatusText] = useState('');
    const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'svg'>('png');

    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        window.addEventListener('OPEN_BATCH', handleOpen);
        return () => window.removeEventListener('OPEN_BATCH', handleOpen);
    }, []);

    useEffect(() => {
        if (isOpen && !workerRef.current) {
            workerRef.current = new Worker(new URL('../worker/imageWorker.ts', import.meta.url), { type: 'module' });
        }
        return () => {
            if (workerRef.current && !isProcessing) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, [isOpen, isProcessing]);

    const handleClose = () => {
        if (!isProcessing) setIsOpen(false);
    };

    const processFiles = async (files: FileList | File[]) => {
        setIsProcessing(true);
        setStatusText('Reading files...');

        let imagesToProcess: { name: string, blob: Blob }[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.endsWith('.zip')) {
                setStatusText(`Extracting ${file.name}...`);
                const zip = await JSZip.loadAsync(file);
                for (const [filename, zipEntry] of Object.entries(zip.files)) {
                    if (!zipEntry.dir && filename.match(/\.(jpe?g|png|webp|gif)$/i)) {
                        const blob = await zipEntry.async("blob");
                        imagesToProcess.push({ name: filename, blob });
                    }
                }
            } else if (file.type.startsWith('image/')) {
                imagesToProcess.push({ name: file.name, blob: file });
            }
        }

        if (imagesToProcess.length === 0) {
            setStatusText('No images found.');
            setIsProcessing(false);
            return;
        }

        setProgress({ current: 0, total: imagesToProcess.length });

        const resultZip = new JSZip();

        for (let i = 0; i < imagesToProcess.length; i++) {
            const { name, blob } = imagesToProcess[i];
            setStatusText(`Processing ${name}... (${i + 1}/${imagesToProcess.length})`);

            try {
                const processedBlob = await processSingleImage(blob);

                // Determine new extension
                let newExt = exportFormat === 'jpeg' ? 'jpg' : exportFormat;
                let newName = name.replace(/\.[^/.]+$/, "") + `_dithered.${newExt}`;

                resultZip.file(newName, processedBlob);
            } catch (err) {
                console.error(`Error processing ${name}:`, err);
            }

            setProgress(prev => ({ ...prev, current: i + 1 }));
        }

        setStatusText('Generating final ZIP file...');
        const content = await resultZip.generateAsync({ type: 'blob' });
        saveAs(content, `ditherboss_batch_${Date.now()}.zip`);

        setStatusText('Done!');
        setIsProcessing(false);
        setTimeout(() => setIsOpen(false), 2000);
    };

    const processSingleImage = (blob: Blob): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                URL.revokeObjectURL(url);
                let targetWidth = Math.min(settings.width, img.width);
                let targetHeight = Math.round(img.height * (targetWidth / img.width));

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) return reject('No ctx');

                if (settings.colorBlur > 0) ctx.filter = `blur(${settings.colorBlur}px)`;
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                ctx.filter = 'none';

                const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
                const jobId = uuidv4();

                const listener = (e: MessageEvent<WorkerResponse>) => {
                    if (e.data.id === jobId) {
                        workerRef.current?.removeEventListener('message', listener);
                        if (e.data.type === 'RESULT' && e.data.imageData) {

                            // Draw back to canvas
                            ctx.putImageData(e.data.imageData, 0, 0);

                            // Handle Export Format
                            if (exportFormat === 'svg') {
                                // Since we need a Blob, we must mock the internal exportSVG saveAs call
                                // Or better, just grab the dataURL and use JSZip's base64 support.
                                // It's complex, so for batch, let's keep raster, or adapt exportSVG.
                                // For now, let's use canvas.toBlob for raster.
                                canvas.toBlob(b => {
                                    if (b) resolve(b); else reject();
                                }, 'image/png');
                                // (Implementation limitation for this iteration: SVG trace doesn't easily return Blob out of the box in the util without modification. Let's force raster for batch or adapt it later).
                            } else {
                                const mime = exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
                                canvas.toBlob(b => {
                                    if (b) resolve(b); else reject();
                                }, mime, 1.0);
                                // Note: DPI injection omitted in batch for brevity, could be added via dataURL conversion.
                            }

                        } else {
                            reject(e.data.error);
                        }
                    }
                };

                workerRef.current?.addEventListener('message', listener);

                const payload: ProcessPayload = {
                    imageData, mode: settings.mode, width: targetWidth,
                    bwThreshold: settings.bwThreshold, bwMethod: settings.bwMethod, bwFactor: settings.bwFactor, bwStretch: settings.bwStretch,
                    colorBlur: settings.colorBlur, colorExtractMethod: settings.colorExtractMethod, colorPaletteMode: settings.colorPaletteMode, colorPalette: settings.colorPalette,
                    colorCount: settings.colorCount, colorReplacements: settings.colorReplacements
                };

                workerRef.current?.postMessage({ type: 'PROCESS_IMAGE', payload, id: jobId } as WorkerMessage, [imageData.data.buffer]);
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject('Load error'); };
            img.src = url;
        });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (isProcessing) return;
        if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold tracking-tight text-white">Batch Processor</h2>
                    {!isProcessing && (
                        <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6L18 18" /></svg>
                        </button>
                    )}
                </div>

                <div className="p-8 flex flex-col items-center">

                    {!isProcessing ? (
                        <>
                            <div className="w-full flex justify-center mb-6 gap-4">
                                <label className="text-sm font-semibold text-gray-400">Export Format:</label>
                                <select
                                    value={exportFormat} onChange={e => setExportFormat(e.target.value as any)}
                                    className="bg-gray-950 border border-gray-700 rounded px-2 py-0.5 text-sm text-white"
                                >
                                    <option value="png">PNG (Raster)</option>
                                    <option value="jpeg">JPEG (Raster)</option>
                                </select>
                            </div>

                            <label
                                onDragOver={e => e.preventDefault()}
                                onDrop={handleDrop}
                                className="w-full max-w-md h-64 border-2 border-dashed border-gray-700 hover:border-indigo-500 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-950/50"
                            >
                                <svg className="w-12 h-12 text-gray-500 mb-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                                <p className="text-lg font-medium text-gray-300">Drop Images or ZIP file</p>
                                <p className="text-sm text-gray-500 mt-2">or click to browse</p>
                                <input type="file" multiple accept="image/*,.zip" className="hidden" onChange={e => e.target.files && processFiles(e.target.files)} />
                            </label>
                        </>
                    ) : (
                        <div className="w-full max-w-md flex flex-col items-center py-12">
                            <div className="text-indigo-400 mb-4 animate-pulse">
                                <svg className="w-12 h-12 animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line></svg>
                            </div>
                            <p className="text-lg font-medium text-white mb-2">{statusText}</p>
                            <div className="w-full bg-gray-800 rounded-full h-3 mb-2 overflow-hidden border border-gray-700">
                                <div
                                    className="bg-indigo-500 h-3 rounded-full transition-all duration-200 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                    style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
                                />
                            </div>
                            <p className="text-sm font-mono text-gray-500">{progress.current} / {progress.total}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
