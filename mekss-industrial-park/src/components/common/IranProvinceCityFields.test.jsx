import React, { useState } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import IranProvinceCityFields from './IranProvinceCityFields';
import { filterPickerOptions } from '../../utils/pickerSearch';

const Harness = () => {
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  return (
    <div>
      <IranProvinceCityFields
        province={province}
        city={city}
        onProvinceChange={setProvince}
        onCityChange={setCity}
      />
      <span data-testid="province">{province}</span>
      <span data-testid="city">{city}</span>
    </div>
  );
};

const setInputValue = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const optionButtons = () => [...document.querySelectorAll('[role="option"] button')];
const clickOption = async (label) => {
  const button = optionButtons().find((node) => node.textContent.trim() === label);
  expect(button, `option ${label}`).toBeTruthy();
  await act(async () => button.click());
};

describe('IranProvinceCityFields', () => {
  let container;
  let root;

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<Harness />);
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('picks a province, then searches and taps a city of that province only', async () => {
    const cityTrigger = container.querySelector('[data-testid="city-picker"]');
    expect(cityTrigger.disabled).toBe(true);

    await act(async () => container.querySelector('[data-testid="province-picker"]').click());
    await clickOption('تهران');
    expect(container.querySelector('[data-testid="province"]').textContent).toBe('تهران');
    expect(container.querySelector('[data-testid="city"]').textContent).toBe('');
    expect(document.querySelector('[role="listbox"]')).toBeNull();

    await act(async () => container.querySelector('[data-testid="city-picker"]').click());
    const labels = optionButtons().map((node) => node.textContent.trim());
    expect(labels.length).toBeGreaterThan(10);
    expect(labels).not.toContain('کرج');

    const search = document.querySelector('input[type="search"]');
    await act(async () => setInputValue(search, 'ورام'));
    expect(optionButtons().map((node) => node.textContent.trim())).toEqual(['ورامین']);
    await clickOption('ورامین');

    expect(container.querySelector('[data-testid="city"]').textContent).toBe('ورامین');
    expect(container.querySelector('[data-testid="city-picker"]').textContent).toContain('ورامین');
  });

  it('clears the city when the province changes', async () => {
    await act(async () => container.querySelector('[data-testid="province-picker"]').click());
    await clickOption('تهران');
    await act(async () => container.querySelector('[data-testid="city-picker"]').click());
    await clickOption('تهران');
    expect(container.querySelector('[data-testid="city"]').textContent).toBe('تهران');

    await act(async () => container.querySelector('[data-testid="province-picker"]').click());
    await clickOption('اصفهان');
    expect(container.querySelector('[data-testid="province"]').textContent).toBe('اصفهان');
    expect(container.querySelector('[data-testid="city"]').textContent).toBe('');
  });

  it('stacks province above city so selection order is unambiguous', () => {
    const triggers = [...container.querySelectorAll('button[aria-haspopup="dialog"]')];
    expect(triggers.map((node) => node.dataset.testid)).toEqual(['province-picker', 'city-picker']);
  });
});

describe('filterPickerOptions', () => {
  const options = [
    { value: 'a', label: 'اسلامشهر' },
    { value: 'b', label: 'شهریار' },
    { value: 'c', label: 'تهران', keywords: ['Tehran'] },
  ];

  it('ranks prefix matches first and normalizes Arabic letters and Latin keywords', () => {
    expect(filterPickerOptions(options, 'شهر').map((o) => o.value)).toEqual(['b', 'a']);
    expect(filterPickerOptions(options, 'tehr').map((o) => o.value)).toEqual(['c']);
    expect(filterPickerOptions(options, 'اسلامشهر').map((o) => o.value)).toEqual(['a']);
    expect(filterPickerOptions(options, '').length).toBe(3);
  });
});
