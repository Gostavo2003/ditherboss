import BlackWhiteControls from './BlackWhiteControls';
import ColorControls from './ColorControls';
import { useSettings } from '../context/SettingsContext';

const Sidebar: React.FC = () => {
    const { settings, updateSettings } = useSettings();

    return (
        <aside className="w-80 h-full bg-gray-950 flex flex-col overflow-y-auto shrink-0 border-r border-gray-800 shadow-2xl">
            {/* HEADER & GLOBAL UPLOAD */}
            <div className="p-6 border-b border-gray-800 sticky top-0 bg-gray-950/95 backdrop-blur z-10">
                <h1 className="text-2xl font-bold tracking-tighter text-white mb-6">DITHER<span className="text-gray-500">BOSS</span></h1>

                {/* Upload Button */}
                <label className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-white text-gray-950 px-4 py-3 rounded-md font-semibold cursor-pointer transition-colors tracking-wide shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                    UPLOAD IMAGE
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                const file = e.target.files[0];
                                const baseName = file.name.split('.').slice(0, -1).join('.') || 'ditherboss_export';
                                updateSettings({ originalFilename: baseName });
                                window.dispatchEvent(new CustomEvent('IMAGE_UPLOADED', { detail: file }));
                                e.target.value = ''; // Reset to allow same file re-upload
                            }
                        }}
                    />
                </label>
            </div>

            <div className="flex-1 p-6 space-y-8">

                {/* MODE TOGGLE */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-400 tracking-widest uppercase">Process Mode</label>
                    <div className="flex p-1 bg-gray-900 rounded-lg border border-gray-800">
                        <button
                            onClick={() => updateSettings({ mode: 'bw' })}
                            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${settings.mode === 'bw'
                                ? 'bg-gray-700 text-white shadow-sm'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                                }`}
                        >
                            BLACK & WHITE
                        </button>
                        <button
                            onClick={() => updateSettings({ mode: 'color' })}
                            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${settings.mode === 'color'
                                ? 'bg-gray-700 text-white shadow-sm'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                                }`}
                        >
                            COLOR
                        </button>
                    </div>
                </div>

                {/* GLOBAL RESOLUTION & PIXEL SIZE (Moved Up) */}
                <div className="space-y-6">
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
                    </div>

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

                <div className="h-px bg-gray-800 w-full" />

                {/* Dynamic Controls based on Mode */}
                {settings.mode === 'bw' ? <BlackWhiteControls /> : <ColorControls />}

            </div>

            {/* FOOTER & EXPORT */}
            <div className="p-6 border-t border-gray-800 bg-gray-950 mt-auto space-y-4 relative">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>

                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase text-center">Export Actions</h3>

                    {/* Pixel Fidelity Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <span className="text-[10px] font-bold text-gray-500 group-hover:text-gray-300 transition-colors uppercase tracking-tighter">Pixel Fidelity</span>
                        <div
                            onClick={() => updateSettings({ pixelFidelity: !settings.pixelFidelity })}
                            className={`w-8 h-4 rounded-full p-0.5 transition-colors ${settings.pixelFidelity ? 'bg-indigo-600' : 'bg-gray-700'}`}
                        >
                            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${settings.pixelFidelity ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                    </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('EXPORT_PNG'))}
                        className="w-full py-2.5 bg-blue-900/20 hover:bg-blue-800/40 text-blue-300 hover:text-blue-100 rounded-lg border border-blue-800/50 hover:border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)] hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all text-xs font-semibold flex flex-col items-center justify-center gap-1 group backdrop-blur-sm"
                    >
                        <span className="group-hover:drop-shadow-[0_0_8px_rgba(96,165,250,0.8)] transition-all">PNG (Raster)</span>
                    </button>
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('EXPORT_JPEG'))}
                        className="w-full py-2.5 bg-orange-900/20 hover:bg-orange-800/40 text-orange-300 hover:text-orange-100 rounded-lg border border-orange-800/50 hover:border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)] hover:shadow-[0_0_20px_rgba(249,115,22,0.2)] transition-all text-xs font-semibold flex flex-col items-center justify-center gap-1 group backdrop-blur-sm"
                    >
                        <span className="group-hover:drop-shadow-[0_0_8px_rgba(251,146,60,0.8)] transition-all">JPEG (Raster)</span>
                    </button>
                </div>

                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('EXPORT_SVG'))}
                    className="w-full py-2.5 bg-green-900/20 hover:bg-green-800/40 text-green-300 hover:text-green-100 rounded-lg border border-green-800/50 hover:border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:shadow-[0_0_20px_rgba(34,197,94,0.2)] transition-all text-sm font-semibold flex items-center justify-center gap-2 group backdrop-blur-sm"
                >
                    <span className="group-hover:drop-shadow-[0_0_8px_rgba(74,222,128,0.8)] transition-all">TRACE TO SVG</span>
                </button>

                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('OPEN_BATCH'))}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] transition-all text-sm font-bold flex items-center justify-center gap-2 mt-2 border border-indigo-400/30 backdrop-blur-sm group"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" /></svg>
                    BATCH PROCESS
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
