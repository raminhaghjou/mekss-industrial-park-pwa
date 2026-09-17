import { useEffect, useMemo, useState } from 'react';
import { Label } from '@heroui/react';
import {
  DIGIT_OPTIONS,
  IRAN_PLATE_LETTERS,
  IRAN_PLATE_REGIONS,
  TWO_DIGIT_OPTIONS,
  formatIranLicensePlate,
  parseIranLicensePlate,
} from '../../utils/iranLicensePlate';

const selectClass =
  'h-10 min-w-0 appearance-none rounded-lg border-0 bg-white/95 px-0.5 text-center text-sm font-bold text-slate-900 outline-none ring-1 ring-slate-300 focus:ring-2 focus:ring-emerald-600 disabled:opacity-50';

const emptyDigits = () => ['', '', ''];

/**
 * Iranian license-plate picker with dropdown segments.
 * Emits canonical value like `12ب34567`.
 */
export default function IranLicensePlateInput({
  label = 'شماره پلاک',
  value = '',
  onChange,
  required = false,
  disabled = false,
}) {
  const parsed = useMemo(() => parseIranLicensePlate(value), [value]);
  const [series, setSeries] = useState(parsed.series);
  const [letter, setLetter] = useState(parsed.letter);
  const [middleDigits, setMiddleDigits] = useState(() => {
    const m = parsed.middle;
    return m.length === 3 ? m.split('') : emptyDigits();
  });
  const [region, setRegion] = useState(parsed.region);

  useEffect(() => {
    setSeries(parsed.series);
    setLetter(parsed.letter);
    setMiddleDigits(parsed.middle.length === 3 ? parsed.middle.split('') : emptyDigits());
    setRegion(parsed.region);
  }, [parsed.series, parsed.letter, parsed.middle, parsed.region]);

  const emit = (nextSeries, nextLetter, nextDigits, nextRegion) => {
    const middle = nextDigits.every((d) => d !== '') ? nextDigits.join('') : '';
    onChange?.(formatIranLicensePlate({
      series: nextSeries,
      letter: nextLetter,
      middle,
      region: nextRegion,
    }));
  };

  const regionOptions = useMemo(() => {
    if (region && !IRAN_PLATE_REGIONS.some((item) => item.code === region)) {
      return [{ code: region, label: `${region} — سایر` }, ...IRAN_PLATE_REGIONS];
    }
    return IRAN_PLATE_REGIONS;
  }, [region]);

  const letterOptions = useMemo(() => {
    if (letter && !IRAN_PLATE_LETTERS.some((item) => item.value === letter)) {
      return [{ value: letter, label: letter }, ...IRAN_PLATE_LETTERS];
    }
    return IRAN_PLATE_LETTERS;
  }, [letter]);

  return (
    <div className="flex flex-col gap-1 sm:col-span-2">
      <Label className="text-xs font-medium text-foreground-600">
        {label}
        {required ? ' *' : ''}
      </Label>

      <div
        className="overflow-hidden rounded-2xl border-2 border-slate-800 bg-gradient-to-b from-slate-100 to-slate-200 shadow-sm"
        dir="ltr"
      >
        <div className="flex min-h-[4.5rem] items-stretch">
          <div className="flex w-11 shrink-0 flex-col items-center justify-center gap-0.5 bg-[#0033a0] px-1 text-white sm:w-14">
            <span className="text-[8px] font-bold leading-none sm:text-[9px]">I.R.</span>
            <span className="text-[8px] font-bold leading-none sm:text-[9px]">IRAN</span>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-center gap-1 px-2 py-2 sm:gap-1.5 sm:px-3">
            <select
              aria-label="دو رقم اول پلاک"
              className={`${selectClass} w-[3.1rem] sm:w-14`}
              disabled={disabled}
              required={required}
              value={series}
              onChange={(e) => {
                const next = e.target.value;
                setSeries(next);
                emit(next, letter, middleDigits, region);
              }}
            >
              <option value="">--</option>
              {TWO_DIGIT_OPTIONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <select
              aria-label="حرف پلاک"
              className={`${selectClass} w-11 sm:w-12`}
              disabled={disabled}
              required={required}
              value={letter}
              onChange={(e) => {
                const next = e.target.value;
                setLetter(next);
                emit(series, next, middleDigits, region);
              }}
            >
              <option value="">-</option>
              {letterOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>

            <div className="flex items-center gap-0.5">
              {[0, 1, 2].map((index) => (
                <select
                  key={index}
                  aria-label={`رقم ${index + 1} از سه رقم میانی`}
                  className={`${selectClass} w-8 sm:w-9`}
                  disabled={disabled}
                  required={required}
                  value={middleDigits[index]}
                  onChange={(e) => {
                    const nextDigits = [...middleDigits];
                    nextDigits[index] = e.target.value;
                    setMiddleDigits(nextDigits);
                    emit(series, letter, nextDigits, region);
                  }}
                >
                  <option value="">-</option>
                  {DIGIT_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              ))}
            </div>

            <div className="mx-0.5 hidden h-10 w-px bg-slate-500/70 sm:block" aria-hidden />

            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-bold leading-none text-slate-700">ایران</span>
              <select
                aria-label="کد شهر پلاک"
                className={`${selectClass} w-[8rem] text-[11px] sm:w-44 sm:text-sm`}
                disabled={disabled}
                required={required}
                value={region}
                onChange={(e) => {
                  const next = e.target.value;
                  setRegion(next);
                  emit(series, letter, middleDigits, next);
                }}
              >
                <option value="">کد شهر</option>
                {regionOptions.map((item) => (
                  <option key={item.code} value={item.code}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-foreground-500">
        مطابق پلاک واقعی انتخاب کنید: دو رقم، حرف، سه رقم میانی، سپس کد شهر (ایران).
      </p>
    </div>
  );
}
