import { chromium } from 'playwright-core';

const pages = [
  { url: 'http://localhost:3000', file: 'screenshot-landing.png' },
  { url: 'http://localhost:3000/login', file: 'screenshot-login.png' },
  { url: 'http://localhost:3000/signup', file: 'screenshot-signup.png' },
  { url: 'http://localhost:3000/dashboard', file: 'screenshot-dashboard.png' },
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

for (const { url, file } of pages) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  } catch {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `C:/Users/lcy08/HireMe/${file}`, fullPage: true });
  console.log(`Saved: ${file}`);
  await page.close();
}

await browser.close();
