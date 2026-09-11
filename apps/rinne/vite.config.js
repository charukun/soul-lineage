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

if (process.env.REVIEW_LAB === '1') {
  const codespaceHost = process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `${process.env.CODESPACE_NAME}-5173.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : null;
  config.server = {
    ...(config.server || {}),
    allowedHosts: codespaceHost ? [codespaceHost, 'localhost', '127.0.0.1'] : undefined,
  };
  config.plugins = [
    ...(config.plugins || []),
    {
      name: 'review-lab-entry',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '') {
            res.statusCode = 302;
            res.setHeader('Location', '/review.html');
            res.end();
            return;
          }
          next();
        });
      },
    },
  ];
}

export default config;
