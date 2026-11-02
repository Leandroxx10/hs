import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { cwd: root, stdio: 'pipe' });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try { const response = await fetch('http://127.0.0.1:4173'); if (response.ok) { ready = true; break; } } catch {}
    await delay(100);
  }
  assert.ok(ready, 'Vite preview não iniciou.');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173');
  await page.getByText('Segurança, em números.').waitFor();
  await page.getByLabel('Minúsculas', { exact: true }).uncheck();
  await page.getByLabel('Comprimento máximo', { exact: true }).fill('9');
  assert.equal(await page.getByTestId('average').textContent(), '9,2 minutos');
  await page.getByLabel('Comprimento mínimo', { exact: true }).fill('10');
  await page.getByRole('alert').filter({ hasText: 'comprimentos inteiros' }).waitFor();
  await page.getByLabel('Comprimento mínimo', { exact: true }).fill('8');
  await page.getByLabel('Comprimento máximo', { exact: true }).fill('8');
  await page.getByLabel('Minúsculas', { exact: true }).check();
  await mkdir(path.join(root, '.local', 'screenshots'), { recursive: true });
  await page.screenshot({ path: path.join(root, '.local', 'screenshots', 'overview.png'), fullPage: true });
  await page.getByRole('button', { name: 'Teste de senhas', exact: true }).click();
  await page.getByLabel('Estratégia', { exact: true }).selectOption('custom');
  await page.getByLabel('Máscara Hashcat', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Iniciar teste real' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: /Selecionar hashcat.exe/ }).click();
  await page.getByRole('alert').filter({ hasText: 'Abra o HS Studio para Windows' }).waitFor();
  await page.getByRole('button', { name: 'Fechar erro' }).click();
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await page.getByText('Seu primeiro teste começa aqui.').waitFor();
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
  await page.getByRole('button', { name: 'Redes Wi-Fi', exact: true }).click();
  await page.getByRole('button', { name: 'Listar redes visíveis', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Abra o aplicativo no Windows do notebook' }).waitFor();
  await page.getByRole('button', { name: 'Visão geral', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Layout ultrapassa a largura disponível.');
  assert.deepEqual(errors, []);
  console.log('PASS: estimativa, validações, estratégias, estado vazio, limite web/desktop e layout responsivo.');
} finally { if (browser) await browser.close(); server.kill(); }
