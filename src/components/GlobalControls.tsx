import React from 'react';
import { useSettings } from '../context/SettingsContext';

const GlobalControls: React.FC = () => {
    const { settings, updateSettings } = useSettings();

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">

            {/* Resolution Slider */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 tracking-widest uppercase flex justify-between">
                    <span>Resolution (Width)</span>
                    <span className="text-gray-300">{settings.width}px</span>
                </label>
                <input
                    type="range"
                    min="10"
                    max="3000"
                    value={settings.width}
                    onChange={(e) => updateSettings({ width: parseInt(e.target.value) })}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-600 font-medium">
                    <span>Faster (10px)</span>
                    <span>Original</span>
                </div>
            </div>

            {/* Pixel Scale Slider */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 tracking-widest uppercase flex justify-between">
                    <span>Pixel Size</span>
                    <span className="text-gray-300">{settings.ditherScale}x</span>
                </label>
                <input
                    type="range"
                    min="1"
                    max="8"
                    step="1"
                    value={settings.ditherScale}
                    onChange={(e) => updateSettings({ ditherScale: parseInt(e.target.value) })}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                />
            </div>

        </div>
    );
};

export default GlobalControls;
