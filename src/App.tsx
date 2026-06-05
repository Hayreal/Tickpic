import { useState } from 'react';
import WindowFrame from './components/WindowFrame';
import Sidebar from './components/Sidebar';
import StickerGen from './components/StickerGen';
import ProductProcessing from './components/ProductProcessing';
import Settings from './components/Settings';
import Profile from './components/Profile';
import type { ActiveTab } from './shared/view/ui';
import { useDesktopClient } from './hooks/useDesktopClient';
import { useDesktopTasks } from './hooks/useDesktopTasks';
import { toTaskItem } from './features/tasks/taskMappers';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sticker');
  const desktop = useDesktopClient();
  const { tasks, taskService, refresh } = useDesktopTasks(desktop);

  return (
    <WindowFrame title="Tickpic">
      <div className="flex-1 flex overflow-hidden w-full h-full" id="workspace-layout">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1 flex overflow-hidden" id="workspace-dynamic-panel">
          {activeTab === 'sticker' && <StickerGen />}
          {activeTab === 'product' && <ProductProcessing taskService={taskService} />}
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'profile' && (
            <Profile tasks={tasks.map(toTaskItem)} onRefresh={refresh} />
          )}
        </div>
      </div>
    </WindowFrame>
  );
}
