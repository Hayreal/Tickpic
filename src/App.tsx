import { useCallback, useState } from 'react';
import WindowFrame from './components/WindowFrame';
import Sidebar from './components/Sidebar';
import StickerGen from './components/StickerGen';
import SkuGen from './components/SkuGen';
import ProductProcessing from './components/ProductProcessing';
import ProductImageSet from './components/ProductImageSet';
import Settings from './components/Settings';
import Profile from './components/Profile';
import type { ActiveTab } from './shared/view/ui';
import { getFeatureRoute } from './shared/view/featureRoutes';
import type { TaskRecord } from './shared/domain/tasks';
import { useDesktopClient } from './hooks/useDesktopClient';
import { useDesktopTasks } from './hooks/useDesktopTasks';
import { AppearanceProvider } from './contexts/AppearanceContext';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sticker');
  const [restoredTask, setRestoredTask] = useState<TaskRecord | null>(null);
  const desktop = useDesktopClient();
  const { tasks, refresh } = useDesktopTasks(desktop);

  const handleRestoreTask = useCallback((task: TaskRecord) => {
    if (!task.request?.feature) {
      alert('该任务缺少可还原的参数信息');
      return;
    }

    const route = getFeatureRoute(task.request.feature);
    setRestoredTask(task);
    setActiveTab(route.tab);
  }, []);

  const handleRestoreConsumed = useCallback(() => {
    setRestoredTask(null);
  }, []);

  return (
    <AppearanceProvider>
    <WindowFrame title="Tickpic">
      <div className="flex-1 flex overflow-hidden w-full h-full" id="workspace-layout">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1 flex overflow-hidden" id="workspace-dynamic-panel">
          <div className={activeTab === 'sticker' ? 'flex flex-1 overflow-hidden' : 'hidden'}>
            <StickerGen
              restoredTask={
                restoredTask?.request?.feature
                && getFeatureRoute(restoredTask.request.feature).tab === 'sticker'
                  ? restoredTask
                  : null
              }
              onRestoreConsumed={handleRestoreConsumed}
            />
          </div>
          <div className={activeTab === 'product' ? 'flex flex-1 overflow-hidden' : 'hidden'}>
            <ProductProcessing
              restoredTask={
                restoredTask?.request?.feature
                && getFeatureRoute(restoredTask.request.feature).tab === 'product'
                  ? restoredTask
                  : null
              }
              onRestoreConsumed={handleRestoreConsumed}
            />
          </div>
          <div className={activeTab === 'sku' ? 'flex flex-1 overflow-hidden' : 'hidden'}>
            <SkuGen
              restoredTask={
                restoredTask?.request?.feature
                && getFeatureRoute(restoredTask.request.feature).tab === 'sku'
                  ? restoredTask
                  : null
              }
              onRestoreConsumed={handleRestoreConsumed}
            />
          </div>
          <div className={activeTab === 'productSet' ? 'flex flex-1 overflow-hidden' : 'hidden'}>
            <ProductImageSet
              restoredTask={
                restoredTask?.request?.feature
                && getFeatureRoute(restoredTask.request.feature).tab === 'productSet'
                  ? restoredTask
                  : null
              }
              onRestoreConsumed={handleRestoreConsumed}
            />
          </div>
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'profile' && (
            <Profile
              tasks={tasks}
              onRefresh={refresh}
              onRestoreTask={handleRestoreTask}
            />
          )}
        </div>
      </div>
    </WindowFrame>
    </AppearanceProvider>
  );
}
