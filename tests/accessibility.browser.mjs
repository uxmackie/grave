// Automated WCAG checks for the reader home, a published page, and the editor.
// All API traffic is mocked; no authored content is changed or published.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {launchBrowser} from './browser-launch.mjs';
import {seed, initialWorkspace} from '../lib/model.ts';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const product = seed();
product.pages = product.pages.slice(0, 2);
product.home.featured = [product.pages[0].id];
const editorFixture = {
  workspace: initialWorkspace,
  revision: 1,
  products: [{id:product.id, draft:product, published:product, revision:1}],
};
const readerFixture = {
  workspace: initialWorkspace,
  revision: 1,
  products: [product],
};

const base = process.env.QUALITY_BASE_URL || 'http://127.0.0.1:5173';
const browser = await launchBrowser();
const context = await browser.newContext({viewport:{width:1280,height:900}});

async function audit(page, label) {
  await page.addScriptTag({content:axeSource});
  await page.evaluate(() => document.fonts.ready);
  const results = await page.evaluate(async () => {
    return await globalThis.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    });
  });
  const serious = results.violations.filter((item) => ['serious', 'critical'].includes(item.impact));
  if (results.violations.length) {
    console.log(`${label}: ${results.violations.length} total violation(s)`);
    for (const item of results.violations) {
      console.log(`  ${item.impact ?? 'unknown'} ${item.id}: ${item.help} (${item.nodes.length} node(s))`);
      for (const node of item.nodes.slice(0, 3)) console.log(`    ${node.target.join(' ')}`);
    }
  }
  assert.deepEqual(
    serious.map((item) => ({id:item.id, impact:item.impact, help:item.help})),
    [],
    `${label} has serious or critical accessibility violations`,
  );
  return results.violations.length;
}

try {
  const home = await context.newPage();
  await home.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: path === '/api/auth'
        ? {authenticated:false, configured:true}
        : path === '/api/workspace'
          ? readerFixture
          : path.endsWith('/versions')
            ? {versions:[]}
            : {revision:1},
    });
  });
  await home.goto(base + '/');
  await home.getByRole('heading', {name:'Find your next answer.'}).waitFor();
  await home.waitForTimeout(300);
  const homeViolations = await audit(home, 'reader home');

  const reader = await context.newPage();
  await reader.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: path === '/api/auth'
        ? {authenticated:false, configured:true}
        : path === '/api/workspace'
          ? readerFixture
          : path.endsWith('/versions')
            ? {versions:[]}
            : {revision:1},
    });
  });
  await reader.goto(base + '/grave/introduction');
  await reader.getByRole('heading', {name:'Introduction', exact:true}).waitFor();
  await reader.waitForTimeout(300);
  const readerViolations = await audit(reader, 'reader page');

  const editor = await context.newPage();
  await editor.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json: path === '/api/auth'
        ? {authenticated:true, configured:true}
        : path === '/api/workspace'
          ? editorFixture
          : {revision:2},
    });
  });
  await editor.goto(base + '/editor/grave');
  await editor.getByRole('tab', {name:'Visual', exact:true}).waitFor();
  await editor.waitForTimeout(600);
  const editorViolations = await audit(editor, 'editor');

  console.log(JSON.stringify({
    checks: ['reader home', 'published reader page', 'editor'],
    violations: {home:homeViolations, reader:readerViolations, editor:editorViolations},
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
