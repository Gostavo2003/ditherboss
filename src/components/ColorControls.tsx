import React from 'react';
import PaletteEditor from './PaletteEditor';
import { useSettings } from '../context/SettingsContext';

const ColorControls: React.FC = () => {
    const { settings, updateSettings } = useSettings();

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200">

            {/* Blur Input Option */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 tracking-widest uppercase flex justify-between">
                    <span>Pre-Process Blur</span>
                    <span className="text-gray-300">{settings.colorBlur.toFixed(1)}px</span>
                </label>
                <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={settings.colorBlur}
                    onChange={(e) => updateSettings({ colorBlur: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-[10px] text-gray-600 leading-tight">
                    Apply a slight blur before color extraction to reduce noise and create smoother gradients.
                </p>
            </div>

            <div className="space-y-6">
                {/* Dithering Method */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-500 tracking-widest uppercase">
                        Dithering Method
                    </label>
                    <select
                        value={settings.bwMethod}
                        onChange={(e) => updateSettings({ bwMethod: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-800 text-gray-200 text-sm rounded-lg focus:ring-gray-500 focus:border-gray-500 block p-2.5 outline-none hover:border-gray-700 transition-colors cursor-pointer appearance-none"
                    >
                        <option value="bitmap">Bitmap (No Dither)</option>
                        <option value="floyd">Floyd-Steinberg</option>
                        <option value="atkinson">Atkinson</option>
                        <option value="jarvis">Jarvis-Judice-Ninke</option>
                        <option value="stucki">Stucki</option>
                        <option value="bayer2">Bayer 2x2</option>
                        <option value="bayer4">Bayer 4x4</option>
                        <option value="bayer8">Bayer 8x8</option>
                        <option value="clustered4">Clustered 4x4</option>
                        <option value="stretch">Stretch</option>
                        <option value="random">Random</option>
                        <option value="bluenoise">Blue Noise</option>
                    </select>
                </div>

                {/* Error Factor Slider */}
                {['floyd', 'atkinson', 'jarvis', 'stucki', 'random', 'bluenoise', 'bayer2', 'bayer4', 'bayer8', 'clustered4'].includes(settings.bwMethod) && (
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 tracking-widest uppercase flex justify-between">
                            <span>Dither Intensity</span>
                            <span className="text-gray-300">{settings.bwFactor.toFixed(2)}</span>
                        </label>
                        <input
                            type="range"
                            min="0.1"
                            max="2.0"
                            step="0.01"
                            value={settings.bwFactor}
                            onChange={(e) => updateSettings({ bwFactor: parseFloat(e.target.value) })}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                )}

                {/* Stretch Slider */}
                {settings.bwMethod === 'stretch' && (
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 tracking-widest uppercase flex justify-between">
                            <span>Stretch</span>
                            <span className="text-gray-300">{settings.bwStretch}%</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={settings.bwStretch}
                            onChange={(e) => updateSettings({ bwStretch: parseInt(e.target.value) })}
                            className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                )}
            </div>

            <div className="h-px bg-gray-800 w-full" />

            {/* Palette Tools */}
            <div className="space-y-5">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-400 tracking-widest uppercase flex items-center gap-2">
                        Color Palette
                    </label>
                    <button className="text-xs font-bold text-gray-400 hover:text-white bg-gray-900 border border-gray-800 px-2 py-1 rounded transition-colors">
                        PRESETS
                    </button>
                </div>

                {/* Extraction Mode */}
                <div className="space-y-3">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block mb-1">Extraction Method</span>
                    <select
                        value={settings.colorExtractMethod}
                        onChange={(e) => updateSettings({ colorExtractMethod: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-800 text-gray-200 text-sm rounded-lg focus:ring-gray-500 focus:border-gray-500 block p-2 outline-none hover:border-gray-700 transition-colors cursor-pointer appearance-none"
                    >
                        <option value="kmeans">K-Means Clustering</option>
                        <option value="histogram">Histogram / Frequency</option>
                        <option value="mediancut">Median Cut</option>
                        <option value="hue">Hue Clustering</option>
                        <option value="extreme">Extreme Colors</option>
                        <option value="pronounced">Pronounced</option>
                        <option value="varied">Varied Hues</option>
                        <option value="distant">Distant (LAB)</option>
                        <option value="contrasting">High Contrast</option>
                    </select>
                </div>

                {/* Color Count Slider */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-400 tracking-widest uppercase flex justify-between">
                        <span>Palette Size</span>
                        <span className="text-gray-300">{settings.colorCount} Colors</span>
                    </label>
                    <input
                        type="range"
                        min="2"
                        max="32"
                        step="1"
                        value={settings.colorCount}
                        onChange={(e) => updateSettings({ colorCount: parseInt(e.target.value) })}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* The Palette Editor Integration */}
                <PaletteEditor
                    colors={settings.colorPalette}
                    setColors={(newPalette) => updateSettings({ colorPalette: newPalette })}
                />
            </div>

        </div>
    );
};

export default ColorControls;
