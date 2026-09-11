import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'master-character.spec.mjs',
  workers: 1,
  retries: 0,
  timeout: 180000,
  expect: { timeout: 15000 },
  outputDir: '../../../../test-results/master-character',
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'] },
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
});
