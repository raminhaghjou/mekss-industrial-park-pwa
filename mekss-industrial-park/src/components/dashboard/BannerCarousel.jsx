import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { bannerApi, isAllowedBannerLink, isExternalBannerLink } from '../../services/api/banner.api';
import { filesApi } from '../../services/api/files.api';

export const BANNER_INTERVAL_MS = 6500;
export const MOBILE_BANNER_QUERY = '(max-width: 767px)';
const SWIPE_THRESHOLD_PX = 40;

const matchMediaSafe = (query) => (
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
);

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => Boolean(matchMediaSafe(query)?.matches));
  useEffect(() => {
    const media = matchMediaSafe(query);
    if (!media) return undefined;
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [query]);
  return matches;
};

const useDocumentHidden = () => {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.visibilityState === 'hidden');
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return hidden;
};

/** Banner images are private files: fetch them with the auth header and keep one object URL per file id. */
const useBannerImageUrls = (fileIds) => {
  const [urls, setUrls] = useState(/** @type {Record<string, string | null>} */ ({}));
  const requested = useRef(new Set());
  const created = useRef(/** @type {string[]} */ ([]));
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      created.current.forEach((url) => URL.revokeObjectURL(url));
      created.current = [];
    };
  }, []);

  useEffect(() => {
    fileIds.filter(Boolean).forEach((id) => {
      if (requested.current.has(id)) return;
      requested.current.add(id);
      filesApi.getContentBlob(id)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          if (!mounted.current) {
            URL.revokeObjectURL(url);
            return;
          }
          created.current.push(url);
          setUrls((current) => ({ ...current, [id]: url }));
        })
        .catch(() => {
          if (mounted.current) setUrls((current) => ({ ...current, [id]: null }));
        });
    });
  }, [fileIds]);

  return urls;
};

/**
 * Rotating dashboard banners managed by the super admin.
 * Desktop images are 1920×480 (4:1), mobile images 1080×540 (2:1).
 */
export const BannerCarousel = ({ intervalMs = BANNER_INTERVAL_MS }) => {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['banners', 'active'],
    queryFn: () => bannerApi.getActive().then((response) => response.data),
    staleTime: 5 * 60_000,
  });
  const banners = useMemo(() => (Array.isArray(data) ? data.filter((item) => item?.id) : []), [data]);
  const isMobile = useMediaQuery(MOBILE_BANNER_QUERY);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const documentHidden = useDocumentHidden();
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const touchStart = useRef(/** @type {number | null} */ (null));

  const count = banners.length;
  const safeIndex = count ? index % count : 0;

  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  const go = useCallback((next) => {
    if (!count) return;
    setIndex(((next % count) + count) % count);
  }, [count]);

  const paused = hovered || focused || documentHidden || reducedMotion;
  useEffect(() => {
    if (count <= 1 || paused) return undefined;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % count), intervalMs);
    return () => window.clearTimeout(timer);
  }, [count, paused, intervalMs, safeIndex]);

  const imageKey = isMobile ? 'mobileImageId' : 'desktopImageId';
  const wantedIds = useMemo(() => {
    if (!count) return [];
    const ids = [banners[safeIndex]?.[imageKey]];
    if (count > 1) ids.push(banners[(safeIndex + 1) % count]?.[imageKey]);
    return ids.filter(Boolean);
  }, [banners, count, imageKey, safeIndex]);
  const imageUrls = useBannerImageUrls(wantedIds);

  if (!count) return null;

  const openBanner = (event, banner) => {
    const link = String(banner.linkUrl || '').trim();
    if (!link || !isAllowedBannerLink(link)) {
      event.preventDefault();
      return;
    }
    bannerApi.recordClick(banner.id).catch(() => {});
    if (!isExternalBannerLink(link)) {
      event.preventDefault();
      navigate(link);
    }
  };

  const onTouchStart = (event) => {
    touchStart.current = event.touches?.[0]?.clientX ?? null;
  };
  const onTouchEnd = (event) => {
    const start = touchStart.current;
    touchStart.current = null;
    const end = event.changedTouches?.[0]?.clientX;
    if (start === null || typeof end !== 'number') return;
    const delta = end - start;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    // RTL: swiping toward the right reveals the next slide.
    go(delta > 0 ? safeIndex + 1 : safeIndex - 1);
  };

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="بنرهای اطلاع‌رسانی"
      data-testid="banner-carousel"
      className={`group relative w-full overflow-hidden rounded-2xl bg-default-100 shadow-sm ${isMobile ? 'aspect-[2/1]' : 'aspect-[4/1]'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(/** @type {Node | null} */ (event.relatedTarget))) setFocused(false);
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {banners.map((banner, i) => {
        const active = i === safeIndex;
        const imageId = banner[imageKey];
        const url = imageUrls[imageId];
        const link = String(banner.linkUrl || '').trim();
        const hasLink = Boolean(link) && isAllowedBannerLink(link);
        const external = hasLink && isExternalBannerLink(link);
        const content = url ? (
          <img
            src={url}
            alt={banner.title}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-l from-[var(--color-brand)] to-[var(--color-brand-hover)] p-4 text-center text-base font-bold text-white sm:text-xl">
            {banner.title}
          </div>
        );
        return (
          <div
            key={banner.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} از ${count}: ${banner.title}`}
            aria-hidden={!active}
            data-active={active ? 'true' : 'false'}
            className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${active ? 'z-10 opacity-100' : 'pointer-events-none z-0 opacity-0'}`}
          >
            {hasLink ? (
              <a
                href={link}
                onClick={(event) => openBanner(event, banner)}
                tabIndex={active ? 0 : -1}
                className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                {...(external && banner.openInNewTab !== false ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                {...(external && banner.openInNewTab === false ? { rel: 'noopener noreferrer' } : {})}
              >
                {content}
              </a>
            ) : content}
          </div>
        );
      })}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="بنر قبلی"
            onClick={() => go(safeIndex - 1)}
            className="absolute right-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white opacity-0 transition hover:bg-black/55 focus-visible:opacity-100 group-hover:opacity-100 sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="بنر بعدی"
            onClick={() => go(safeIndex + 1)}
            className="absolute left-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white opacity-0 transition hover:bg-black/55 focus-visible:opacity-100 group-hover:opacity-100 sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-2 z-20 flex items-center justify-center gap-1.5">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                aria-label={`نمایش بنر ${i + 1}`}
                aria-current={i === safeIndex ? 'true' : undefined}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full shadow transition-all ${i === safeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/55 hover:bg-white/80'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default BannerCarousel;
