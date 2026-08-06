import type React from 'react';
import { Images, Layers, Package, Settings, Sparkles, User } from 'lucide-react';

import type { ActiveTab } from '../shared/view/ui';
import { cn } from '@/src/lib/utils';
import { Separator } from '@/src/components/ui/separator';
import EyeCareToggle from './EyeCareToggle';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const menuItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'sticker', label: '贴纸出图', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'product', label: '产品处理', icon: <Package className="h-4 w-4" /> },
    { id: 'productSet', label: '套图处理', icon: <Images className="h-4 w-4" /> },
    { id: 'settings', label: '设置', icon: <Settings className="h-4 w-4" /> },
    { id: 'profile', label: '个人中心', icon: <User className="h-4 w-4" /> },
  ];

  return (
    <aside
      className="flex w-[260px] shrink-0 select-none flex-col border-r border-sidebar-border bg-sidebar shadow-sm"
      id="app-sidebar"
    >
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
          <Layers className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-sidebar-foreground">Tickpic</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            专业工作区
          </div>
        </div>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 p-3">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`sidebar-tab-${item.id}`}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn(isActive ? 'text-primary' : 'text-muted-foreground')}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <EyeCareToggle showDescription={false} switchId="sidebar-eye-care-switch" />
      </div>
    </aside>
  );
}
