import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  FolderOpen,
  Filter,
} from 'lucide-react';
import type { TaskRecord } from '../shared/domain/tasks';
import { toTaskItem } from '../features/tasks/taskMappers';
import { sortTasksByUpdatedAtDesc } from '../features/tasks/sortTasks';
import { useOpenOutputDirectory } from '../hooks/useOpenOutputDirectory';
import TaskDetailDrawer from './TaskDetailDrawer';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { cn } from '@/src/lib/utils';

const ITEMS_PER_PAGE = 10;

interface ProfileProps {
  tasks: TaskRecord[];
  onRefresh: () => void;
}

export default function Profile({ tasks, onRefresh }: ProfileProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Running' | 'Completed' | 'Failed'>('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [openingTaskId, setOpeningTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const openDirectoryRequestRef = useRef(0);
  const { openTaskOutputDirectory, resetOpenOutputDirectory } = useOpenOutputDirectory();

  const clearOpeningDirectoryState = useCallback(() => {
    openDirectoryRequestRef.current += 1;
    resetOpenOutputDirectory();
    setOpeningTaskId(null);
  }, [resetOpenOutputDirectory]);

  const handleSelectTask = useCallback((task: TaskRecord) => {
    clearOpeningDirectoryState();
    setSelectedTask(task);
  }, [clearOpeningDirectoryState]);

  const handleCloseDrawer = useCallback(() => {
    clearOpeningDirectoryState();
    setSelectedTask(null);
  }, [clearOpeningDirectoryState]);

  const handleOpenTaskDirectory = useCallback(async (task: TaskRecord) => {
    const requestId = openDirectoryRequestRef.current + 1;
    openDirectoryRequestRef.current = requestId;
    setOpeningTaskId(task.taskId);

    try {
      await openTaskOutputDirectory(task);
    } catch (err) {
      if (openDirectoryRequestRef.current !== requestId) {
        return;
      }
      const message = err instanceof Error ? err.message : '打开目录失败';
      alert(message);
    } finally {
      if (openDirectoryRequestRef.current === requestId) {
        setOpeningTaskId(null);
      }
    }
  }, [openTaskOutputDirectory]);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const filteredTasks = useMemo(() => {
    const sorted = sortTasksByUpdatedAtDesc(tasks);
    return sorted.filter((task) => {
      const item = toTaskItem(task);
      const matchesSearch =
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.feature.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.batchId || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tasks, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTasks = filteredTasks.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredTasks.length / ITEMS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const statusBadge = (status: TaskRecord['status']) => {
    switch (status) {
      case 'Pending':
        return <Badge variant="warning"><Clock className="h-3 w-3" />待处理</Badge>;
      case 'Running':
        return <Badge variant="info"><span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />运行中</Badge>;
      case 'Completed':
        return <Badge variant="success"><CheckCircle className="h-3 w-3" />已完成</Badge>;
      case 'Failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3" />失败</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="ui-page-scroll" id="profile-tab-viewport">
      <div className="mb-6 flex items-center justify-between" id="profile-header">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">个人中心</h2>
          <p className="text-sm text-muted-foreground mt-1">任务管理与运行状态</p>
        </div>
        <Button id="refresh-profile-tasks" variant="outline" size="sm" onClick={handleRefreshClick}>
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          刷新数据
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6" id="profile-dashboard-metrics">
        <Card id="metric-total-tasks">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总任务数</CardTitle>
            <Badge variant="secondary">{tasks.length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{tasks.length}</div>
            <p className="text-xs text-emerald-600 mt-1">↗ 本周 +12%</p>
          </CardContent>
        </Card>

        <Card id="metric-running-tasks">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">运行中</CardTitle>
            <RefreshCw className="h-4 w-4 text-primary animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {tasks.filter((t) => t.status === 'Running').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">消耗约 1.2 积分/分钟</p>
          </CardContent>
        </Card>
      </div>

      <Card id="tasks-table-container">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b">
          <CardTitle className="text-base">最近任务</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search-tasks-input"
                placeholder="搜索任务..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <select
                id="tasks-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring appearance-none pr-8"
              >
                <option value="All">全部状态</option>
                <option value="Pending">待处理</option>
                <option value="Running">运行中</option>
                <option value="Completed">已完成</option>
                <option value="Failed">失败</option>
              </select>
              <Filter className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto" id="tasks-data-table">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-medium text-muted-foreground">
                  <th className="py-3 px-4">任务ID</th>
                  <th className="py-3 px-4">功能</th>
                  <th className="py-3 px-4">批次</th>
                  <th className="py-3 px-4">导入/出图</th>
                  <th className="py-3 px-4">状态</th>
                  <th className="py-3 px-4">时间</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody id="tasks-table-body">
                {paginatedTasks.length > 0 ? (
                  paginatedTasks.map((task) => {
                    const item = toTaskItem(task);
                    const canOpenDirectory = task.status === 'Completed' && task.outputs.length > 0;
                    const isOpening = openingTaskId === task.taskId;
                    const isSelected = selectedTask?.taskId === task.taskId;

                    return (
                      <tr
                        key={task.taskId}
                        className={cn(
                          'border-b last:border-0 transition-colors cursor-pointer',
                          isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30',
                        )}
                        onClick={() => handleSelectTask(task)}
                      >
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{item.id}</td>
                        <td className="py-3 px-4 text-sm font-medium">{item.feature}</td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {item.batchId ? `${item.batchId.slice(0, 8)}...` : '-'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {item.importCount ?? 0}/{item.outputCount ?? 0}
                        </td>
                        <td className="py-3 px-4">{statusBadge(task.status)}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{item.time}</td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            id={`open-task-${task.taskId}`}
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs"
                            disabled={!canOpenDirectory || isOpening}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleOpenTaskDirectory(task);
                            }}
                          >
                            <FolderOpen className={cn('h-3 w-3', isOpening && 'animate-pulse')} />
                            {isOpening ? '打开中' : '打开目录'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      暂无符合过滤条件的任务
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>

        <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/20" id="tasks-table-footer">
          <span className="text-xs text-muted-foreground">
            显示 {filteredTasks.length === 0 ? 0 : Math.min(startIndex + 1, filteredTasks.length)}-
            {Math.min(startIndex + ITEMS_PER_PAGE, filteredTasks.length)} / {filteredTasks.length}
          </span>
          <div className="flex items-center gap-1" id="profile-pagination">
            <Button
              id="pagination-prev"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages || 1 }).map((_, idx) => {
              const p = idx + 1;
              return (
                <Button
                  key={p}
                  id={`pagination-page-${p}`}
                  variant={currentPage === p ? 'default' : 'ghost'}
                  size="icon"
                  className="h-7 w-7 text-xs"
                  onClick={() => setCurrentPage(p)}
                >
                  {p}
                </Button>
              );
            })}
            <Button
              id="pagination-next"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <TaskDetailDrawer
        task={selectedTask}
        onClose={handleCloseDrawer}
        onOpenDirectory={handleOpenTaskDirectory}
        isOpeningDirectory={selectedTask ? openingTaskId === selectedTask.taskId : false}
      />
    </div>
  );
}
