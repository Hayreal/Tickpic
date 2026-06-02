import type React from 'react';
import { Layers, Package, Settings, Sparkles, User } from 'lucide-react';

import type { ActiveTab } from '../shared/view/ui';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const menuItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'sticker',
      label: '贴纸出图',
      icon: <Sparkles className="h-5 w-5" />,
    },
    {
      id: 'product',
      label: '产品处理',
      icon: <Package className="h-5 w-5" />,
    },
    {
      id: 'settings',
      label: '设置',
      icon: <Settings className="h-5 w-5" />,
    },
    {
      id: 'profile',
      label: '个人中心',
      icon: <User className="h-5 w-5" />,
    },
  ];

  return (
    <div
      className="flex w-[200px] shrink-0 select-none flex-col border-r border-[#1f1f1f] bg-[#111111] md:w-[240px]"
      id="app-sidebar"
    >
      <div>
        <div className="flex items-center gap-3 border-b border-[#1f1f1f] bg-[#141414] p-5">
          <div className="h-10 w-10 shrink-0 rounded-xl border border-[#2a2a2a] bg-[#181818] p-0.5 shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[10px] bg-[#101010]">
              <div className="pointer-events-none absolute inset-0 bg-white/[0.02]" />
              <Layers className="h-4 w-4 text-[#d4d4d4]" />
            </div>
          </div>
          <div className="truncate">
            <div className="flex items-center gap-1 font-sans text-[14px] font-bold leading-tight text-white">
              Tickpic
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium tracking-wide text-slate-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#525252]" />
              专业工作区
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-1.5 p-3">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-tab-${item.id}`}
                onClick={() => onTabChange(item.id)}
                className={`relative flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left transition-all duration-150 ${
                  isActive
                    ? 'border border-[#2f2f2f] bg-[#1a1a1a] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                    : 'text-slate-400 hover:bg-[#181818] hover:text-white'
                }`}
              >
                {isActive && (
                  <div className="absolute bottom-2 left-0 top-2 w-1 rounded-r-md bg-[#f5f5f5]" />
                )}

                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-white' : 'text-slate-500'}>
                    {item.icon}
                  </span>
                  <span className="text-xs tracking-wide md:text-[13px]">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                      isActive ? 'bg-[#252525] text-slate-200' : 'bg-[#1b1b1b] text-slate-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
