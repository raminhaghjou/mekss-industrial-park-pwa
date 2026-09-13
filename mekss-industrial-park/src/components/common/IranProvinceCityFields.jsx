import { useDeferredValue, useMemo, useState } from 'react';
import { listIranCities, listIranProvinces, toPersistedLocation } from '../../utils/iranLocations';
import { semanticFilter } from '../../utils/semanticSearch';

const selectClass =
  'h-12 w-full rounded-xl bg-background px-3 text-sm text-foreground outline-none ring-1 ring-default-200 transition focus:ring-2 focus:ring-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-60';

const IranProvinceCityFields = ({
  province,
  city,
  onProvinceChange,
  onCityChange,
  required = true,
}) => {
  const [cityQuery, setCityQuery] = useState('');
  const deferredQuery = useDeferredValue(cityQuery);
  const provinces = listIranProvinces();
  const cities = useMemo(() => listIranCities(province), [province]);
  const filteredCities = useMemo(
    () =>
      semanticFilter(cities, deferredQuery, (item) => [item.fa, item.en]),
    [cities, deferredQuery],
  );

  const cityOptions = useMemo(() => {
    if (city && !filteredCities.some((item) => item.fa === city)) {
      return [{ fa: city, en: 'selected' }, ...filteredCities];
    }
    return filteredCities;
  }, [city, filteredCities]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground-600">استان</span>
        <select
          required={required}
          value={province}
          onChange={(event) => {
            const nextProvince = event.target.value;
            const persisted = toPersistedLocation(nextProvince, '');
            onProvinceChange(persisted.province);
            onCityChange('');
            setCityQuery('');
          }}
          className={selectClass}
        >
          <option value="">انتخاب استان</option>
          {provinces.map((item) => (
            <option key={item.en} value={item.fa}>{item.fa}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground-600">شهر</span>
        {cities.length > 12 ? (
          <input
            type="search"
            value={cityQuery}
            onChange={(event) => setCityQuery(event.target.value)}
            placeholder="جستجوی شهر..."
            disabled={!province}
            className="mb-1 h-10 w-full rounded-xl bg-slate-50 px-3 text-sm outline-none ring-1 ring-default-200 focus:ring-2 focus:ring-[var(--color-brand)] disabled:opacity-50"
          />
        ) : null}
        <select
          required={required}
          value={city}
          disabled={!province}
          onChange={(event) => {
            const persisted = toPersistedLocation(province, event.target.value);
            onCityChange(persisted.city);
          }}
          className={selectClass}
        >
          <option value="">{province ? 'انتخاب شهر' : 'ابتدا استان را انتخاب کنید'}</option>
          {cityOptions.map((item) => (
            <option key={`${item.en}-${item.fa}`} value={item.fa}>{item.fa}</option>
          ))}
        </select>
      </label>
    </div>
  );
};

export default IranProvinceCityFields;
