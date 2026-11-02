const { test } = require('node:test');
const assert = require('node:assert/strict');

test('espaço de busca exato, intervalo inclusivo e tempo médio', async () => {
  const { defaults, searchSpace, estimates } = await import('../shared/model.mjs');
  const config = { ...defaults, lower: false, digits: true, minLength: 8, maxLength: 9 };
  assert.equal(searchSpace(config), 1100000000n);
  assert.deepEqual(estimates(config, 1000000), { space: '1100000000', average: 550, maximum: 1100 });
});
test('não arredonda inteiros grandes e rejeita comprimentos inválidos', async () => {
  const { defaults, searchSpace, estimates } = await import('../shared/model.mjs');
  const config = { ...defaults, lower: true, upper: true, digits: true, symbols: true, minLength: 63, maxLength: 63 };
  assert.equal(searchSpace(config), 95n ** 63n);
  for (const change of [{ minLength: 7 }, { maxLength: 64 }, { minLength: 9, maxLength: 8 }, { minLength: 8.5 }, { lower: false, digits: false }])
    assert.throws(() => searchSpace({ ...defaults, ...change }));
  assert.equal(estimates(defaults, 0).average, null);
});
test('parser de benchmark soma GPUs sem duplicar a linha agregada', async () => {
  const { parseBenchmark } = await import('../shared/model.mjs');
  assert.equal(parseBenchmark(['Speed.#1.........: 123.4 kH/s (10.00ms)', 'Speed.#2.........: 1.2 MH/s']), 1323400);
  assert.equal(parseBenchmark(['Speed.#1.........: 10.0 kH/s', 'Speed.#1.........: 20.0 kH/s', 'Speed.#*.........: 21.0 kH/s']), 21000);
  assert.equal(parseBenchmark(['No devices found.']), 0);
});
test('máscaras validam posições e escapes, sem aceitar opções como máscara', async () => {
  const { validateMask } = await import('../shared/model.mjs');
  assert.equal(validateMask('Teste?d?d?d'), 8);
  assert.equal(validateMask('abc??1234'), 8);
  assert.throws(() => validateMask('?d?x?d?d?d?d?d?d'));
  assert.throws(() => validateMask('1234567'));
  assert.throws(() => validateMask('1234567?'));
});
