
import Sidebar from './components/Sidebar';
import Workspace from './components/Workspace';
import AdvancedPanel from './components/AdvancedPanel';
import { BatchModal } from './components/BatchModal';

function App() {
  return (
    <div className="flex w-full h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden">
      {/* Sidebar Controls */}
      <Sidebar />

      {/* Main Workspace */}
      <Workspace />

      {/* Advanced Panel */}
      <AdvancedPanel />

      {/* Modals */}
      <BatchModal />
    </div>
  );
}

export default App;
