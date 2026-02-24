import React, { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { v4 as uuidv4 } from 'uuid';
import { Plus, X, PaintBucket } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export interface PaletteColor {
    id: string;
    hex: string;
    threshold: number; // 0 to 1
}

interface PaletteEditorProps {
    colors: PaletteColor[];
    setColors: (colors: PaletteColor[]) => void;
}

const PaletteEditor: React.FC<PaletteEditorProps> = ({ colors, setColors }) => {
    const { updateSettings } = useSettings();
    const [activeColorId, setActiveColorId] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);

    // Default color pool to pull from when adding new colors
    const defaultColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#000000'];



    const handleAddColor = () => {
        if (colors.length >= 32) return;
        const nextColorHex = defaultColors[colors.length] || '#888888';
        setColors([...colors, { id: uuidv4(), hex: nextColorHex, threshold: 1.0 }]);
    };

    const handleRemoveColor = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (colors.length <= 1) return; // Must have at least one color
        setColors(colors.filter(c => c.id !== id));
        if (activeColorId === id) setActiveColorId(null);
    };

    const handleColorChange = (newHex: string) => {
        if (!activeColorId) return;
        setColors(colors.map(c => c.id === activeColorId ? { ...c, hex: newHex } : c));
        updateSettings({ colorPaletteMode: 'manual' });
    };

    const handleThresholdChange = (id: string, value: number) => {
        setColors(colors.map((c: any) => c.id === id ? { ...c, threshold: value } : c));
        updateSettings({ colorPaletteMode: 'manual' });
    };

    const displayedColors = showAll ? colors : colors.slice(0, 8);

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">

            <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 uppercase font-semibold flex items-center gap-1">
                    <PaintBucket size={12} />
                    Palette ({colors.length}/32)
                </span>
                <button
                    onClick={handleAddColor}
                    disabled={colors.length >= 32}
                    className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Add Color"
                >
                    <Plus size={16} />
                </button>
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {displayedColors.map((color) => (
                    <div key={color.id} className="group flex items-center gap-2 p-1.5 rounded bg-gray-950/50 hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-700">
                        {/* Color Swatch */}
                        <div
                            className="w-5 h-5 rounded shadow-inner cursor-pointer flex-shrink-0 border border-gray-600"
                            style={{ backgroundColor: color.hex }}
                            onClick={() => setActiveColorId(activeColorId === color.id ? null : color.id)}
                            title="Click to edit color"
                        />

                        {/* Popover Color Picker (Modal Style) */}
                        {activeColorId === color.id && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setActiveColorId(null)}>
                                <div className="relative bg-gray-950 p-5 rounded-2xl border border-gray-800 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                    <div className="flex justify-between items-center w-full">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Edit Color</span>
                                        <button onClick={() => setActiveColorId(null)} className="text-gray-500 hover:text-white transition-colors bg-gray-900 rounded p-1"><X size={14} /></button>
                                    </div>
                                    <HexColorPicker color={color.hex} onChange={handleColorChange} />
                                    <div className="w-full text-center font-mono text-gray-300 bg-gray-900 py-1.5 rounded">{color.hex.toUpperCase()}</div>
                                </div>
                            </div>
                        )}

                        {/* Hex Display */}
                        <span className="text-xs font-mono text-gray-400 select-all uppercase w-14">{color.hex}</span>

                        {/* Minimum Divider */}
                        <div className="w-px h-3 bg-gray-700"></div>

                        {/* Threshold Slider Row (Compact) */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-[8px] text-gray-500 uppercase font-bold">THR</span>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={Math.round(color.threshold * 100)}
                                onChange={(e) => handleThresholdChange(color.id, parseInt(e.target.value) / 100)}
                                className="w-full h-1 bg-gray-700 hover:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                title="Per-Color Threshold"
                            />
                        </div>

                        {/* Value & Remove Button */}
                        <div className="flex items-center gap-1 justify-end w-14">
                            <span className="text-[9px] text-gray-500 font-mono text-right w-6 group-hover:hidden hidden sm:block">
                                {Math.round(color.threshold * 100)}
                            </span>
                            <button
                                onClick={(e) => handleRemoveColor(color.id, e)}
                                disabled={colors.length <= 1}
                                className="text-gray-600 hover:text-red-400 group-hover:opacity-100 sm:opacity-0 transition-opacity disabled:opacity-0 ml-auto"
                                title="Remove Color"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {colors.length > 8 && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="w-full text-xs font-bold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 py-1.5 rounded transition-colors"
                >
                    {showAll ? "Show Less" : "Show All Colors"}
                </button>
            )}

        </div>
    );
};

export default PaletteEditor;
