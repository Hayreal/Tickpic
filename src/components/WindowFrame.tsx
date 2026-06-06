import type { ReactNode } from 'react';

interface WindowFrameProps {
  children: ReactNode;
  title?: string;
}

export default function WindowFrame({ children }: WindowFrameProps) {
  return (
    <div
      className="relative flex min-h-screen w-full overflow-hidden bg-background p-0 text-foreground"
      id="desktop-environment"
    >
      <div
        id="electron-main-window"
        className="flex h-screen min-h-screen w-screen overflow-hidden rounded-none border-0 bg-background"
      >
        <div className="relative flex h-full flex-1 overflow-hidden" id="electron-viewport">
          {children}
        </div>
      </div>
    </div>
  );
}
