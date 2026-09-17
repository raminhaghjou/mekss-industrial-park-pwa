import { useId } from 'react';

/** Visible RTL-friendly toggle — HeroUI Switch needs compound slots and renders empty alone. */
export const SettingToggle = ({ checked, onChange, label, disabled = false }) => {
  const id = useId();
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]'
          : 'border-default-300 bg-default-200 dark:border-white/20 dark:bg-white/15'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? 'start-0.5 translate-x-0' : 'start-[calc(100%-1.625rem)]'
        }`}
      />
    </button>
  );
};
