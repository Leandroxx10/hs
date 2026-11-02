const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('hs', {
  state: () => ipcRenderer.invoke('hs:state'),
  choose: kind => ipcRenderer.invoke('hs:choose', kind),
  start: (kind, config, id) => ipcRenderer.invoke('hs:start', kind, config, id),
  stop: () => ipcRenderer.invoke('hs:stop'),
  results: id => ipcRenderer.invoke('hs:results', id),
  exportReport: () => ipcRenderer.invoke('hs:export'),
  dataFolder: () => ipcRenderer.invoke('hs:folder'),
  scanNetworks: () => ipcRenderer.invoke('hs:networks'),
  subscribe: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('hs:update', listener);
    return () => ipcRenderer.removeListener('hs:update', listener);
  },
});
