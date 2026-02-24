import React from 'react';
import { useSettings } from '../context/SettingsContext';

const BlackWhiteControls: React.FC = () => {
    const { settings, updateSettings } = useSettings();

    const isDithered = ['floyd', 'atkinson', 'jarvis', 'stucki', 'random', 'bluenoise', 'bayer2', 'bayer4', 'bayer8', 'clustered4'].includes(settings.bwMethod);

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">

            {/* Threshold Slider */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 tracking-widest uppercase flex justify-between">
                    <span>Threshold</span>
                    <span className="text-gray-300">{settings.bwThreshold}</span>
                </label>
                <input
                    type="range"
                    min="1"
                    max="255"
                    value={settings.bwThreshold}
                    onChange={(e) => updateSettings({ bwThreshold: parseInt(e.target.value) })}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                />
            </div>

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

            {/* Dither Intensity Slider */}
            {isDithered && (
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
                        <span className="text-gray-300">{settings.bwStretch}</span>
                    </label>
                    <input
                        type="range"
                        min="-100"
                        max="100"
                        step="1"
                        value={settings.bwStretch}
                        onChange={(e) => updateSettings({ bwStretch: parseInt(e.target.value) })}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            )}

        </div>
    );
};

export default BlackWhiteControls;
