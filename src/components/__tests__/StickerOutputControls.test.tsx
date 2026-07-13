import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FeatureParameterPanels from '../FeatureParameterPanels';
import StickerOutputQualitySelect from '../StickerOutputQualitySelect';
import StickerProductRatioSelect from '../StickerProductRatioSelect';

afterEach(() => {
  cleanup();
});

describe('StickerProductRatioSelect', () => {
  it('only offers automatic, product presets, and a custom ratio', () => {
    render(
      <StickerProductRatioSelect
        value="auto"
        outputQuality="1K"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /产品比例/i }));

    expect(screen.getByRole('option', { name: /自动/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /罐子.*21:5/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /高罐子.*21:10/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /瓶装.*9:12/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /自定义/ })).toBeInTheDocument();
    expect(screen.queryByText('16:9')).not.toBeInTheDocument();
    expect(screen.queryByText('1:1')).not.toBeInTheDocument();
    expect(screen.queryByText('4:3')).not.toBeInTheDocument();
    expect(screen.queryByText('3:2')).not.toBeInTheDocument();
  });

  it('reports a valid custom ratio and previews its 1K dimensions', () => {
    const onChange = vi.fn();
    const onValidationChange = vi.fn();
    render(
      <StickerProductRatioSelect
        value="auto"
        outputQuality="1K"
        onChange={onChange}
        onValidationChange={onValidationChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /产品比例/i }));
    fireEvent.click(screen.getByRole('option', { name: /自定义/ }));

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: '比例宽' }), { target: { value: '3' } });
    fireEvent.change(screen.getByRole('textbox', { name: '比例高' }), { target: { value: '2' } });

    expect(onChange).toHaveBeenLastCalledWith('3:2');
    expect(onValidationChange).toHaveBeenLastCalledWith(undefined);
    expect(screen.getByText('3:2 · 1K → 1024 × 688 px')).toBeInTheDocument();
  });

  it.each([
    ['0', '2', /必须大于 0/],
    ['100', '1', /过于极端/],
  ])('reports an inline error for invalid custom ratio %s:%s', (width, height, expectedError) => {
    const onValidationChange = vi.fn();
    render(
      <StickerProductRatioSelect
        value="auto"
        outputQuality="1K"
        onChange={vi.fn()}
        onValidationChange={onValidationChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /产品比例/i }));
    fireEvent.click(screen.getByRole('option', { name: /自定义/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '比例宽' }), { target: { value: width } });
    fireEvent.change(screen.getByRole('textbox', { name: '比例高' }), { target: { value: height } });

    expect(screen.getByRole('alert')).toHaveTextContent(expectedError);
    expect(onValidationChange).toHaveBeenLastCalledWith(expect.stringMatching(expectedError));
  });

  it('restores a custom value and updates its preview for 2K', () => {
    render(
      <StickerProductRatioSelect
        value="3:2"
        outputQuality="2K"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('textbox', { name: '比例宽' })).toHaveValue('3');
    expect(screen.getByRole('textbox', { name: '比例高' })).toHaveValue('2');
    expect(screen.getByText('3:2 · 2K → 2048 × 1360 px')).toBeInTheDocument();
  });

  it('previews a resolved automatic ratio without inventing a size when unresolved', () => {
    const { rerender } = render(
      <StickerProductRatioSelect
        value="auto"
        outputQuality="1K"
        resolvedAutoRatio="3:2"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/跟随原图比例.*3:2.*1024 × 688 px/)).toBeInTheDocument();

    rerender(
      <StickerProductRatioSelect
        value="auto"
        outputQuality="1K"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('跟随原图比例')).toBeInTheDocument();
    expect(screen.queryByText(/1024 ×/)).not.toBeInTheDocument();
  });

  it('reuses a valid custom ratio without exposing the internal custom sentinel', () => {
    const onChange = vi.fn();
    const onValidationChange = vi.fn();
    const { rerender } = render(
      <StickerProductRatioSelect
        value="3:2"
        outputQuality="1K"
        onChange={onChange}
        onValidationChange={onValidationChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /产品比例/i }));
    fireEvent.click(screen.getByRole('option', { name: /罐子.*21:5/ }));
    expect(onChange).toHaveBeenLastCalledWith('21:5');

    rerender(
      <StickerProductRatioSelect
        value="21:5"
        outputQuality="1K"
        onChange={onChange}
        onValidationChange={onValidationChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /产品比例/i }));
    fireEvent.click(screen.getByRole('option', { name: /自定义/ }));

    expect(screen.getByRole('textbox', { name: '比例宽' })).toHaveValue('3');
    expect(screen.getByRole('textbox', { name: '比例高' })).toHaveValue('2');
    expect(screen.getByText('3:2 · 1K → 1024 × 688 px')).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith('3:2');
    expect(onChange).not.toHaveBeenCalledWith('__custom__');
    expect(onValidationChange).toHaveBeenLastCalledWith(undefined);
  });
});

describe('StickerOutputQualitySelect', () => {
  it('marks 1K selected and reports a switch to 2K', () => {
    const onChange = vi.fn();
    render(<StickerOutputQualitySelect value="1K" onChange={onChange} />);

    expect(screen.getByText('清晰度')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1K' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2K' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: '2K' }));

    expect(onChange).toHaveBeenCalledWith('2K');
  });
});

describe('FeatureParameterPanels', () => {
  it('describes the sticker output controls in basic parameters', () => {
    render(
      <FeatureParameterPanels
        reference={<div>参考内容</div>}
        basic={<div>基础内容</div>}
      />,
    );

    expect(screen.getByText('产品比例、清晰度与生成数量')).toBeInTheDocument();
  });
});
