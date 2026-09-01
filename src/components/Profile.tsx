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
  RotateCcw,
  ScrollText,
} from 'lucide-react';
import type { TaskRecord } from '../shared/domain/tasks';
import { groupTasksForDisplay, type TaskListGroup } from '../features/tasks/taskBatchGrouping';
import { toTaskListItem } from '../features/tasks/taskMappers';
import { useOpenOutputDirectory } from '../hooks/useOpenOutputDirectory';
import { useAppLogs } from '../hooks/useAppLogs';
import { useDesktopClient } from '../hooks/useDesktopClient';
import AppLogList from './AppLogList';
import TaskDetailDrawer from './TaskDetailDrawer';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { cn } from '@/src/lib/utils';
import { UI } from '../shared/view/design';
import { getFeatureRoute } from '../shared/view/featureRoutes';
import { toDisplaySrc } from '../lib/fileUrl';

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

function buildPageNumbers(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 9) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set<number>([
    1,
    total,
    current,
    current - 1,
    current + 1,
    current - 2,
    current + 2,
  ]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((left, right) => left - right);
  const result: Array<number | 'ellipsis'> = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const page = sorted[index]!;
    if (index > 0 && page - sorted[index - 1]! > 1) {
      result.push('ellipsis');
    }
    result.push(page);
  }
  return result;
}

function clampPage(page: number, totalPages: number) {
  if (totalPages <= 0) {
    return 1;
  }
  return Math.min(Math.max(1, page), totalPages);
}

function getTaskPreviewImage(task: TaskRecord) {
  return task.imports[0] ?? null;
}

function canRestoreGroup(group: TaskListGroup): boolean {
  const feature = group.representative.request?.feature;
  if (!feature) {
    return false;
  }
  if (group.kind !== 'batch') {
    return true;
  }
  const tab = getFeatureRoute(feature).tab;
  return tab === 'productSet' || tab === 'sku';
}

interface ProfileProps {
  tasks: TaskRecord[];
  onRefresh: () => void;
  onRestoreTask: (task: TaskRecord) => void;
}

export default function Profile({ tasks, onRefresh, onRestoreTask }: ProfileProps) {
  const desktop = useDesktopClient();
  const { logs, isLoading: isLoadingLogs, refresh: refreshLogs } = useAppLogs(desktop);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Running' | 'Completed' | 'Failed'>('All');
  const [featureFilter, setFeatureFilter] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [pageJumpValue, setPageJumpValue] = useState('');
  const [openingTaskId, setOpeningTaskId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<TaskListGroup | null>(null);
  const selectedTask = selectedGroup?.representative ?? null;
  const openDirectoryRequestRef = useRef(0);
  const { openTaskOutputDirectory, resetOpenOutputDirectory } = useOpenOutputDirectory();

  const clearOpeningDirectoryState = useCallback(() => {
    openDirectoryRequestRef.current += 1;
    resetOpenOutputDirectory();
    setOpeningTaskId(null);
  }, [resetOpenOutputDirectory]);

  const handleSelectGroup = useCallback((group: TaskListGroup) => {
    clearOpeningDirectoryState();
    setSelectedGroup(group);
  }, [clearOpeningDirectoryState]);

  const handleCloseDrawer = useCallback(() => {
    clearOpeningDirectoryState();
    setSelectedGroup(null);
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
    void refreshLogs();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  useEffect(() => {
    if (typeof logsEndRef.current?.scrollIntoView === 'function') {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const featureOptions = useMemo(() => {
    const features = new Set<string>();
    for (const task of tasks) {
      if (task.feature.trim()) {
        features.add(task.feature);
      }
    }
    return [...features].sort((left, right) => left.localeCompare(right, 'zh-CN'));
  }, [tasks]);

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return groupTasksForDisplay(tasks).filter((group) => {
      const item = toTaskListItem(group);
      const matchesSearch = !query || [
        item.id,
        item.feature,
        item.batchId ?? '',
        item.outputBatchId ?? '',
        ...item.taskIds,
      ].some((value) => value.toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      const matchesFeature = featureFilter === 'All' || item.feature === featureFilter;
      return matchesSearch && matchesStatus && matchesFeature;
    });
  }, [tasks, searchQuery, statusFilter, featureFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, featureFilter, pageSize]);

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedGroups = filteredGroups.slice(startIndex, startIndex + pageSize);
  const totalPages = Math.ceil(filteredGroups.length / pageSize);
  const visiblePages = buildPageNumbers(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handlePageJump = () => {
    const parsed = Number.parseInt(pageJumpValue.trim(), 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    setCurrentPage(clampPage(parsed, totalPages));
    setPageJumpValue('');
  };

  const statusBadge = (status: TaskRecord['status']) => {
    switch (status) {
      case 'Pending':
        return (
          <span className={UI.badgeWarning}>
            <Clock className="size-3 shrink-0 opacity-80" aria-hidden />
            待处理
          </span>
        );
      case 'Running':
        return (
          <span className={UI.badgeInfo}>
            <span className="size-1.5 shrink-0 rounded-full bg-current opacity-80 animate-pulse" aria-hidden />
            运行中
          </span>
        );
      case 'Completed':
        return (
          <span className={UI.badgeSuccess}>
            <CheckCircle className="size-3 shrink-0 opacity-80" aria-hidden />
            已完成
          </span>
        );
      case 'Failed':
        return (
          <span className={UI.badgeError}>
            <XCircle className="size-3 shrink-0 opacity-80" aria-hidden />
            失败
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="ui-page-scroll" id="profile-tab-viewport">
      <div className="mb-6 flex items-center justify-between" id="profile-header">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">个人中心</h2>
          <p className="text-sm text-muted-foreground mt-1">任务管理与应用进程日志</p>
        </div>
        <Button id="refresh-profile-tasks" variant="outline" size="sm" onClick={handleRefreshClick}>
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          刷新数据
        </Button>
      </div>

      <Card className="mb-6" id="profile-app-logs">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">应用进程日志</CardTitle>
          </div>
          <Badge variant="secondary">{logs.length} 条</Badge>
        </CardHeader>
        <CardContent className="p-0" id="profile-app-logs-viewport">
          <AppLogList
            logs={logs}
            isLoading={isLoadingLogs}
            emptyText="暂无应用日志"
            viewportClassName="h-56"
            logsEndRef={logsEndRef}
          />
        </CardContent>
      </Card>

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
                id="tasks-feature-filter"
                value={featureFilter}
                onChange={(e) => setFeatureFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring appearance-none pr-8 max-w-[10rem]"
              >
                <option value="All">全部功能</option>
                {featureOptions.map((feature) => (
                  <option key={feature} value={feature}>{feature}</option>
                ))}
              </select>
              <Filter className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground pointer-events-none" />
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
                  <th className="py-3 px-4 w-16">预览</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody id="tasks-table-body">
                {paginatedGroups.length > 0 ? (
                  paginatedGroups.map((group) => {
                    const item = toTaskListItem(group);
                    const representative = group.representative;
                    const canOpenDirectory = item.status === 'Completed' && item.outputCount > 0;
                    const isOpening = openingTaskId === representative.taskId;
                    const isSelected = selectedGroup?.key === group.key;
                    const previewImage = getTaskPreviewImage(representative);

                    return (
                      <tr
                        key={group.key}
                        className={cn(
                          'border-b last:border-0 transition-colors cursor-pointer',
                          isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30',
                        )}
                        onClick={() => handleSelectGroup(group)}
                      >
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {item.kind === 'batch' ? (
                            <div>
                              <p className="font-medium text-foreground">批量任务 · {item.subTaskCount} 项</p>
                              <p className="mt-0.5 font-mono text-[11px]">{item.outputBatchId?.slice(0, 8)}...</p>
                            </div>
                          ) : (
                            <span className="font-mono">{item.id}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium">{item.feature}</td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {item.kind === 'batch'
                            ? `批量 · ${item.subTaskCount}`
                            : item.batchId
                              ? `${item.batchId.slice(0, 8)}...`
                              : '-'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {item.importCount ?? 0}/{item.outputCount ?? 0}
                        </td>
                        <td className="py-3 px-4">{statusBadge(item.status)}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{item.time}</td>
                        <td className="py-3 px-4">
                          {previewImage ? (
                            <div className="size-10 overflow-hidden rounded border bg-muted/30">
                              <img
                                src={toDisplaySrc(previewImage.filePath)}
                                alt={previewImage.fileName}
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              id={`restore-task-${representative.taskId}`}
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                               disabled={!canRestoreGroup(group)}
                              onClick={(event) => {
                                event.stopPropagation();
                                onRestoreTask(representative);
                              }}
                            >
                              <RotateCcw className="h-3 w-3" />
                              还原
                            </Button>
                            <Button
                              id={`open-task-${representative.taskId}`}
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              disabled={!canOpenDirectory || isOpening}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleOpenTaskDirectory(representative);
                              }}
                            >
                              <FolderOpen className={cn('h-3 w-3', isOpening && 'animate-pulse')} />
                              {isOpening ? '打开中' : '打开目录'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
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
            显示 {filteredGroups.length === 0 ? 0 : Math.min(startIndex + 1, filteredGroups.length)}-
            {Math.min(startIndex + pageSize, filteredGroups.length)} / {filteredGroups.length}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2" id="profile-pagination">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground whitespace-nowrap">每页</span>
              <select
                id="pagination-page-size"
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value) as PageSize)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="每页条数"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground whitespace-nowrap">条</span>
            </div>
            <Button
              id="pagination-prev"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {visiblePages.map((page, index) => (
              page === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">…</span>
              ) : (
                <Button
                  key={page}
                  id={`pagination-page-${page}`}
                  variant={currentPage === page ? 'default' : 'ghost'}
                  size="icon"
                  className="h-7 w-7 text-xs"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              )
            ))}
            <Button
              id="pagination-next"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <form
              className="flex items-center gap-1.5 pl-1"
              onSubmit={(event) => {
                event.preventDefault();
                handlePageJump();
              }}
            >
              <span className="text-xs text-muted-foreground whitespace-nowrap">跳至</span>
              <Input
                id="pagination-jump-input"
                type="number"
                min={1}
                max={Math.max(totalPages, 1)}
                value={pageJumpValue}
                onChange={(event) => setPageJumpValue(event.target.value)}
                className="h-7 w-14 px-2 text-xs"
                aria-label="跳转页码"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">页</span>
              <Button id="pagination-jump-submit" type="submit" variant="outline" size="sm" className="h-7 px-2 text-xs">
                跳转
              </Button>
            </form>
          </div>
        </div>
      </Card>

      <TaskDetailDrawer
        task={selectedTask}
        relatedTasks={selectedGroup?.kind === 'batch' ? selectedGroup.tasks : undefined}
        onClose={handleCloseDrawer}
        onOpenDirectory={handleOpenTaskDirectory}
         onRestoreTask={(task) => {
           if (selectedGroup && canRestoreGroup(selectedGroup)) {
             onRestoreTask(task);
           }
         }}
         canRestoreTask={selectedGroup ? canRestoreGroup(selectedGroup) : false}
         isOpeningDirectory={selectedTask ? openingTaskId === selectedTask.taskId : false}
      />
    </div>
  );
}
