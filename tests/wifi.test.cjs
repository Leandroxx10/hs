const { test } = require('node:test');
const assert = require('node:assert/strict');
test('consulta Wi-Fi interpreta saída realista em português com vários pontos de acesso', async () => {
  const { parseNetworks } = await import('../electron/wifi.mjs');
  const networks = parseNetworks(`Nome da interface: Wi-Fi
SSID 1 : Minha rede: 5 GHz
    Autenticação : WPA2-Personal
    Criptografia : CCMP
    BSSID 1 : 00:11:22:33:44:55
        Sinal : 90%
        Canal : 36
    BSSID 2 : 66:77:88:99:aa:bb
        Sinal : 50%
        Canal : 6
SSID 2 :
    Authentication : WPA3-Personal
    Encryption : CCMP
    BSSID 1 : aa:bb:cc:dd:ee:ff
        Signal : 30%
        Channel : 1`);
  assert.equal(networks.length, 2);
  assert.equal(networks[0].ssid, 'Minha rede: 5 GHz');
  assert.equal(networks[0].authentication, 'WPA2-Personal');
  assert.equal(networks[0].accessPoints.length, 2);
  assert.equal(networks[0].accessPoints[0].signal, 90);
  assert.equal(networks[0].accessPoints[1].channel, 6);
  assert.equal(networks[1].ssid, '');
  assert.equal(networks[1].authentication, 'WPA3-Personal');
  assert.deepEqual(parseNetworks('Não há interfaces sem fio no sistema.'), []);
});
test('scanner não finge encontrar redes fora do Windows', { skip: process.platform === 'win32' }, async () => {
  const { scanNetworks } = await import('../electron/wifi.mjs');
  await assert.rejects(() => scanNetworks(), /exige o Windows/);
});
