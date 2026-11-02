import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);

export function parseNetworks(raw) {
  const networks = [];
  let network = null;
  let accessPoint = null;
  for (const line of raw.split(/\r?\n/)) {
    const ssid = line.match(/^\s*SSID\s+\d+\s*:\s?(.*)$/i);
    if (ssid) {
      network = { ssid: ssid[1].trim(), authentication: '', encryption: '', accessPoints: [] };
      networks.push(network); accessPoint = null; continue;
    }
    if (!network) continue;
    const bssid = line.match(/^\s*BSSID\s+\d+\s*:\s*([0-9a-f:]{17})/i);
    if (bssid) {
      accessPoint = { bssid: bssid[1], signal: null, channel: null };
      network.accessPoints.push(accessPoint); continue;
    }
    const field = line.match(/^\s*([^:]+?)\s*:\s*(.*?)\s*$/);
    if (!field) continue;
    const key = field[1].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (['authentication', 'autenticacao'].includes(key)) network.authentication = field[2];
    if (['encryption', 'criptografia', 'codificacao', 'cifra'].includes(key)) network.encryption = field[2];
    if (accessPoint && ['signal', 'sinal'].includes(key) && /^\d+%$/.test(field[2])) accessPoint.signal = Number(field[2].replace('%', ''));
    if (accessPoint && ['channel', 'canal'].includes(key) && /^\d+$/.test(field[2])) accessPoint.channel = Number(field[2]);
  }
  return networks;
}

export async function scanNetworks() {
  if (process.platform !== 'win32') throw new Error('A consulta de redes exige o Windows no notebook com adaptador Wi-Fi.');
  // Comando fixo, somente leitura. Nenhum nome de rede ou argumento fornecido pelo usuário.
  const command = '$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); & netsh.exe wlan show networks mode=bssid; exit $LASTEXITCODE';
  try {
    const { stdout, stderr } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command],
      { windowsHide: true, timeout: 20000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' });
    return { networks: parseNetworks(stdout), raw: stdout + (stderr ? `\n${stderr}` : ''), scannedAt: new Date().toISOString() };
  } catch (error) {
    throw new Error(`O Windows não conseguiu consultar as redes: ${String(error.stdout || error.stderr || error.message).slice(0, 3000)}`);
  }
}
