import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Sidebar from './Sidebar';

describe('Sidebar', () => {
  it('does not render GPU or disk writing footer copy', () => {
    render(<Sidebar activeTab="sticker" onTabChange={() => {}} />);

    expect(screen.queryByText(/GPU ACCELERATED/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/LOCAL DISK WRITING/i)).not.toBeInTheDocument();
  });

  it('renders the sidebar as a dark segmented panel', () => {
    const { container } = render(<Sidebar activeTab="sticker" onTabChange={() => {}} />);

    expect(container.querySelector('#app-sidebar')).toHaveClass(
      'bg-[#111111]',
      'border-r',
      'border-[#1f1f1f]',
    );
  });
});
