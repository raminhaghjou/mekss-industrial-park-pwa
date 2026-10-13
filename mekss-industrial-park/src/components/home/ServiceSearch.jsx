import { Search, X } from 'lucide-react';

/**
 * Plain search field for the launcher; filtering itself happens in `searchServices`.
 * @param {{ value: string, onChange: (value: string) => void }} props
 */
export const ServiceSearch = ({ value, onChange }) => (
  <div className="relative">
    <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground-400" aria-hidden="true" />
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="دنبال چه می‌گردید؟ مثلاً قبض، برگ خروج، پیام"
      aria-label="جستجوی خدمات"
      enterKeyHint="search"
      className="h-12 w-full rounded-2xl bg-content1 pe-11 ps-12 text-sm text-foreground shadow-[0_4px_14px_-10px_rgba(15,23,42,0.35)] outline-none ring-1 ring-default-200 transition placeholder:text-foreground-400 focus:ring-2 focus:ring-[var(--color-brand)] dark:ring-white/10 [&::-webkit-search-cancel-button]:hidden"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="پاک کردن جستجو"
        className="absolute end-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-foreground-500 transition hover:bg-default-100 focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    )}
  </div>
);

export default ServiceSearch;
