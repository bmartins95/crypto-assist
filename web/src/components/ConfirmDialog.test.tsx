import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog';

const baseProps = {
  title: 'Limpar carteira',
  message: 'Tem certeza? Todas as operações serão removidas permanentemente.',
  confirmLabel: 'Limpar dados',
  cancelLabel: 'Cancelar',
};

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(<ConfirmDialog {...baseProps} open={false} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('renders the title and message when open', () => {
    render(<ConfirmDialog {...baseProps} open onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('Limpar carteira');
    expect(dialog.textContent).toContain(baseProps.message);
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} open onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: baseProps.confirmLabel }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel button is clicked, without calling onConfirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} open onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel on Escape, without calling onConfirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} open onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel on backdrop click, without calling onConfirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(<ConfirmDialog {...baseProps} open onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(container.querySelector('.confirm-backdrop')!);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('ignores keys other than Escape', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} open onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Enter' });
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('focuses the cancel button when it opens', () => {
    render(<ConfirmDialog {...baseProps} open onConfirm={() => {}} onCancel={() => {}} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('renders no checkbox when checkboxLabel is omitted', () => {
    render(<ConfirmDialog {...baseProps} open onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders a checkbox with the given label and checked state when checkboxLabel is provided', () => {
    render(<ConfirmDialog {...baseProps} open onConfirm={() => {}} onCancel={() => {}}
      checkboxLabel="Não perguntar novamente" checkboxChecked onCheckboxChange={() => {}} />);
    const checkbox = screen.getByRole('checkbox', { name: 'Não perguntar novamente' });
    expect(checkbox).toBeChecked();
  });

  it('calls onCheckboxChange with the new checked state when the checkbox is toggled', () => {
    const onCheckboxChange = vi.fn();
    render(<ConfirmDialog {...baseProps} open onConfirm={() => {}} onCancel={() => {}}
      checkboxLabel="Não perguntar novamente" checkboxChecked={false} onCheckboxChange={onCheckboxChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Não perguntar novamente' }));
    expect(onCheckboxChange).toHaveBeenCalledWith(true);
  });
});
