import { appConfig } from '../../scripts/vite-app.mjs';
import { fileURLToPath } from 'node:url';
const config=appConfig('village', import.meta.url);
config.build.rollupOptions={input:{main:fileURLToPath(new URL('./index.html',import.meta.url)),friend:fileURLToPath(new URL('./friend.html',import.meta.url))}};
export default config;
