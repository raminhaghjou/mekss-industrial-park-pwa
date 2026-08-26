import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    exclude: ['src/exploration/**', 'src/**/*.integration.test.{js,jsx}'],
    passWithNoTests: false,
    reporters: ['default'],
  },
});
