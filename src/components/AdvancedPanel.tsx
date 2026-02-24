import React, { useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Settings2, X, Brush, Droplets, ArrowRight, RotateCcw } from 'lucide-react';

const AdvancedPanel: React.FC = () => {
    const { settings, updateSettings } = useSettings();

    // Sort valid colors by count descending
    const sortedPalette = useMemo(() => {
        return [...settings.colorPalette].sort((a, b) => {
            const countA = settings.pixelCounts[a.hex] || 0;
            const countB = settings.pixelCounts[b.hex] || 0;
            return countB - countA;
        });
    }, [settings.colorPalette, settings.pixelCounts]);

    if (!settings.isAdvancedPanelOpen) return null;

    return (
        <div className="w-80 bg-gray-950 border-l border-gray-800 flex flex-col h-full overflow-y-auto custom-scrollbar select-none z-40 transition-all duration-300">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-950 z-10">
                <div className="flex items-center gap-2 text-indigo-400">
                    <Settings2 className="w-5 h-5" />
                    <h2 className="font-semibold tracking-wider text-sm">ADVANCED SYSTEM</h2>
                </div>
                <button
                    onClick={() => updateSettings({ isAdvancedPanelOpen: false })}
                    className="text-gray-500 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-4 space-y-8">
                {/* Paint Tools Section (Disabled for now) */}
                <div className="space-y-4 relative">
                    <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-[1.5px] z-10 flex flex-col items-center justify-center rounded-lg border border-gray-800/50">
                        <span className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-[0_0_15px_rgba(79,70,229,0.5)]">Coming Soon</span>
                    </div>

                    <div className="flex items-center gap-2 mb-2 text-gray-300">
                        <Brush className="w-4 h-4" />
                        <h3 className="text-xs font-bold uppercase tracking-widest">Smart Paint Engine</h3>
                    </div>

                    <div className="space-y-3 opacity-50 pointer-events-none">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-medium text-gray-400">Brush Preset</label>
                            <select
                                value={settings.brushPreset}
                                onChange={() => { }}
                                className="bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500"
                            >
                                <option value="solid">Solid Edge</option>
                                <option value="dither">Dither Fade</option>
                                <option value="noise">Noise Blend</option>
                            </select>
                        </div>

                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Brush Size</span>
                                <span className="text-gray-300">{settings.brushSize}px</span>
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={50}
                                value={settings.brushSize}
                                onChange={() => { }}
                                className="w-full accent-indigo-500"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Hardness</span>
                                <span className="text-gray-300">{settings.brushHardness}%</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={settings.brushHardness}
                                onChange={() => { }}
                                className="w-full accent-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                <hr className="border-gray-800" />

                {/* Palette Insights & Swapping Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-gray-300">
                            <Droplets className="w-4 h-4" />
                            <h3 className="text-xs font-bold uppercase tracking-widest">Palette Swapping</h3>
                        </div>
                        {Object.keys(settings.colorReplacements).length > 0 && (
                            <button
                                onClick={() => updateSettings({ colorReplacements: {} })}
                                className="text-[10px] px-2 py-1 bg-red-900/30 hover:bg-red-900/60 text-red-400 border border-red-900/50 rounded transition-colors uppercase font-bold tracking-wider"
                            >
                                Reset All
                            </button>
                        )}
                    </div>

                    <p className="text-[10px] text-gray-500 leading-tight mb-3">
                        Hover over colors to mask their distribution. Swap colors post-dither without changing the pattern.
                    </p>

                    <div className="space-y-2">
                        {sortedPalette.map((color) => {
                            const count = settings.pixelCounts[color.hex] || 0;
                            const isReplaced = !!settings.colorReplacements[color.hex];
                            const currentDisplayColor = isReplaced ? settings.colorReplacements[color.hex] : color.hex;

                            return (
                                <div
                                    key={color.id}
                                    onMouseEnter={() => updateSettings({ hoveredColor: color.hex })}
                                    onMouseLeave={() => updateSettings({ hoveredColor: null })}
                                    className={`flex items-center justify-between p-2 rounded-lg transition-colors border ${isReplaced ? 'bg-indigo-950/40 border-indigo-900/50' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}
                                >
                                    <div className="flex items-center gap-2 flex-col justify-center">
                                        <span className="text-[9px] text-gray-500 font-mono self-start leading-none">{count.toLocaleString()}</span>
                                        <div className="flex items-center gap-2">
                                            {/* Original */}
                                            <div
                                                className="w-5 h-5 rounded shadow-sm border border-black/40"
                                                style={{ backgroundColor: color.hex }}
                                                title={`Original: ${color.hex}`}
                                            />

                                            <ArrowRight className="w-3 h-3 text-gray-600" />

                                            {/* Replacement Picker */}
                                            <div className="relative group">
                                                <input
                                                    type="color"
                                                    value={currentDisplayColor}
                                                    onChange={(e) => {
                                                        const newReps = { ...settings.colorReplacements, [color.hex]: e.target.value };
                                                        updateSettings({ colorReplacements: newReps });
                                                    }}
                                                    className="w-5 h-5 rounded cursor-pointer border border-white/10 p-0 bg-transparent block"
                                                    title={`Swap ${color.hex} to...`}
                                                />
                                            </div>

                                            {isReplaced && (
                                                <button
                                                    onClick={() => {
                                                        const newReps = { ...settings.colorReplacements };
                                                        delete newReps[color.hex];
                                                        updateSettings({ colorReplacements: newReps });
                                                    }}
                                                    className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-red-400 transition-colors ml-1"
                                                    title="Revert swap"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isReplaced ? 'bg-indigo-900/50 text-indigo-300' : 'text-gray-400'}`}>
                                        {currentDisplayColor.toUpperCase()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdvancedPanel;
