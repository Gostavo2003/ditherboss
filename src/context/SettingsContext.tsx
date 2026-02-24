import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { PaletteColor } from '../components/PaletteEditor';
import { v4 as uuidv4 } from 'uuid';

interface AppSettings {
    // Global
    mode: 'bw' | 'color';
    width: number;
    exportDpi: 72 | 300;
    exportSize: number;
    ditherScale: number;
    originalFilename: string;
    pixelFidelity: boolean;

    // B&W
    bwThreshold: number;
    bwMethod: string;
    bwFactor: number;
    bwStretch: number;

    // Color
    colorBlur: number;
    colorPaletteMode: 'auto' | 'manual';
    colorExtractMethod: string;
    colorCount: number;
    colorPalette: PaletteColor[];

    // Advanced Paint System
    isAdvancedPanelOpen: boolean;
    brushSize: number;
    brushHardness: number;
    brushPreset: 'solid' | 'dither' | 'noise';
    colorReplacements: Record<string, string>;
    hoveredColor: string | null;
    pixelCounts: Record<string, number>;
}

interface SettingsContextType {
    settings: AppSettings;
    updateSettings: (newSettings: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
    mode: 'bw',
    width: 600,
    exportDpi: 72,
    exportSize: 1000,
    ditherScale: 2,
    originalFilename: 'ditherboss_export',
    pixelFidelity: true,

    bwThreshold: 100,
    bwMethod: 'atkinson',
    bwFactor: 1.0,
    bwStretch: 0,

    colorBlur: 0,
    colorPaletteMode: 'auto',
    colorExtractMethod: 'kmeans',
    colorCount: 8,
    colorPalette: [
        { id: uuidv4(), hex: '#ff0000', threshold: 1.0 },
        { id: uuidv4(), hex: '#00ff00', threshold: 1.0 },
        { id: uuidv4(), hex: '#0000ff', threshold: 1.0 },
        { id: uuidv4(), hex: '#ffffff', threshold: 1.0 },
        { id: uuidv4(), hex: '#000000', threshold: 1.0 },
    ],

    isAdvancedPanelOpen: false,
    brushSize: 10,
    brushHardness: 100,
    brushPreset: 'solid',
    colorReplacements: {},
    hoveredColor: null,
    pixelCounts: {},
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);

    const updateSettings = (newSettings: Partial<AppSettings>) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };

            // Sync colorPalette array length with colorCount changes
            if (newSettings.colorCount !== undefined && newSettings.colorCount !== prev.colorCount) {
                const newCount = newSettings.colorCount;
                let newPalette = [...updated.colorPalette];

                if (newCount > newPalette.length) {
                    const defaultColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#000000'];
                    while (newPalette.length < newCount) {
                        const nextColorHex = defaultColors[newPalette.length % defaultColors.length] || '#888888';
                        newPalette.push({ id: uuidv4(), hex: nextColorHex, threshold: 1.0 });
                    }
                } else if (newCount < newPalette.length) {
                    newPalette = newPalette.slice(0, newCount);
                }
                updated.colorPalette = newPalette;
            }

            return updated;
        });
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
