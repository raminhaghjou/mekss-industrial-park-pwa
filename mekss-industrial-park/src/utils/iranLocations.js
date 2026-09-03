import { getCities, getCity, getProvince, getProvincesList, getStats } from '@code-plate/iran-cities';

const PROVINCES = getProvincesList();
const CITY_CACHE = new Map();

export const listIranProvinces = () => PROVINCES;

export const listIranCities = (provinceName) => {
  if (!provinceName) return [];
  const cached = CITY_CACHE.get(provinceName);
  if (cached) return cached;
  const cities = getCities(provinceName);
  CITY_CACHE.set(provinceName, cities);
  return cities;
};

export const isKnownIranLocation = (provinceName, cityName) => {
  if (!provinceName || !cityName) return false;
  return Boolean(getCity(cityName, provinceName));
};

export const toPersistedLocation = (provinceName, cityName) => {
  const province = getProvince(provinceName);
  const city = getCity(cityName, provinceName);
  return {
    province: (province?.fa || String(provinceName || '')).trim(),
    city: (city?.fa || String(cityName || '')).trim(),
  };
};

const fitsLength = (value) => value.length >= 2 && value.length <= 80;

export const iranLocationFitsDatabase = (provinceName, cityName) => {
  const payload = toPersistedLocation(provinceName, cityName);
  return fitsLength(payload.province) && fitsLength(payload.city) && isKnownIranLocation(payload.province, payload.city);
};

export const iranLocationStats = () => getStats();
