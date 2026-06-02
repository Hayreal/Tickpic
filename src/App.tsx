import React, { useState, useEffect, useCallback, useMemo } from 'react';
import WindowFrame from './components/WindowFrame';
import Sidebar from './components/Sidebar';
import StickerGen from './components/StickerGen';
import ProductProcessing from './components/ProductProcessing';
import Settings from './components/Settings';
import Profile from './components/Profile';
import type { ActiveTab } from './types';
import type { TaskRecord } from './shared/domain/tasks';
import { createPendingTask, completeTask } from './lib/taskState';
import { createRendererTaskService } from './features/tasks/taskService';
import { getDesktopShell } from './lib/desktopShell';
import { toTaskItem } from './features/tasks/taskMappers';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sticker');
  const [tasks, setTasks] = useState<TaskRecord[]>([]);

  const shell = getDesktopShell();
  const taskService = useMemo(
    () => createRendererTaskService(shell ?? { createTask: async () => {}, updateTask: async () => {}, listTasks: async () => [] }),
    [],
  );

  // Load persisted tasks on mount
  useEffect(() => {
    if (shell) {
      shell.listTasks().then(setTasks).catch(console.error);
    }
  }, []);

  // Create task via service (persists through desktop client)
  const handleCreateTask = useCallback(async (input: {
    category: string;
    feature: string;
    batchId: string;
    imports: TaskRecord['imports'];
  }) => {
    const task = await taskService.createTask(input);
    setTasks((prev) => [task, ...prev]);
    return task;
  }, [taskService]);

  // Persist task updates (children handle state transitions)
  const handleUpdateTask = useCallback(async (task: TaskRecord) => {
    setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? task : t)));
    if (shell) {
      await shell.updateTask(task);
    }
  }, [shell]);

  // Fallback: simple task add for when desktop shell is not available
  const handleAddTask = (featureName: string) => {
    const task = createPendingTask({
      category: activeTab,
      feature: featureName,
      batchId: `batch-${Date.now()}`,
      imports: [],
    });
    const completed = completeTask(task, []);
    setTasks((prev) => [completed, ...prev]);
  };

  const handleRefreshTasks = () => {
    if (shell) {
      shell.listTasks().then(setTasks).catch(console.error);
    }
  };

  return (
    <WindowFrame title="Tickpic">
      <div className="flex-1 flex overflow-hidden w-full h-full" id="workspace-layout">
        
        {/* Navigation Sidebar */}
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Dynamic Panels */}
        <div className="flex-1 flex overflow-hidden" id="workspace-dynamic-panel">
          {activeTab === 'sticker' && (
            <StickerGen
              onAddTask={handleAddTask}
              onCreateTask={handleCreateTask}
              onUpdateTask={handleUpdateTask}
            />
          )}

          {activeTab === 'product' && (
            <ProductProcessing
              onAddTask={handleAddTask}
              onCreateTask={handleCreateTask}
              onUpdateTask={handleUpdateTask}
            />
          )}

          {activeTab === 'settings' && (
            <Settings />
          )}

          {activeTab === 'profile' && (
            <Profile
              tasks={tasks.map(toTaskItem)}
              onRefresh={handleRefreshTasks}
            />
          )}
        </div>

      </div>
    </WindowFrame>
  );
}
