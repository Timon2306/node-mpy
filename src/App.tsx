import React, { useEffect } from 'react';
import { Topbar } from './components/topbar/Topbar';
import { LeftSidebar } from './components/palette/LeftSidebar';
import { FlowCanvas } from './components/canvas/FlowCanvas';
import { RightSidebar } from './components/inspector/RightSidebar';
import { PaletteManagerModal } from './components/modals/PaletteManagerModal';
import { ShortcutsModal } from './components/modals/ShortcutsModal';
import { FunctionEditorModal } from './components/modals/FunctionEditorModal';
import { AboutModal } from './components/modals/AboutModal';
import { ChangelogModal } from './components/modals/ChangelogModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { SimulationConsole } from './components/simulator/SimulationConsole';
import { DashboardModal } from './components/dashboard/DashboardModal';
import { useFlowStore } from './store/useFlowStore';

export const App: React.FC = () => {
  const { recalculate } = useFlowStore();

  useEffect(() => {
    // Recalculate code generation and validation for restored/active flow
    recalculate();
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-canvas text-gray-200 overflow-hidden font-sans select-none">
      {/* 1. Header (Node-RED style Topbar with Electric Teal action button) */}
      <Topbar />

      {/* 2. Main Workspace Layout: 3 columns */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Left: Dynamic Node Palette */}
        <LeftSidebar />

        {/* Center: Interactive React Flow Canvas & Simulation Dock */}
        <div className="flex-1 h-full relative overflow-hidden">
          <FlowCanvas />
          <SimulationConsole />
        </div>

        {/* Right: Inspector & Live Code Preview */}
        <RightSidebar />
      </main>

      {/* 3. Modals */}
      <PaletteManagerModal />
      <ShortcutsModal />
      <FunctionEditorModal />
      <AboutModal />
      <ChangelogModal />
      <SettingsModal />
      <DashboardModal />
    </div>
  );
};

export default App;
