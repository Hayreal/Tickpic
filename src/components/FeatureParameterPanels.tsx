import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';

/** 折叠面板内表单项网格（随页面宽度自适应列数） */
export const FEATURE_PANEL_GRID = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

/** 参考图面板内字段占满整行（避免被多列网格挤窄） */
export const REFERENCE_FIELD_SPAN = 'col-span-full w-full min-w-0';

/** 参考图面板内上下双上传（各行内图片横向排列，添加位在尾部） */
export const REFERENCE_UPLOAD_STACK = `${REFERENCE_FIELD_SPAN} grid grid-cols-1 gap-3`;

interface CollapsiblePanelProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsiblePanel({
  title,
  description,
  defaultOpen = true,
  children,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div className="border-t border-border px-4 py-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

interface FeatureParameterPanelsProps {
  reference: React.ReactNode;
  basic?: React.ReactNode | null;
  advanced?: React.ReactNode | null;
}

export default function FeatureParameterPanels({
  reference,
  basic,
  advanced,
}: FeatureParameterPanelsProps) {
  return (
    <div className="space-y-3">
      <CollapsiblePanel
        title="参考图"
        description="上传原图、产品图或风格参考，可选框选区域"
        defaultOpen
      >
        <div className={FEATURE_PANEL_GRID}>{reference}</div>
      </CollapsiblePanel>

      {basic ? (
        <CollapsiblePanel
          title="基础参数"
          description="图片比例与生成数量"
          defaultOpen
        >
          <div className={FEATURE_PANEL_GRID}>{basic}</div>
        </CollapsiblePanel>
      ) : null}

      {advanced ? (
        <CollapsiblePanel
          title="高级参数"
          description="描述、色系与其他可选配置"
          defaultOpen={false}
        >
          <div className={FEATURE_PANEL_GRID}>{advanced}</div>
        </CollapsiblePanel>
      ) : null}
    </div>
  );
}
