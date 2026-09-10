import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'public.spec.mjs', workers: 1, retries: 0, timeout: 45000,
  outputDir: '../../test-results', reporter: [['list']],
  use: { browserName: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'] },
    screenshot: 'on', trace: 'retain-on-failure',
  },
});
