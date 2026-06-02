import React, { useState, useEffect, useCallback } from 'react';
import WindowFrame from './components/WindowFrame';
import Sidebar from './components/Sidebar';
import StickerGen from './components/StickerGen';
import ProductProcessing from './components/ProductProcessing';
import Settings from './components/Settings';
import Profile from './components/Profile';
import { ActiveTab, TaskItem, TaskRecord } from './types';
import { createPendingTask, startTask, completeTask, failTask } from './lib/taskState';
import { getDesktopShell } from './lib/desktopShell';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sticker');
  const [tasks, setTasks] = useState<TaskRecord[]>([]);

  // Load persisted tasks on mount
  useEffect(() => {
    const shell = getDesktopShell();
    if (shell) {
      shell.listTasks().then(setTasks).catch(console.error);
    }
  }, []);

  // Persist task creation via desktop shell
  const handleCreateTask = useCallback(async (input: {
    category: string;
    feature: string;
    batchId: string;
    imports: TaskRecord['imports'];
  }) => {
    const task = createPendingTask(input);
    setTasks((prev) => [task, ...prev]);

    const shell = getDesktopShell();
    if (shell) {
      await shell.createTask(task);
    }
    return task;
  }, []);

  // Persist task updates via desktop shell
  const handleUpdateTask = useCallback(async (task: TaskRecord) => {
    setTasks((prev) => prev.map((t) => (t.taskId === task.taskId ? task : t)));

    const shell = getDesktopShell();
    if (shell) {
      await shell.updateTask(task);
    }
  }, []);

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
    const shell = getDesktopShell();
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
              tasks={tasks.map((t) => ({
                id: t.taskId,
                category: t.category,
                feature: t.feature,
                status: t.status,
                time: t.updatedAt,
                batchId: t.batchId,
                importCount: t.imports.length,
                outputCount: t.outputs.length,
              }))}
              onRefresh={handleRefreshTasks}
            />
          )}
        </div>

      </div>
    </WindowFrame>
  );
}
