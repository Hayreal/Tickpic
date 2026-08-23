import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SkuGen from '../SkuGen';

const submitMany = vi.fn();

vi.mock('../../hooks/useImageTask', () => ({
  useImageTask: () => ({
    submitMany,
    bindTask: vi.fn(() => Promise.resolve(null)),
    restoreTask: vi.fn(),
    getTask: vi.fn(() => null),
    getTasks: vi.fn(() => []),
    getError: vi.fn(() => null),
    isSubmitting: false,
    reset: vi.fn(),
  }),
}));

vi.mock('../../hooks/useOpenOutputDirectory', () => ({
  useOpenOutputDirectory: () => ({ openActiveTaskDirectory: vi.fn() }),
}));

vi.mock('../../hooks/useDesktopClient', () => ({
  useDesktopClient: () => null,
}));

vi.mock('../../hooks/useAppLogs', () => ({
  useAppLogs: () => ({ logs: [], isLoading: false }),
}));

afterEach(() => {
  cleanup();
  submitMany.mockReset();
});

describe('SkuGen hit main tab', () => {
  it('renders the fourth tab and required hit-main reference uploader', () => {
    render(<SkuGen />);

    fireEvent.click(screen.getByRole('button', { name: '爆款主图' }));

    expect(screen.getByText('爆款主图参考')).toBeTruthy();
    expect(screen.getByText('上传一张爆款电商主图作卖点与场景参考')).toBeTruthy();
    expect(screen.queryByText('可选')).toBeNull();
  });

  it('alerts when generating hit-main without the reference image', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    render(<SkuGen />);

    fireEvent.click(screen.getByRole('button', { name: '爆款主图' }));
    fireEvent.click(document.getElementById('submit-sku-hitMain')!);

    expect(alertSpy).toHaveBeenCalledWith('请上传 SKU 图');
    expect(submitMany).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
