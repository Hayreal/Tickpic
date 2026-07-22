import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StickerNegativePromptField from '../StickerNegativePromptField';

describe('StickerNegativePromptField', () => {
  it('reports characters and limits input to 500 characters', () => {
    const onChange = vi.fn();
    render(<StickerNegativePromptField prefix="copy" value="avoid gold" onChange={onChange} />);

    const input = screen.getByLabelText('负面提示词');
    expect(input).toHaveAttribute('id', 'copy-negative-prompt-input');
    expect(input).toHaveAttribute('maxlength', '500');
    expect(screen.getByText('10 / 500')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'avoid bottles' } });
    expect(onChange).toHaveBeenCalledWith('avoid bottles');
  });
});
