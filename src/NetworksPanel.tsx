import { useState } from 'react';
import { Wifi, RefreshCw, Terminal, Info, Radio } from 'lucide-react';
import type { Scan } from './types';

export function NetworksPanel() {
  const [scan, setScan] = useState<Scan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  async function refresh() {
    setBusy(true); setError('');
    try {
      if (!window.hs) throw new Error('Abra o aplicativo no Windows do notebook para consultar o adaptador Wi-Fi.');
      setScan(await window.hs.scanNetworks());
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <>
    <div className="page-heading"><div className="eyebrow"><span/> ADAPTADOR DO NOTEBOOK</div><div className="heading-row"><div><h1>Redes ao seu alcance.</h1><p>Consulta real ao Windows: nome, sinal e segurança anunciada pelos pontos de acesso.</p></div><button className="button primary" disabled={busy} onClick={refresh}><RefreshCw size={16}/>{busy ? 'Consultando…' : 'Consultar redes'}</button></div></div>
    {error && <div className="alert error" role="alert"><Info size={18}/>{error}</div>}
    {!scan ? <section className="empty-state"><Wifi size={40}/><h2>Consulte o Wi-Fi deste computador.</h2><p>Os resultados são fornecidos pelo Windows. Nenhuma rede de demonstração é adicionada.</p><button className="button primary" onClick={refresh} disabled={busy}><Wifi size={16}/>{busy ? 'Consultando…' : 'Listar redes visíveis'}</button></section> : <>
      <div className="scan-summary"><span>{scan.networks.length} rede(s) · consulta em {new Date(scan.scannedAt).toLocaleTimeString('pt-BR')}</span><button className="button secondary compact" onClick={() => setShowRaw(!showRaw)}><Terminal size={14}/>{showRaw ? 'Ocultar saída' : 'Saída do Windows'}</button></div>
      {scan.networks.length === 0 && <div className="alert"><Info size={18}/>Nenhuma rede foi interpretada. Verifique se o Wi-Fi está ligado e consulte a saída do Windows; algumas versões exigem permissão de localização.</div>}
      <div className="network-grid">{scan.networks.map((network, index) => <section className="panel network-card" key={`${network.ssid}-${index}`}><div className="panel-heading"><h2><Wifi size={20}/>{network.ssid || 'SSID oculto'}</h2><span className="job-badge">{network.authentication || 'Não informado'}</span></div><div className="network-detail"><span>Criptografia anunciada</span><strong>{network.encryption || 'Não informada'}</strong></div>{network.accessPoints.map(point => <div className="access-point" key={point.bssid}><div><Radio size={16}/><code>{point.bssid}</code></div><span>{point.signal === null ? 'Sinal não informado' : `${point.signal}% de sinal`} · Canal {point.channel ?? '—'}</span></div>)}<p className="network-note">A configuração anunciada não revela a senha nem comprova sua resistência.</p></section>)}</div>
      {showRaw && <pre className="log-output">{scan.raw || 'O Windows não retornou texto.'}</pre>}
    </>}
    <section className="assumption-note"><Info size={18}/><div><strong>A mesma consulta no CMD</strong><p><code>netsh wlan show networks mode=bssid</code></p><p>O sinal indica a qualidade de recepção. Essa consulta não tenta senhas, não recupera credenciais e não produz arquivos 22000. Audite somente redes próprias ou autorizadas.</p></div></section>
  </>;
}
