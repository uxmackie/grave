import {existsSync} from 'node:fs';
import {chromium} from 'playwright';

/**
 * GitHub runners use the Chromium installed by `npx playwright install`.
 * Local runs use the installed Chrome channel; QUALITY_BROWSER_PATH still wins
 * when a specific browser build is needed.
 */
export function browserOptions() {
  if (process.env.QUALITY_BROWSER_PATH) {
    return {headless: true, executablePath: process.env.QUALITY_BROWSER_PATH};
  }
  if (process.env.CI) {
    const executablePath = chromium.executablePath();
    if (existsSync(executablePath)) return {headless: true, executablePath};
  }
  return {headless: true, channel: 'chrome'};
}

export function launchBrowser() {
  return chromium.launch(browserOptions());
}
