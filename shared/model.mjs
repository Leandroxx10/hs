export const defaults = {
  mode: 'estimate', minLength: 8, maxLength: 8,
  lower: true, upper: false, digits: true, symbols: false,
  attack: 'mask', mask: '?d?d?d?d?d?d?d?d',
  hashFile: '', wordlist: '', rules: '', deviceIds: '', workload: 2,
  runtime: 0, temperature: 85,
};

export function charsetSize(config) {
  return (config.lower ? 26 : 0) + (config.upper ? 26 : 0) +
    (config.digits ? 10 : 0) + (config.symbols ? 33 : 0);
}

export function validateRange(config) {
  if (!Number.isInteger(config.minLength) || !Number.isInteger(config.maxLength) ||
      config.minLength < 8 || config.maxLength > 63 || config.minLength > config.maxLength)
    throw new Error('Use comprimentos inteiros de 8 a 63, com mínimo menor ou igual ao máximo.');
  if (!charsetSize(config)) throw new Error('Selecione pelo menos um conjunto de caracteres.');
}

export function searchSpace(config) {
  validateRange(config);
  const alphabet = BigInt(charsetSize(config));
  let total = 0n;
  for (let length = config.minLength; length <= config.maxLength; length++) total += alphabet ** BigInt(length);
  return total;
}

export function estimates(config, rate) {
  const space = searchSpace(config);
  if (!Number.isFinite(rate) || rate <= 0) return { space: space.toString(), average: null, maximum: null };
  return { space: space.toString(), average: Number(space) / rate / 2, maximum: Number(space) / rate };
}

export function customCharset(config) {
  return (config.lower ? '?l' : '') + (config.upper ? '?u' : '') +
    (config.digits ? '?d' : '') + (config.symbols ? '?s' : '');
}

export function validateMask(mask) {
  if (typeof mask !== 'string' || mask.startsWith('-') || !/^[\x20-\x7e]+$/.test(mask)) throw new Error('Use uma máscara ASCII válida que não comece com hífen.');
  let length = 0;
  for (let i = 0; i < mask.length; i++, length++) {
    if (mask[i] === '?') {
      if (!'?ludsah'.includes(mask[++i] || '\0')) throw new Error('Máscara inválida. Use ?l, ?u, ?d, ?s, ?a, ?h ou ??.');
    }
  }
  if (length < 8 || length > 63) throw new Error('A máscara precisa gerar de 8 a 63 caracteres.');
  return length;
}

export function duration(seconds) {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  if (seconds < 1) return '< 1 segundo';
  const units = [[31557600, 'anos'], [86400, 'dias'], [3600, 'horas'], [60, 'minutos'], [1, 'segundos']];
  const [scale, label] = units.find(([scale]) => seconds >= Number(scale)) || units[4];
  const amount = seconds / Number(scale);
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, notation: amount >= 1e9 ? 'scientific' : 'standard' }).format(amount)} ${label}`;
}

export function parseBenchmark(lines) {
  const devices = new Map();
  let aggregate = null;
  for (const line of lines) {
    const match = line.match(/Speed\.#(\d+|\*)\.*:\s*([\d.]+)\s*([kMGTPE]?)H\/s/i);
    if (!match) continue;
    const power = { '': 0, k: 1, m: 2, g: 3, t: 4, p: 5, e: 6 }[match[3].toLowerCase()];
    const speed = Number(match[2]) * 1000 ** power;
    if (match[1] === '*') aggregate = speed;
    else devices.set(match[1], speed);
  }
  return aggregate ?? [...devices.values()].reduce((a, b) => a + b, 0);
}
