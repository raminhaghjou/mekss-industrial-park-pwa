import { useMemo } from 'react';
import { listIranCities, listIranProvinces, toPersistedLocation } from '../../utils/iranLocations';
import { SearchablePicker } from './SearchablePicker';

const toOption = (item) => ({ value: item.fa, label: item.fa, keywords: item.en ? [item.en] : [] });

/**
 * Province first (top), then cities of that province only.
 * Stacked layout so RTL column order cannot reverse the flow.
 * @param {{ province: string, city: string, onProvinceChange: (v: string) => void, onCityChange: (v: string) => void,
 *   required?: boolean, provinceError?: string, cityError?: string }} props
 */
const IranProvinceCityFields = ({
  province,
  city,
  onProvinceChange,
  onCityChange,
  required = true,
  provinceError,
  cityError,
}) => {
  const provinceOptions = useMemo(() => listIranProvinces().map(toOption), []);
  const cityOptions = useMemo(() => {
    const options = listIranCities(province).map(toOption);
    if (city && !options.some((option) => option.value === city)) {
      return [{ value: city, label: city, keywords: [] }, ...options];
    }
    return options;
  }, [province, city]);

  return (
    <div className="flex flex-col gap-4">
      <SearchablePicker
        label="استان"
        value={province}
        options={provinceOptions}
        required={required}
        error={provinceError}
        placeholder="انتخاب استان"
        searchPlaceholder="جستجوی استان..."
        emptyText="استانی با این نام پیدا نشد"
        testId="province-picker"
        onChange={(nextProvince) => {
          if (nextProvince === province) return;
          onProvinceChange(toPersistedLocation(nextProvince, '').province);
          onCityChange('');
        }}
      />
      <SearchablePicker
        label="شهر"
        value={city}
        options={cityOptions}
        required={required}
        error={cityError}
        disabled={!province}
        disabledText="ابتدا استان را انتخاب کنید"
        placeholder="انتخاب شهر"
        searchPlaceholder={`جستجو بین ${cityOptions.length.toLocaleString('fa-IR')} شهر...`}
        emptyText="شهری با این نام در این استان پیدا نشد"
        helper={province ? `${cityOptions.length.toLocaleString('fa-IR')} شهر در استان ${province}` : undefined}
        testId="city-picker"
        onChange={(nextCity) => onCityChange(toPersistedLocation(province, nextCity).city)}
      />
    </div>
  );
};

export default IranProvinceCityFields;
