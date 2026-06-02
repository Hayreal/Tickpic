import React, { useState } from 'react';
import { 
  RefreshCw, 
  Search, 
  SlidersHorizontal, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock,
  ExternalLink,
  Filter,
  Check
} from 'lucide-react';
import { TaskItem } from '../types';

interface ProfileProps {
  tasks: TaskItem[];
  onRefresh: () => void;
}

export default function Profile({ tasks, onRefresh }: ProfileProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Running' | 'Completed' | 'Failed'>('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  // Filter tasks based on query and status filter
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          task.feature.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (task.batchId || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate items for current page
  const itemsPerPage = 4;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTasks = filteredTasks.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);

  return (
    <div className="flex-1 bg-[#111015] p-6 lg:p-8 flex flex-col overflow-y-auto select-none" id="profile-tab-viewport">
      
      {/* Upper header section */}
      <div className="mb-6 flex items-center justify-between" id="profile-header">
        <div>
          <h2 className="text-xl font-sans font-bold text-white flex items-center gap-2">
            个人中心
          </h2>
          <p className="text-[12px] text-slate-500 font-sans tracking-wide">
            任务管理面板
          </p>
        </div>
        
        {/* Refresh data action button */}
        <button 
          id="refresh-profile-tasks"
          onClick={handleRefreshClick}
          className="cursor-pointer bg-slate-900 hover:bg-slate-850 border border-slate-850 hover:border-slate-700 text-xs text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98]"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-violet-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          刷新数据
        </button>
      </div>

      {/* Grid Dashboard Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6" id="profile-dashboard-metrics">
        
        {/* Metric 1: 总任务数 */}
        <div className="bg-[#0c0b10]/40 border border-slate-900/80 rounded-xl p-5 flex items-center justify-between relative overflow-hidden" id="metric-total-tasks">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">总任务数</span>
            <div className="text-3xl font-bold text-white tracking-tight mt-2">{1248 + tasks.length - 4}</div>
            <div className="text-[11px] text-emerald-450 font-bold flex items-center gap-1 mt-2.5 font-sans">
              <span className="text-[#10b981]">↗ 本周 +12%</span>
            </div>
          </div>
          
          {/* Circular radial mock decoration */}
          <div className="w-16 h-16 rounded-full border-[6px] border-slate-900/60 border-t-[#7c3aed] flex items-center justify-center rotate-[45deg] relative shrink-0">
            <span className="text-[10px] font-bold text-slate-500 font-mono -rotate-[45deg]">84%</span>
          </div>
        </div>

        {/* Metric 2: 运行中 */}
        <div className="bg-[#0c0b10]/40 border border-slate-900/80 rounded-xl p-5 flex items-center justify-between relative overflow-hidden" id="metric-running-tasks">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">运行中</span>
            <div className="text-3xl font-bold text-white tracking-tight mt-2">
              {tasks.filter(t => t.status === 'Running').length}
            </div>
            <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1 mt-2.5 font-sans">
              消耗约 1.2 积分/分钟
            </div>
          </div>

          {/* Glowing rotating cycle mock */}
          <div className="w-16 h-16 rounded-full bg-slate-950/20 border border-slate-900 flex items-center justify-center shrink-0">
            <RefreshCw className="w-6 h-6 text-[#a78bfa] animate-spin" />
          </div>
        </div>

      </div>

      {/* Interactive Table Container */}
      <div className="bg-[#0c0b10]/40 border border-slate-900/80 rounded-xl flex flex-col overflow-hidden" id="tasks-table-container">
        
        {/* Table Filter Top Toolbar */}
        <div className="p-4 border-b border-slate-900/80 flex flex-col sm:flex-row gap-3 sm:items-center justify-between" id="table-toolbar">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">最近任务</h3>
          </div>
          
          {/* Actions panel */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search inputs */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input 
                id="search-tasks-input"
                type="text"
                placeholder="搜索任务..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-48 bg-slate-950/80 border border-slate-850 rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            
            {/* Dropdown filters */}
            <div className="relative">
              <select
                id="tasks-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="cursor-pointer bg-slate-950/80 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white pr-8 appearance-none focus:outline-none"
              >
                <option value="All">全部状态</option>
                <option value="Running">运行中</option>
                <option value="Completed">已完成</option>
                <option value="Failed">失败</option>
              </select>
              <div className="absolute right-2.5 top-2.5 pointer-events-none text-slate-500">
                <Filter className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto" id="tasks-data-table">
          <table className="w-full text-left border-collapse select-none">
            <thead>
              <tr className="border-b border-slate-900 bg-slate-950/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                <th className="py-3 px-4">任务ID</th>
                <th className="py-3 px-4">功能</th>
                <th className="py-3 px-4">批次</th>
                <th className="py-3 px-4">导入/出图</th>
                <th className="py-3 px-4">状态</th>
                <th className="py-3 px-4">时间</th>
                <th className="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-300 divide-y divide-slate-900/60 font-sans" id="tasks-table-body">
              {paginatedTasks.length > 0 ? (
                paginatedTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-950/30 transition-colors group">
                    <td className="py-3 px-4 font-mono font-medium text-slate-400">{task.id}</td>
                    <td className="py-3 px-4 font-medium text-white flex items-center gap-1.5 h-11">
                      {task.feature}
                      {task.feature.includes('复刻') && (
                        <span className="text-[9px] bg-violet-400/10 text-[#a78bfa] border border-violet-500/10 px-1 py-0.2 rounded font-semibold">批量</span>
                      )}
                      {task.feature.includes('4x') && (
                        <span className="text-[9px] bg-slate-900 text-slate-400 border border-slate-850 px-1 py-0.2 rounded font-mono">高分辨率</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {task.batchId ? task.batchId.slice(0, 8) + '...' : '-'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {task.importCount ?? 0}/{task.outputCount ?? 0}
                    </td>
                    <td className="py-3 px-4">
                      {task.status === 'Running' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-violet-500/10 text-[#a78bfa] border border-violet-500/20 font-bold uppercase tracking-wider font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping inline-block shrink-0" />
                          运行中
                        </span>
                      )}
                      {task.status === 'Completed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] bg-[#10b981]/10 text-emerald-500 border border-[#10b981]/15 font-bold uppercase tracking-wider font-mono">
                          <CheckCircle className="w-3 h-3 text-emerald-500 fill-emerald-500/10" />
                          已完成
                        </span>
                      )}
                      {task.status === 'Failed' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold uppercase tracking-wider font-mono">
                          <XCircle className="w-3 h-3 text-rose-500" />
                          失败
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{task.time}</td>
                    <td className="py-3 px-4 text-right">
                      <button className="cursor-pointer text-slate-400 hover:text-white transition-opacity inline-flex items-center gap-1 py-1 px-2.5 rounded hover:bg-slate-900 text-[11px] font-semibold border border-transparent hover:border-slate-800">
                        管理效果
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    暂无符合过滤条件的任务明细
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination controls matching Image 2 Layout */}
        <div className="p-4 border-t border-slate-900/80 bg-[#0c0b10]/20 flex items-center justify-between" id="tasks-table-footer">
          <span className="text-[11px] text-slate-500 font-sans font-medium">
            显示 {Math.min(startIndex + 1, filteredTasks.length)}-{Math.min(startIndex + itemsPerPage, filteredTasks.length)} 条，共 {filteredTasks.length} 条任务
          </span>
          
          <div className="flex items-center gap-1.5" id="profile-pagination">
            {/* Prev arrow button */}
            <button 
              id="pagination-prev"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className={`cursor-pointer w-7 h-7 rounded bg-slate-950/60 border border-slate-850 flex items-center justify-center text-slate-500 hover:text-slate-350 disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Page buttons */}
            {Array.from({ length: totalPages || 1 }).map((_, idx) => {
              const p = idx + 1;
              return (
                <button
                  key={p}
                  id={`pagination-page-${p}`}
                  onClick={() => setCurrentPage(p)}
                  className={`cursor-pointer w-7 h-7 rounded text-xs px-1 font-bold font-mono transition-all border ${
                    currentPage === p 
                      ? 'bg-violet-950/20 text-white border-violet-500 shadow' 
                      : 'bg-transparent text-slate-400 border-transparent hover:text-white'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            {/* Next arrow button */}
            <button 
              id="pagination-next"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className={`cursor-pointer w-7 h-7 rounded bg-slate-950/60 border border-slate-855 flex items-center justify-center text-slate-500 hover:text-slate-350 disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
