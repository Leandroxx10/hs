const assert = require('node:assert/strict');
const { pbkdf2Sync, createHmac } = require('node:crypto');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { once } = require('node:events');
const path = require('node:path');

(async () => {
  const { Engine } = await import('../electron/engine.mjs');
  const { defaults } = await import('../shared/model.mjs');
  const executable = process.env.HASHCAT_PATH;
  assert.ok(executable, 'Defina HASHCAT_PATH com o caminho absoluto do Hashcat real.');
  const root = mkdtempSync(path.join(tmpdir(), 'hs-real-engine-'));
  // Fixture independente: PMKID de uma rede fictícia. Nenhuma captura de terceiros.
  const password = 'Studio42';
  const ssid = Buffer.from('HS-Studio-Lab');
  const ap = Buffer.from('001122334455', 'hex');
  const station = Buffer.from('66778899aabb', 'hex');
  const pmk = pbkdf2Sync(password, ssid, 4096, 32, 'sha1');
  const pmkid = createHmac('sha1', pmk).update(Buffer.concat([Buffer.from('PMK Name'), ap, station])).digest().subarray(0, 16);
  const hashFile = path.join(root, 'lab.22000');
  const wordlist = path.join(root, 'words.txt');
  writeFileSync(hashFile, `WPA*01*${pmkid.toString('hex')}*${ap.toString('hex')}*${station.toString('hex')}*${ssid.toString('hex')}***\n`);
  writeFileSync(wordlist, 'WrongPass01\nAnotherWrong02\nStudio42\n');
  const engine = new Engine(path.join(root, 'data'));
  engine.setExecutable(executable);
  async function run(kind, config) {
    const done = once(engine, 'finished');
    engine.start(kind, config);
    const timer = setTimeout(() => engine.stop(), 180000);
    const [job] = await done;
    clearTimeout(timer);
    console.log(JSON.stringify({ kind, attack: config?.attack, status: job.status, rate: job.rate, exitCode: job.exitCode }));
    if (job.status === 'error' || job.status === 'interrupted') console.log(job.logs.join('\n'));
    return job;
  }
  const recovered = await run('audit', { ...defaults, attack: 'dictionary', hashFile, wordlist });
  assert.equal(recovered.status, 'recovered'); assert.deepEqual(engine.results(recovered.id), [password]);
  writeFileSync(wordlist, 'WrongPass01\nAnotherWrong02\n');
  assert.equal((await run('audit', { ...defaults, attack: 'dictionary', hashFile, wordlist })).status, 'exhausted');
  const masked = await run('audit', { ...defaults, attack: 'custom', mask: 'Studio?d?d', hashFile });
  assert.equal(masked.status, 'recovered'); assert.deepEqual(engine.results(masked.id), [password]);
  if (process.env.HS_VERIFY_BENCHMARK === '1') {
    const bench = await run('benchmark');
    assert.equal(bench.status, 'completed'); assert.ok(bench.rate > 0);
  }
  console.log('PASS: motor Hashcat real recuperou a senha sintética por dicionário e máscara; candidatos incorretos esgotaram a busca.');
})().catch(error => { console.error(error); process.exitCode = 1; });
