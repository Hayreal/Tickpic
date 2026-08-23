import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Sidebar from '../Sidebar';
import { AppearanceProvider } from '../../contexts/AppearanceContext';

function renderSidebar() {
  return render(
    <AppearanceProvider>
      <Sidebar activeTab="sticker" onTabChange={() => {}} />
    </AppearanceProvider>,
  );
}

describe('Sidebar', () => {
  afterEach(() => cleanup());

  it('does not render GPU or disk writing footer copy', () => {
    renderSidebar();

    expect(screen.queryByText(/GPU ACCELERATED/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/LOCAL DISK WRITING/i)).not.toBeInTheDocument();
  });

  it('renders eye-care mode toggle', () => {
    renderSidebar();
    expect(screen.getByRole('switch', { name: '护眼模式' })).toHaveAttribute('id', 'sidebar-eye-care-switch');
  });

  it('renders the sidebar as a light SaaS navigation panel', () => {
    const { container } = renderSidebar();

    expect(container.querySelector('#app-sidebar')).toHaveClass(
      'bg-sidebar',
      'border-r',
      'border-sidebar-border',
    );
  });

  it('navigates to product image set processing', () => {
    const onTabChange = vi.fn();
    render(
      <AppearanceProvider>
        <Sidebar activeTab="sticker" onTabChange={onTabChange} />
      </AppearanceProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '套图处理' }));

    expect(onTabChange).toHaveBeenCalledWith('productSet');
  });

  it('navigates to sku image gen', () => {
    const onTabChange = vi.fn();
    render(
      <AppearanceProvider>
        <Sidebar activeTab="sticker" onTabChange={onTabChange} />
      </AppearanceProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'SKU 作图' }));

    expect(onTabChange).toHaveBeenCalledWith('sku');
  });
});
