import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appConfig } from '../../scripts/vite-app.mjs';

const config = appConfig('rinne', import.meta.url);
const appRoot = dirname(fileURLToPath(import.meta.url));
config.build = {
  ...config.build,
  rollupOptions: {
    ...(config.build?.rollupOptions || {}),
    input: {
      app: resolve(appRoot, 'index.html'),
      review: resolve(appRoot, 'review.html'),
    },
  },
};

export default config;
