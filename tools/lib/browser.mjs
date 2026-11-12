// Shared browser code for every tool that draws frames (stills, renderer, gallery, QA, tests).
// Exports:
//   findChrome() -> path                  CHROME_PATH env, else the usual Windows/Linux install paths
//   checkFreeRam(minGb = 2)               throws if the machine has less free memory than that
//   openSession() -> session              starts the static server + one Chrome (checks free memory first)
//   session.openShow(slug, { width, height }) -> page   opens kit/index.html?show=shows/<slug>&render=1,
//                                          waits for __ready (throws the page's __error message if it fails)
//   grabFrame(page, t, { type: 'jpeg'|'png', quality }) -> Buffer   draws time t and captures the stage
//   session.newPage() -> page             a blank page in the same Chrome
//   session.close()                       closes Chrome and the server
// Chrome runs with software WebGL (SwiftShader) so frames look the same on any machine.

import fs from 'node:fs';
import os from 'node:os';
import puppeteer from 'puppeteer-core';
import { startServer } from '../serve.mjs';

export const CHROME_FLAGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--mute-audio'];
const LINUX_FLAGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
const CHROME_PATHS = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];

export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const hit = CHROME_PATHS.find(p => fs.existsSync(p));
  if (!hit) throw new Error('Chrome not found. Set CHROME_PATH to chrome.exe (or google-chrome).');
  return hit;
}

export function checkFreeRam(minGb = 2) {
  const free = os.freemem() / 2 ** 30;
  if (free < minGb) throw new Error(`only ${free.toFixed(1)} GB of memory is free; browser jobs need ${minGb} GB. Close something and try again.`);
  return free;
}

export async function openSession() {
  checkFreeRam();
  const server = await startServer();
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: findChrome(), headless: true,
      args: [...CHROME_FLAGS, ...(process.platform === 'linux' ? LINUX_FLAGS : [])],
    });
  } catch (e) { await server.close(); throw e; }

  async function openShow(slug, { width = 1080, height = 1920 } = {}) {
    const page = await browser.newPage();
    const problems = [];
    page.on('pageerror', e => problems.push('page error: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(`${server.url}kit/index.html?show=shows/${encodeURIComponent(slug)}&render=1`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__ready === true || typeof window.__error === 'string', { timeout: 180000 });
    const error = await page.evaluate(() => window.__error || null);
    if (error) { await page.close(); throw new Error(`the page could not play "${slug}":\n${error}`); }
    page.problems = problems;
    return page;
  }

  return {
    url: server.url, openShow,
    newPage: () => browser.newPage(),   // a blank page (for example to lay out a contact sheet)
    async close() { await browser.close().catch(() => {}); await server.close(); },
  };
}

// Draws time t and captures the whole stage. type 'jpeg' (default, quality 92) or 'png'.
export async function grabFrame(page, t, { type = 'jpeg', quality = 92 } = {}) {
  await page.evaluate(tt => window.__renderAt(tt), t);
  const opts = { type, captureBeyondViewport: false, optimizeForSpeed: true };
  if (type === 'jpeg') opts.quality = quality;
  return Buffer.from(await page.screenshot(opts));
}
