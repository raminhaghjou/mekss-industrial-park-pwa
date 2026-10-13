import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ModalBackdrop, ModalContainer, ModalDialog } from '@heroui/react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { filterPickerOptions } from '../../utils/pickerSearch';

/**
 * Touch-friendly replacement for long native selects: a field-like trigger that opens a searchable list
 * (bottom sheet on phones, centred dialog on larger screens). Selecting an option commits and closes.
 *
 * @param {{
 *   label: string,
 *   value: string,
 *   options: { value: string, label: string, hint?: string, keywords?: string[] }[],
 *   onChange: (value: string) => void,
 *   placeholder?: string,
 *   searchPlaceholder?: string,
 *   emptyText?: string,
 *   disabled?: boolean,
 *   disabledText?: string,
 *   required?: boolean,
 *   error?: string,
 *   helper?: string,
 *   testId?: string,
 * }} props
 */
export const SearchablePicker = ({
  label,
  value,
  options,
  onChange,
  placeholder = 'انتخاب کنید',
  searchPlaceholder = 'جستجو...',
  emptyText = 'موردی پیدا نشد',
  disabled = false,
  disabledText,
  required = false,
  error,
  helper,
  testId,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listRef = useRef(null);
  const fieldId = useId();
  const selected = options.find((option) => option.value === value) || null;
  const filtered = useMemo(() => filterPickerOptions(options, query), [options, query]);
  const showSearch = options.length > 7;

  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => {
      const selectedNode = listRef.current?.querySelector('[aria-selected="true"]');
      if (typeof selectedNode?.scrollIntoView === 'function') selectedNode.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const choose = (option) => {
    onChange(option.value);
    close();
  };

  const triggerText = selected?.label || value || (disabled && disabledText ? disabledText : placeholder);
  const hasValue = Boolean(selected || value);

  return (
    <div className="flex flex-col gap-1">
      <span id={`${fieldId}-label`} className="text-xs font-medium text-foreground-600">
        {label}
        {required ? <span className="ms-0.5 text-danger" aria-hidden="true">*</span> : null}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${fieldId}-label ${fieldId}-value`}
        aria-invalid={error ? true : undefined}
        data-testid={testId}
        className={`flex h-12 w-full items-center gap-2 rounded-xl bg-background px-3 text-start text-sm outline-none ring-1 transition focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-60 ${error ? 'ring-danger' : 'ring-default-200 hover:ring-default-300 dark:ring-white/15'}`}
      >
        <span id={`${fieldId}-value`} className={`min-w-0 flex-1 truncate ${hasValue ? 'font-medium text-foreground' : 'text-foreground-400'}`}>
          {triggerText}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-foreground-400" aria-hidden="true" />
      </button>
      {error ? <span className="text-[11px] font-medium text-danger">{error}</span> : null}
      {!error && helper ? <span className="text-[11px] text-foreground-400">{helper}</span> : null}

      {open && (
        <ModalBackdrop isOpen={open} onOpenChange={(next) => !next && close()} variant="blur">
          <ModalContainer placement="auto" size="md">
            <ModalDialog
              aria-label={label}
              className="flex max-h-[min(85dvh,40rem)] flex-col overflow-hidden rounded-t-[1.75rem] bg-background p-0 sm:rounded-[1.75rem]"
            >
              <div className="flex flex-col gap-3 border-b border-default-100 px-4 pb-3 pt-2 dark:border-white/10">
                <span className="mx-auto h-1.5 w-10 rounded-full bg-default-300 sm:hidden" aria-hidden="true" />
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-foreground">{label}</h2>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="بستن"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-default-100 text-foreground-500 transition hover:bg-default-200 dark:bg-white/10"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {showSearch && (
                  <label className="relative block">
                    <span className="sr-only">{searchPlaceholder}</span>
                    <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-400" aria-hidden="true" />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && filtered.length > 0) {
                          event.preventDefault();
                          choose(filtered[0]);
                        }
                      }}
                      placeholder={searchPlaceholder}
                      enterKeyHint="done"
                      autoComplete="off"
                      className="h-11 w-full rounded-xl bg-default-100 pe-3 ps-9 text-[16px] text-foreground outline-none ring-1 ring-transparent transition focus:bg-background focus:ring-2 focus:ring-[var(--color-brand)] dark:bg-white/5 sm:text-sm"
                    />
                  </label>
                )}
              </div>
              <ul
                ref={listRef}
                role="listbox"
                aria-label={label}
                className="flex-1 overflow-y-auto overscroll-contain px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
              >
                {filtered.length === 0 ? (
                  <li className="px-3 py-10 text-center text-sm text-foreground-500">{emptyText}</li>
                ) : (
                  filtered.map((option) => {
                    const isSelected = option.value === value;
                    return (
                      <li key={option.value} role="option" aria-selected={isSelected}>
                        <button
                          type="button"
                          onClick={() => choose(option)}
                          className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-[15px] transition active:scale-[0.99] ${isSelected ? 'bg-[var(--color-brand-soft)] font-semibold text-[var(--color-brand)]' : 'text-foreground hover:bg-default-100 dark:hover:bg-white/5'}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{option.label}</span>
                            {option.hint ? <span className="block truncate text-xs font-normal text-foreground-400">{option.hint}</span> : null}
                          </span>
                          {isSelected ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      )}
    </div>
  );
};

export default SearchablePicker;
