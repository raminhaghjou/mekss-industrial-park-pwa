import {
  IRAN_FREE_ZONES,
  IRAN_PLATE_LETTERS,
  IRAN_PLATE_TYPES,
  displayIranLicensePlate,
  parseIranFreeZonePlate,
  parseIranLicensePlate,
  plateTypeForLetter,
} from '../../utils/iranLicensePlate';

const SIZES = {
  sm: { box: 'h-8 text-[13px]', strip: 'w-5 text-[6px]', cell: 'px-1.5', region: 'w-9', regionLabel: 'text-[6px]' },
  md: { box: 'h-11 text-lg', strip: 'w-7 text-[7px]', cell: 'px-2', region: 'w-12', regionLabel: 'text-[8px]' },
};

/**
 * Read-only Iranian plate rendered like the physical plate (same look as the guard's plate input).
 * Falls back to plain text for values that are not a recognised plate.
 * @param {{ value: string, size?: 'sm' | 'md', className?: string }} props
 */
export default function IranLicensePlateBadge({ value, size = 'md', className = '' }) {
  const s = SIZES[size] || SIZES.md;
  const label = displayIranLicensePlate(value);
  const freeZone = parseIranFreeZonePlate(value);

  if (freeZone) {
    const zone = IRAN_FREE_ZONES.find((item) => item.code === freeZone.zone)?.label || freeZone.zone;
    return (
      <span
        role="img"
        aria-label={`پلاک ${label}`}
        className={`inline-flex items-center gap-2 rounded-lg border-2 border-slate-800 bg-white px-2 font-bold text-slate-900 ${s.box} ${className}`}
      >
        <span className="text-[0.7em]">{zone}</span>
        <span dir="ltr" className="tracking-widest tabular-nums">{freeZone.number}</span>
      </span>
    );
  }

  const parts = parseIranLicensePlate(value);
  if (!parts.series) {
    return <span dir="ltr" className={`font-mono font-semibold ${className}`}>{label}</span>;
  }

  const letterLabel = IRAN_PLATE_LETTERS.find((item) => item.value === parts.letter)?.label || parts.letter;
  const typeMeta = IRAN_PLATE_TYPES[plateTypeForLetter(parts.letter)] || null;
  const coloured = typeMeta && typeMeta.bg !== '#ffffff';

  return (
    <span
      role="img"
      aria-label={`پلاک ${label}`}
      dir="ltr"
      className={`inline-flex shrink-0 items-stretch overflow-hidden rounded-lg border-2 border-slate-800 font-bold tabular-nums shadow-sm ${coloured ? '' : 'bg-gradient-to-b from-white to-slate-100 text-slate-900'} ${s.box} ${className}`}
      style={coloured ? { background: typeMeta.bg, color: typeMeta.fg } : undefined}
    >
      <span className={`flex shrink-0 flex-col items-center justify-center bg-[#0033a0] font-bold leading-none text-white ${s.strip}`} aria-hidden="true">
        <span>I.R.</span>
        <span>IRAN</span>
      </span>
      <span className={`flex items-center gap-1 ${s.cell}`} aria-hidden="true">
        <span>{parts.series}</span>
        <span className="font-black">{letterLabel}</span>
        <span>{parts.middle}</span>
      </span>
      <span className={`flex flex-col items-center justify-center border-s-2 border-slate-800 leading-none ${s.region}`} aria-hidden="true">
        <span className={`font-bold ${s.regionLabel}`}>ایران</span>
        <span>{parts.region}</span>
      </span>
    </span>
  );
}
