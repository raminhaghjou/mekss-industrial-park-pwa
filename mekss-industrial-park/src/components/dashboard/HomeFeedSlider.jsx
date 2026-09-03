import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Bell } from 'lucide-react';

/**
 * Elegant auto-rotating feed for dashboard announcements + ads.
 * @param {{ items: Array<{ id: string, kind: 'announcement' | 'ad', title: string, body?: string, href?: string }> }} props
 */
export const HomeFeedSlider = ({ items = [], intervalMs = 5500 }) => {
  const slides = useMemo(() => items.filter((item) => item?.title), [items]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [slides.length, intervalMs]);

  if (!slides.length) return null;

  const current = slides[index];
  const Icon = current.kind === 'ad' ? Megaphone : Bell;

  const content = (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-[#0f4c81] to-[#1a5f96] p-5 text-white shadow-sm sm:p-6">
      <div className="pointer-events-none absolute -left-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-12 right-10 h-40 w-40 rounded-full bg-black/10" />

      <div className="relative flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-wide text-white/75">
            {current.kind === 'ad' ? 'آگهی' : 'اطلاعیه'}
          </p>
          <h3 className="mt-1 truncate text-base font-bold sm:text-lg">{current.title}</h3>
          {current.body && (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/85">{current.body}</p>
          )}
        </div>
      </div>

      {slides.length > 1 && (
        <div className="relative mt-4 flex items-center gap-1.5">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`اسلاید ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (current.href) {
    return (
      <Link to={current.href} className="block animate-fade-in focus:outline-none">
        {content}
      </Link>
    );
  }

  return <div className="animate-fade-in">{content}</div>;
};

export default HomeFeedSlider;
