import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AspectRatioSelect from '../AspectRatioSelect';

afterEach(() => {
  cleanup();
});

describe('AspectRatioSelect', () => {
  it('opens a custom option list and reports selection changes', () => {
    const onChange = vi.fn();

    render(
      <AspectRatioSelect
        id="aspect-ratio-test"
        value="auto"
        onChange={onChange}
        label="图片比例"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /图片比例/i }));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /native/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: /1:1/ }));

    expect(onChange).toHaveBeenCalledWith('1:1');
  });

  it('filters options when searching', () => {
    render(
      <AspectRatioSelect
        id="aspect-ratio-search"
        value="auto"
        onChange={vi.fn()}
        label="图片比例"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /图片比例/i }));
    fireEvent.change(screen.getByPlaceholderText(/搜索比例/i), { target: { value: '主图' } });

    expect(screen.getByRole('option', { name: /1:1/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /16:9/ })).not.toBeInTheDocument();
  });
});
