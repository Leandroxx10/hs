const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const { writeFile } = require('node:fs/promises');
let window;
let engine;
let quitting = false;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(async () => {
    const { Engine } = await import('./engine.mjs');
    const { scanNetworks } = await import('./wifi.mjs');
    engine = new Engine(path.join(app.getPath('userData'), 'audits'));
    window = new BrowserWindow({ width: 1440, height: 960, minWidth: 1050, minHeight: 760, backgroundColor: '#101215',
      title: 'HS Studio', autoHideMenuBar: true, icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    const handle = (name, fn) => ipcMain.handle(name, async (event, ...args) => {
      if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Origem inválida.');
      return fn(...args);
    });
    handle('hs:state', () => engine.state());
    handle('hs:choose', async kind => {
      const filters = { executable: [{ name: 'Hashcat', extensions: process.platform === 'win32' ? ['exe'] : ['*'] }],
        hashFile: [{ name: 'WPA Hashcat', extensions: ['22000', 'hc22000', 'txt'] }],
        wordlist: [{ name: 'Dicionário', extensions: ['txt', 'dic', 'lst'] }], rules: [{ name: 'Regras Hashcat', extensions: ['rule'] }] };
      if (!Object.hasOwn(filters, kind)) throw new Error('Tipo de arquivo inválido.');
      const result = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: filters[kind] });
      if (result.canceled) return null;
      const selected = result.filePaths[0];
      if (kind === 'executable') engine.setExecutable(selected);
      return selected;
    });
    handle('hs:start', (kind, config, id) => engine.start(kind, config, id));
    handle('hs:stop', () => engine.stop());
    handle('hs:results', id => engine.results(id));
    handle('hs:folder', () => shell.openPath(engine.root));
    handle('hs:networks', () => scanNetworks());
    handle('hs:export', async () => {
      const result = await dialog.showSaveDialog(window, { defaultPath: 'hs-studio-relatorio.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (result.canceled) return false;
      await writeFile(result.filePath, JSON.stringify(engine.report(), null, 2), { mode: 0o600 });
      return true;
    });
    engine.on('state', state => { if (!window.isDestroyed()) window.webContents.send('hs:update', state); });
    window.on('close', async event => {
      if (!engine.child || quitting) return;
      event.preventDefault();
      const result = await dialog.showMessageBox(window, { type: 'question', buttons: ['Continuar teste', 'Interromper e sair'], defaultId: 0,
        message: 'Há uma tarefa em execução.', detail: 'Ao sair, a tarefa será interrompida. A retomada depende do último checkpoint gravado pelo Hashcat.' });
      if (result.response === 1) {
        quitting = true;
        if (!engine.child) { app.quit(); return; }
        engine.once('finished', () => app.quit());
        engine.stop();
      }
    });
    await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
  app.on('window-all-closed', () => app.quit());
}
