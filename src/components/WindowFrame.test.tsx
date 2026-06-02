import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import WindowFrame from './WindowFrame';

describe('WindowFrame', () => {
  it('does not render the simulated titlebar metadata', () => {
    render(
      <WindowFrame title="Tickpic">
        <div>content</div>
      </WindowFrame>,
    );

    expect(screen.queryByText(/ELECTRON EMULATOR/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ELECTRON \+ TS/i)).not.toBeInTheDocument();
  });

  it('uses a full-window dark shell instead of a card frame', () => {
    const { container } = render(
      <WindowFrame title="Tickpic">
        <div>content</div>
      </WindowFrame>,
    );

    expect(container.querySelector('#desktop-environment')).toHaveClass(
      'min-h-screen',
      'bg-[#050505]',
      'p-0',
    );
    expect(container.querySelector('#electron-main-window')).toHaveClass(
      'h-screen',
      'w-screen',
      'rounded-none',
      'border-0',
    );
  });
});
