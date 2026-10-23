import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: 0,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure",
    launchOptions: process.env.CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    } : {},
  },
  webServer: [
    {
      command: "python ../backend/tests/e2e_server.py",
      url: "http://127.0.0.1:8100/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      env: {
        API_URL: "http://127.0.0.1:8100",
        APP_ORIGIN: "http://127.0.0.1:3100",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      timeout: 60000,
    },
  ],
});
