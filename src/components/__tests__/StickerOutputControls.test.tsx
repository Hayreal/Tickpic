import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StickerOutputQuality } from '../../shared/domain/stickerOutputSpec';
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

    const alert = screen.getByRole('alert');
    const widthInput = screen.getByRole('textbox', { name: '比例宽' });
    const heightInput = screen.getByRole('textbox', { name: '比例高' });
    expect(alert).toHaveTextContent(expectedError);
    expect(alert.id).not.toBe('');
    expect(widthInput).toHaveAttribute('aria-invalid', 'true');
    expect(heightInput).toHaveAttribute('aria-invalid', 'true');
    expect(widthInput).toHaveAttribute('aria-describedby', alert.id);
    expect(heightInput).toHaveAttribute('aria-describedby', alert.id);
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

  it('syncs a custom ratio that becomes valid after switching from 1K to 2K', () => {
    function ControlledRatio() {
      const [value, setValue] = useState('auto');
      const [quality, setQuality] = useState<StickerOutputQuality>('1K');
      const [validation, setValidation] = useState<string>();

      return (
        <>
          <span data-testid="parent-ratio">{value}</span>
          <span data-testid="parent-validation">{validation ?? 'valid'}</span>
          <StickerProductRatioSelect
            value={value}
            outputQuality={quality}
            onChange={setValue}
            onValidationChange={setValidation}
          />
          <button type="button" onClick={() => setQuality('2K')}>使用 2K</button>
        </>
      );
    }

    render(<ControlledRatio />);
    fireEvent.click(screen.getByRole('button', { name: /产品比例/i }));
    fireEvent.click(screen.getByRole('option', { name: /自定义/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '比例宽' }), { target: { value: '100' } });
    fireEvent.change(screen.getByRole('textbox', { name: '比例高' }), { target: { value: '1' } });

    expect(screen.getByTestId('parent-ratio')).toHaveTextContent('auto');
    expect(screen.getByTestId('parent-validation')).toHaveTextContent(/过于极端/);

    fireEvent.click(screen.getByRole('button', { name: '使用 2K' }));

    expect(screen.getByTestId('parent-ratio')).toHaveTextContent('100:1');
    expect(screen.getByText('100:1 · 2K → 2048 × 16 px')).toBeInTheDocument();
    expect(screen.getByTestId('parent-validation')).toHaveTextContent('valid');
  });

  it('emits a ratio again after an external custom-to-custom value change', () => {
    const onChange = vi.fn();

    function ControlledRatio() {
      const [value, setValue] = useState('auto');

      const handleChange = (nextValue: string) => {
        onChange(nextValue);
        setValue(nextValue);
      };

      return (
        <>
          <span data-testid="parent-ratio">{value}</span>
          <StickerProductRatioSelect
            value={value}
            outputQuality="1K"
            onChange={handleChange}
          />
          <button type="button" onClick={() => setValue('4:2')}>外部设置 4:2</button>
        </>
      );
    }

    render(<ControlledRatio />);
    fireEvent.click(screen.getByRole('button', { name: /产品比例/i }));
    fireEvent.click(screen.getByRole('option', { name: /自定义/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '比例宽' }), { target: { value: '3' } });
    fireEvent.change(screen.getByRole('textbox', { name: '比例高' }), { target: { value: '2' } });

    expect(screen.getByTestId('parent-ratio')).toHaveTextContent('3:2');
    expect(onChange).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '外部设置 4:2' }));
    expect(screen.getByTestId('parent-ratio')).toHaveTextContent('4:2');
    expect(screen.getByRole('textbox', { name: '比例宽' })).toHaveValue('4');
    expect(screen.getByRole('textbox', { name: '比例高' })).toHaveValue('2');

    onChange.mockClear();
    fireEvent.change(screen.getByRole('textbox', { name: '比例宽' }), { target: { value: '3' } });

    expect(screen.getByText('3:2 · 1K → 1024 × 688 px')).toBeInTheDocument();
    expect(screen.getByTestId('parent-ratio')).toHaveTextContent('3:2');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('3:2');
  });

  it.each([
    ['auto', '外部切自动'],
    ['21:5', '外部切预设'],
  ])('clears custom validation when the controlled value switches to %s', (nextValue, buttonLabel) => {
    function ControlledRatio() {
      const [value, setValue] = useState('3:2');
      const [validation, setValidation] = useState<string>();

      return (
        <>
          <span data-testid="parent-validation">{validation ?? 'valid'}</span>
          <StickerProductRatioSelect
            value={value}
            outputQuality="1K"
            onChange={setValue}
            onValidationChange={setValidation}
          />
          <button type="button" onClick={() => setValue(nextValue)}>{buttonLabel}</button>
        </>
      );
    }

    render(<ControlledRatio />);
    fireEvent.change(screen.getByRole('textbox', { name: '比例宽' }), { target: { value: '0' } });
    expect(screen.getByTestId('parent-validation')).toHaveTextContent(/必须大于 0/);

    fireEvent.click(screen.getByRole('button', { name: buttonLabel }));

    expect(screen.getByTestId('parent-validation')).toHaveTextContent('valid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows only the custom label when a preset has no valid custom draft', () => {
    render(
      <StickerProductRatioSelect
        value="21:5"
        outputQuality="1K"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /产品比例/i }));
    fireEvent.click(screen.getByRole('option', { name: /自定义/ }));

    expect(screen.getByRole('button', { name: '产品比例 自定义' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /自定义 · 21:5/ })).not.toBeInTheDocument();
  });

  it('returns focus to the trigger when Escape closes the list', () => {
    render(
      <StickerProductRatioSelect
        value="auto"
        outputQuality="1K"
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /产品比例/i });
    fireEvent.click(trigger);
    screen.getByRole('option', { name: /罐子.*21:5/ }).focus();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
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

  it('clears custom validation when the basic panel unmounts and remounts', () => {
    function PanelWithValidation() {
      const [value, setValue] = useState('3:2');
      const [validation, setValidation] = useState<string>();

      return (
        <>
          <span data-testid="panel-validation">{validation ?? 'valid'}</span>
          <FeatureParameterPanels
            reference={<div>参考内容</div>}
            basic={(
              <StickerProductRatioSelect
                value={value}
                outputQuality="1K"
                onChange={setValue}
                onValidationChange={setValidation}
              />
            )}
          />
        </>
      );
    }

    render(<PanelWithValidation />);
    fireEvent.change(screen.getByRole('textbox', { name: '比例宽' }), { target: { value: '0' } });
    expect(screen.getByTestId('panel-validation')).toHaveTextContent(/必须大于 0/);

    fireEvent.click(screen.getByRole('button', { name: /基础参数/ }));

    expect(screen.getByTestId('panel-validation')).toHaveTextContent('valid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /基础参数/ }));
    expect(screen.getByTestId('panel-validation')).toHaveTextContent('valid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
