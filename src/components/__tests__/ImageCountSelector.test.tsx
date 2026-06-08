import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ImageCountSelector from '../ImageCountSelector';

afterEach(() => {
  cleanup();
});

describe('ImageCountSelector', () => {
  it('renders 1/2/4/8 count options', () => {
    const onChange = vi.fn();

    render(
      <ImageCountSelector
        id="count-test"
        value={4}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('button', { name: '1 张' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2 张' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4 张' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '8 张' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2 张' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
