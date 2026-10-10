import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  calendarCells,
  formatJalaliDate,
  isoDateFromJalali,
  isoDateTimeFromJalali,
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  JALALI_WEEKDAY_NAMES,
  jalaliFromIsoDate,
  jalaliWeekdayIndex,
  pad2,
  partsFromIsoValue,
  shiftJalaliMonth,
  toFaDigits,
  todayIsoDate,
} from '../../utils/jalali';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);
const YEAR_SPAN = 12;

const selectClass =
  'h-10 rounded-xl bg-slate-50 px-2 text-sm text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-[var(--color-brand)]';

/**
 * Persian (Jalali) date / date-time field. Values stay Gregorian ISO strings
 * (`YYYY-MM-DD`, or full UTC ISO when `includeTime`) so APIs and filters are unchanged.
 *
 * @param {{
 *   id?: string,
 *   label?: string,
 *   value?: string,
 *   onChange: (value: string) => void,
 *   required?: boolean,
 *   includeTime?: boolean,
 *   placeholder?: string,
 *   compact?: boolean,
 *   disabled?: boolean,
 * }} props
 */
const JalaliDatePicker = ({
  id,
  label,
  value = '',
  onChange,
  required = false,
  includeTime = false,
  placeholder = 'انتخاب تاریخ',
  compact = false,
  disabled = false,
}) => {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(/** @type {'days' | 'months' | 'years'} */ ('days'));

  const selected = includeTime ? partsFromIsoValue(value) : (() => {
    const jalali = jalaliFromIsoDate(value);
    return jalali ? { ...jalali, hours: 8, minutes: 0 } : null;
  })();
  const today = jalaliFromIsoDate(todayIsoDate());
  const initialView = selected || (today ? { ...today, hours: 8, minutes: 0 } : { jy: 1404, jm: 1, jd: 1, hours: 8, minutes: 0 });
  const [view, setView] = useState({ jy: initialView.jy, jm: initialView.jm });
  const [yearPageStart, setYearPageStart] = useState(initialView.jy - Math.floor(YEAR_SPAN / 2));
  const [time, setTime] = useState({
    hours: selected?.hours ?? 8,
    minutes: selected?.minutes ?? 0,
  });

  const selectedHours = selected?.hours;
  const selectedMinutes = selected?.minutes;
  useEffect(() => {
    if (!includeTime || selectedHours === undefined || selectedMinutes === undefined) return;
    setTime((current) => (
      current.hours === selectedHours && current.minutes === selectedMinutes
        ? current
        : { hours: selectedHours, minutes: selectedMinutes }
    ));
  }, [includeTime, selectedHours, selectedMinutes]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const emitDay = (jy, jm, jd) => {
    if (includeTime) {
      onChange(isoDateTimeFromJalali(jy, jm, jd, time.hours, time.minutes));
      return;
    }
    onChange(isoDateFromJalali(jy, jm, jd));
    setOpen(false);
  };

  const openPicker = () => {
    if (disabled) return;
    setView({ jy: initialView.jy, jm: initialView.jm });
    setYearPageStart(initialView.jy - Math.floor(YEAR_SPAN / 2));
    setMode('days');
    if (selected) setTime({ hours: selected.hours, minutes: selected.minutes });
    setOpen((current) => !current);
  };

  // Date-time values are UTC ISO strings: show the local (Tehran) day and time, not the UTC date prefix.
  const display = includeTime && value && selected
    ? toFaDigits(`${selected.jy}/${pad2(selected.jm)}/${pad2(selected.jd)}  ${pad2(selected.hours)}:${pad2(selected.minutes)}`)
    : formatJalaliDate(value);

  const headline = selected
    ? `${JALALI_WEEKDAY_NAMES[jalaliWeekdayIndex(selected.jy, selected.jm, selected.jd)]} ${toFaDigits(selected.jd)} ${JALALI_MONTHS[selected.jm - 1]} ${toFaDigits(selected.jy)}`
    : 'تاریخی انتخاب نشده';

  const cells = calendarCells(view.jy, view.jm);
  const minuteOptions = MINUTES.includes(time.minutes) ? MINUTES : [...MINUTES, time.minutes].sort((a, b) => a - b);
  const years = Array.from({ length: YEAR_SPAN }, (_, index) => yearPageStart + index);

  const setTimePart = (part, nextValue) => {
    setTime((current) => {
      const next = { ...current, [part]: nextValue };
      if (selected) onChange(isoDateTimeFromJalali(selected.jy, selected.jm, selected.jd, next.hours, next.minutes));
      return next;
    });
  };

  const navButtonClass = 'flex h-9 w-9 items-center justify-center rounded-xl text-white/90 transition hover:bg-white/15';

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      {label ? (
        <label htmlFor={fieldId} className="text-xs font-medium text-foreground-600">
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </label>
      ) : null}
      <input
        id={fieldId}
        value={value || ''}
        required={required}
        tabIndex={-1}
        onChange={(event) => onChange(event.target.value)}
        className="sr-only"
        autoComplete="off"
      />
      <div className="relative">
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`flex w-full items-center gap-2.5 rounded-xl bg-background px-3 text-right text-sm ring-1 ring-default-200 transition hover:ring-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-60 ${
            compact ? 'h-10' : 'h-12'
          } ${open ? 'ring-2 ring-[var(--color-brand)]' : ''}`}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-[var(--color-brand)]" />
          <span className={`flex-1 truncate tabular-nums ${display ? 'font-medium text-foreground' : 'text-foreground-400'}`}>
            {display || placeholder}
          </span>
        </button>
        {value && !required && !disabled ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-foreground-400 transition hover:bg-default-100 hover:text-foreground-700"
            aria-label="پاک کردن تاریخ"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:hidden" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="تقویم شمسی"
            className="fixed inset-x-0 bottom-0 z-50 animate-slide-up overflow-hidden rounded-t-3xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.2)] lg:absolute lg:inset-auto lg:top-full lg:z-30 lg:mt-2 lg:w-[21rem] lg:rounded-2xl lg:pb-0 lg:shadow-2xl lg:ring-1 lg:ring-slate-200"
          >
            <div
              className="px-4 pb-3 pt-4 text-white"
              style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, color-mix(in srgb, var(--color-brand) 65%, #0f172a) 100%)', backgroundColor: 'var(--color-brand)' }}
            >
              <p className="text-[11px] font-medium text-white/70">تقویم شمسی</p>
              <p className="mt-0.5 text-base font-bold">{headline}</p>
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  className={navButtonClass}
                  onClick={() => {
                    if (mode === 'years') setYearPageStart((start) => start - YEAR_SPAN);
                    else if (mode === 'months') setView((current) => ({ ...current, jy: current.jy - 1 }));
                    else setView((current) => shiftJalaliMonth(current.jy, current.jm, -1));
                  }}
                  aria-label="قبلی"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMode((current) => (current === 'months' ? 'days' : 'months'))}
                    className={`rounded-xl px-3 py-1.5 text-sm font-bold transition hover:bg-white/15 ${mode === 'months' ? 'bg-white/20' : ''}`}
                  >
                    {JALALI_MONTHS[view.jm - 1]}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setYearPageStart(view.jy - Math.floor(YEAR_SPAN / 2));
                      setMode((current) => (current === 'years' ? 'days' : 'years'));
                    }}
                    className={`rounded-xl px-3 py-1.5 text-sm font-bold tabular-nums transition hover:bg-white/15 ${mode === 'years' ? 'bg-white/20' : ''}`}
                  >
                    {toFaDigits(view.jy)}
                  </button>
                </div>
                <button
                  type="button"
                  className={navButtonClass}
                  onClick={() => {
                    if (mode === 'years') setYearPageStart((start) => start + YEAR_SPAN);
                    else if (mode === 'months') setView((current) => ({ ...current, jy: current.jy + 1 }));
                    else setView((current) => shiftJalaliMonth(current.jy, current.jm, 1));
                  }}
                  aria-label="بعدی"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-3">
              {mode === 'months' ? (
                <div className="grid grid-cols-3 gap-2">
                  {JALALI_MONTHS.map((monthName, index) => {
                    const isCurrent = view.jm === index + 1;
                    return (
                      <button
                        key={monthName}
                        type="button"
                        onClick={() => {
                          setView((current) => ({ ...current, jm: index + 1 }));
                          setMode('days');
                        }}
                        className={`h-11 rounded-xl text-sm transition ${
                          isCurrent ? 'bg-[var(--color-brand)] font-bold text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {monthName}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {mode === 'years' ? (
                <div className="grid grid-cols-3 gap-2">
                  {years.map((year) => {
                    const isCurrent = view.jy === year;
                    const isThisYear = today?.jy === year;
                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => {
                          setView((current) => ({ ...current, jy: year }));
                          setMode('months');
                        }}
                        className={`h-11 rounded-xl text-sm tabular-nums transition ${
                          isCurrent
                            ? 'bg-[var(--color-brand)] font-bold text-white'
                            : isThisYear
                              ? 'bg-slate-50 font-semibold text-[var(--color-brand)] ring-1 ring-[var(--color-brand)]'
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {toFaDigits(year)}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {mode === 'days' ? (
                <>
                  <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold">
                    {JALALI_WEEKDAYS.map((day, index) => (
                      <span key={day} className={`py-1.5 ${index === 6 ? 'text-rose-500' : 'text-slate-400'}`}>{day}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((day, index) => {
                      if (!day) return <span key={`empty-${index}`} />;
                      const iso = isoDateFromJalali(view.jy, view.jm, day);
                      const isSelected = selected && selected.jy === view.jy && selected.jm === view.jm && selected.jd === day;
                      const isToday = today && today.jy === view.jy && today.jm === view.jm && today.jd === day;
                      const isFriday = index % 7 === 6;
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => emitDay(view.jy, view.jm, day)}
                          aria-pressed={Boolean(isSelected)}
                          aria-label={`${toFaDigits(day)} ${JALALI_MONTHS[view.jm - 1]} ${toFaDigits(view.jy)}`}
                          className={`relative h-10 rounded-xl text-sm tabular-nums transition ${
                            isSelected
                              ? 'bg-[var(--color-brand)] font-bold text-white shadow-md'
                              : isToday
                                ? 'font-bold text-[var(--color-brand)] ring-1 ring-[var(--color-brand)] hover:bg-slate-50'
                                : isFriday
                                  ? 'text-rose-500 hover:bg-rose-50'
                                  : 'text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          {toFaDigits(day)}
                          {isToday && !isSelected ? (
                            <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--color-brand)]" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {includeTime && mode === 'days' ? (
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2">
                  <label className="flex flex-col gap-1 text-xs text-slate-500">
                    ساعت
                    <select
                      className={selectClass}
                      value={time.hours}
                      onChange={(event) => setTimePart('hours', Number(event.target.value))}
                    >
                      {HOURS.map((hour) => (
                        <option key={hour} value={hour}>{toFaDigits(pad2(hour))}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-500">
                    دقیقه
                    <select
                      className={selectClass}
                      value={time.minutes}
                      onChange={(event) => setTimePart('minutes', Number(event.target.value))}
                    >
                      {minuteOptions.map((minute) => (
                        <option key={minute} value={minute}>{toFaDigits(pad2(minute))}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
                <button
                  type="button"
                  className="rounded-xl px-3 py-1.5 font-semibold text-[var(--color-brand)] hover:bg-slate-100"
                  onClick={() => {
                    if (!today) return;
                    setView({ jy: today.jy, jm: today.jm });
                    setMode('days');
                    emitDay(today.jy, today.jm, today.jd);
                  }}
                >
                  امروز
                </button>
                <div className="flex items-center gap-1">
                  {!required && value ? (
                    <button
                      type="button"
                      className="rounded-xl px-3 py-1.5 text-slate-500 hover:bg-slate-100"
                      onClick={() => {
                        onChange('');
                        setOpen(false);
                      }}
                    >
                      پاک کردن
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-xl bg-slate-900 px-4 py-1.5 font-medium text-white hover:bg-slate-700"
                    onClick={() => setOpen(false)}
                  >
                    تأیید
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default JalaliDatePicker;
