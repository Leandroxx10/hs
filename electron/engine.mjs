import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { defaults, customCharset, validateRange, validateMask, parseBenchmark } from '../shared/model.mjs';

function file(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || !existsSync(value) || !statSync(value).isFile())
    throw new Error(`${label}: selecione um arquivo existente.`);
  return value;
}

export function validateExecutable(value) {
  file(value, 'Hashcat');
  if (!/^hashcat(?:\.exe)?$/i.test(path.basename(value))) throw new Error('Selecione hashcat.exe na pasta completa do Hashcat.');
  return value;
}

export function validateConfig(input) {
  const config = { ...defaults, ...input };
  if (!['mask', 'custom', 'dictionary'].includes(config.attack)) throw new Error('Tipo de teste inválido.');
  if (config.attack === 'mask') validateRange(config);
  if (config.attack === 'custom') validateMask(config.mask);
  if (typeof config.deviceIds !== 'string' || (config.deviceIds && !/^\d+(,\d+)*$/.test(config.deviceIds)))
    throw new Error('Dispositivos: informe IDs separados por vírgulas, como 1,2.');
  for (const [name, min, max] of [['workload', 1, 4], ['runtime', 0, 86400 * 7], ['temperature', 60, 95]]) {
    if (!Number.isInteger(config[name]) || config[name] < min || config[name] > max) throw new Error(`Valor inválido: ${name}.`);
  }
  file(config.hashFile, 'Arquivo WPA');
  if (statSync(config.hashFile).size > 32 * 1024 * 1024) throw new Error('O arquivo WPA deve ter até 32 MB.');
  const content = readFileSync(config.hashFile, 'utf8').trim();
  if (!content || content.split(/\r?\n/).some(line => !/^WPA\*0[12]\*[0-9a-f]{32}\*[0-9a-f]{12}\*[0-9a-f]{12}\*[0-9a-f]{2,64}\*/i.test(line)))
    throw new Error('Arquivo incompatível. Importe hashes WPA-PBKDF2 no formato 22000 (WPA*01 ou WPA*02).');
  if (config.attack === 'dictionary') {
    file(config.wordlist, 'Dicionário');
    if (config.rules) file(config.rules, 'Regras');
  }
  return config;
}

export function buildArgs(kind, config, dir) {
  if (kind === 'benchmark') return ['-b', '-m', '22000'];
  if (kind === 'devices') return ['-I'];
  const args = ['-m', '22000', '--session', path.basename(dir), '--restore-file-path', path.join(dir, 'session.restore')];
  if (kind === 'restore') return [...args.slice(2), '--restore'];
  args.push('--status', '--status-json', '--status-timer', '1',
    '--potfile-path', path.join(dir, 'results.potfile'), '--outfile', path.join(dir, 'passwords.txt'),
    '--outfile-format', '2', '--logfile-disable', '-w', String(config.workload),
    '--hwmon-temp-abort', String(config.temperature));
  if (config.deviceIds) args.push('-d', config.deviceIds);
  if (config.runtime) args.push('--runtime', String(config.runtime));
  if (config.attack === 'dictionary') {
    args.push('-a', '0');
    if (config.rules) args.push('-r', config.rules);
    args.push(config.hashFile, config.wordlist);
  } else if (config.attack === 'custom') {
    args.push('-a', '3', config.hashFile, config.mask);
  } else {
    args.push('-a', '3', '-1', customCharset(config), '--increment', '--increment-min', String(config.minLength),
      '--increment-max', String(config.maxLength), config.hashFile, '?1'.repeat(config.maxLength));
  }
  return args;
}

export class Engine extends EventEmitter {
  constructor(root) {
    super();
    this.root = root;
    mkdirSync(root, { recursive: true });
    this.settings = { executable: '' };
    this.history = [];
    this.active = null;
    this.child = null;
    this.stopTimer = null;
    this.stopping = false;
    this.benchmark = null;
    const state = path.join(root, 'state.json');
    if (existsSync(state)) {
      try {
        const saved = JSON.parse(readFileSync(state, 'utf8'));
        this.settings = saved.settings || this.settings;
        this.benchmark = saved.benchmark || null;
        this.history = (saved.history || []).map(job => ({ ...job, status: job.status === 'running' ? 'interrupted' : job.status }));
      } catch { /* A damaged history does not prevent starting a new audit. */ }
    }
  }
  state() {
    return { settings: this.settings, benchmark: this.benchmark, active: this.active,
      history: this.history.map(job => ({ ...job, canRestore: job.kind === 'audit' && job.status !== 'running' && existsSync(path.join(this.root, job.id, 'session.restore')) })) };
  }
  persist() {
    const temp = path.join(this.root, 'state.tmp');
    writeFileSync(temp, JSON.stringify({ settings: this.settings, benchmark: this.benchmark, history: this.history }, null, 2), { mode: 0o600 });
    renameSync(temp, path.join(this.root, 'state.json'));
  }
  broadcast() { this.emit('state', this.state()); }
  setExecutable(executable) {
    if (this.child) throw new Error('Aguarde a tarefa atual antes de trocar o Hashcat.');
    validateExecutable(executable);
    this.settings.executable = executable;
    this.persist();
    this.broadcast();
    return this.state();
  }
  start(kind, input = {}, restoreId = null) {
    if (this.child) throw new Error('Já existe uma tarefa em execução.');
    if (!['benchmark', 'devices', 'audit', 'restore'].includes(kind)) throw new Error('Tarefa inválida.');
    const executable = validateExecutable(this.settings.executable);
    let job;
    let config;
    if (kind === 'restore') {
      job = this.history.find(item => item.id === restoreId && item.kind === 'audit');
      if (!job || !existsSync(path.join(this.root, job.id, 'session.restore'))) throw new Error('Não há checkpoint disponível para esta tarefa.');
      if (job.executable !== executable) throw new Error('Selecione o mesmo executável Hashcat usado nesta sessão.');
      config = job.config;
    } else {
      config = kind === 'audit' ? validateConfig(input) : {};
      job = { id: randomUUID(), kind, config, executable, startedAt: new Date().toISOString(), status: 'running', logs: [], rate: 0, progress: null, recovered: 0 };
      this.history.unshift(job);
    }
    const dir = path.join(this.root, job.id);
    mkdirSync(dir, { recursive: true });
    const args = buildArgs(kind, config, dir);
    job.status = 'running';
    job.finishedAt = null;
    job.exitCode = null;
    this.active = job;
    this.stopping = false;
    this.persist();
    const child = spawn(executable, args, { cwd: path.dirname(executable), shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    let pendingOut = '';
    let pendingErr = '';
    let lastBroadcast = 0;
    const line = value => {
      if (!value.trim()) return;
      if (value.startsWith('{')) {
        try {
          const data = JSON.parse(value);
          if (Array.isArray(data.devices)) job.rate = data.devices.reduce((sum, device) => sum + (Number(device.speed) || 0), 0);
          if (Array.isArray(data.progress) && data.progress[1] > 0) job.progress = Math.min(100, 100 * data.progress[0] / data.progress[1]);
          if (Array.isArray(data.recovered_hashes)) job.recovered = data.recovered_hashes[0];
        } catch { /* Non-status text remains available in the log. */ }
      }
      job.logs.push(value.slice(0, 16000));
      if (job.logs.length > 400) job.logs.shift();
      if (Date.now() - lastBroadcast > 150) { lastBroadcast = Date.now(); this.broadcast(); }
    };
    const consume = (chunk, stderr) => {
      let pending = (stderr ? pendingErr : pendingOut) + chunk.toString('utf8');
      const lines = pending.split(/[\r\n]+/);
      pending = lines.pop();
      lines.forEach(line);
      if (pending.length > 16000) { line(pending.slice(0, 16000)); pending = ''; }
      if (stderr) pendingErr = pending; else pendingOut = pending;
    };
    child.stdout.on('data', chunk => consume(chunk, false));
    child.stderr.on('data', chunk => consume(chunk, true));
    child.stdin.on('error', () => {});
    child.on('error', error => line(`Não foi possível iniciar o Hashcat: ${error.message}`));
    child.on('close', (code, signal) => {
      clearTimeout(this.stopTimer);
      line(pendingOut); line(pendingErr);
      job.exitCode = code;
      job.signal = signal;
      job.finishedAt = new Date().toISOString();
      if (this.stopping || signal || code === 2 || code === 3) job.status = 'interrupted';
      else if (job.kind === 'audit') job.status = code === 0 ? 'recovered' : code === 1 ? 'exhausted' : code === 4 ? 'limited' : 'error';
      else job.status = code === 0 ? 'completed' : 'error';
      if (job.kind === 'benchmark' && job.status === 'completed') {
        job.rate = parseBenchmark(job.logs);
        if (job.rate > 0) this.benchmark = { rate: job.rate, measuredAt: job.finishedAt, executable, jobId: job.id };
        else { job.status = 'error'; job.logs.push('O Hashcat terminou sem informar uma velocidade utilizável.'); }
      }
      this.child = null;
      this.active = null;
      this.persist();
      this.broadcast();
      this.emit('finished', { ...job });
    });
    this.broadcast();
    return this.state();
  }
  stop() {
    if (!this.child) return this.state();
    this.stopping = true;
    const child = this.child;
    child.stdin.write('q');
    this.stopTimer = setTimeout(() => { if (this.child === child) child.kill(); }, 1500);
    return this.state();
  }
  results(id) {
    const job = this.history.find(item => item.id === id && item.kind === 'audit');
    if (!job) throw new Error('Tarefa não encontrada.');
    const output = path.join(this.root, job.id, 'passwords.txt');
    if (!existsSync(output)) return [];
    if (statSync(output).size > 1024 * 1024) throw new Error('Resultado maior que 1 MB. Abra a pasta de dados para inspecioná-lo.');
    return readFileSync(output, 'utf8').split(/\r?\n/).filter(Boolean).map(value =>
      /^\$HEX\[[0-9a-f]*\]$/i.test(value) ? Buffer.from(value.slice(5, -1), 'hex').toString('utf8') : value);
  }
  report() {
    return { app: 'HS Studio', exportedAt: new Date().toISOString(), benchmark: this.benchmark,
      jobs: this.history.map(({ id, kind, startedAt, finishedAt, status, rate, progress, recovered, exitCode }) =>
        ({ id, kind, startedAt, finishedAt, status, rate, progress, recovered, exitCode })) };
  }
}
