import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowDownToLine, ArrowRight, BarChart3, Check, ChevronRight, Clock3, Cpu, FileKey2, FolderOpen, Gauge, History, Info, KeyRound, Layers, Play, RotateCcw, Settings2, ShieldCheck, Square, Terminal, Wifi, X, Zap, Eye, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { defaults, charsetSize, estimates, duration } from '../shared/model.mjs';
import type { Config, Job, State } from './types';
import './styles.css';
import { NetworksPanel } from './NetworksPanel';

const emptyState: State = { settings: { executable: '' }, active: null, history: [], benchmark: null };
const labels: Record<string, string> = { running: 'Em execução', recovered: 'Senha encontrada', exhausted: 'Busca esgotada', completed: 'Concluído', interrupted: 'Interrompido', limited: 'Limite de tempo', error: 'Falha' };
const kinds: Record<string, string> = { benchmark: 'Benchmark WPA', audit: 'Teste de senhas', devices: 'Diagnóstico de hardware' };
const number = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, notation: value >= 1e9 ? 'compact' : 'standard' }).format(value);
const speed = (value: number) => value >= 1e6 ? `${number(value / 1e6)} MH/s` : value >= 1e3 ? `${number(value / 1e3)} kH/s` : `${number(value)} H/s`;
const basename = (value: string) => value.split(/[\\/]/).pop();

function App() {
  const [page, setPage] = useState('overview');
  const [config, setConfig] = useState<Config>({ ...defaults });
  const [state, setState] = useState<State>(emptyState);
  const [manualRate, setManualRate] = useState(1000000);
  const [rateMode, setRateMode] = useState('manual');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [passwords, setPasswords] = useState<string[] | null>(null);
  const api = window.hs;
  useEffect(() => {
    if (!api) return;
    api.state().then(setState).catch(e => setError(e.message));
    return api.subscribe(setState);
  }, [api]);
  const update = <K extends keyof Config>(key: K, value: Config[K]) => setConfig(current => ({ ...current, [key]: value }));
  const act = async (callback: () => Promise<unknown>) => {
    setBusy(true); setError(''); setNotice('');
    try { await callback(); } catch (e) { setError(String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': Error: /, '')); }
    finally { setBusy(false); }
  };
  const requireDesktop = () => { if (!api) throw new Error('Abra o HS Studio para Windows para executar o Hashcat. A estimativa pode ser explorada aqui.'); return api; };
  const choose = (kind: string) => act(async () => {
    const result = await requireDesktop().choose(kind);
    if (result && kind !== 'executable') update(kind as 'hashFile' | 'wordlist' | 'rules', result);
  });
  const start = (kind: string) => act(async () => { await requireDesktop().start(kind, config); setPage('overview'); });
  const hasEngine = Boolean(state.settings.executable);
  const running = Boolean(state.active);
  const rate = rateMode === 'measured' ? state.benchmark?.rate || 0 : manualRate;
  let estimate: { space: string; average: number | null; maximum: number | null } = { space: '0', average: null, maximum: null };
  let invalid = '';
  try { estimate = estimates(config, rate); } catch (e) { invalid = (e as Error).message; }
  const lastJob = state.active || state.history[0];
  const nav = [ ['overview', Gauge, 'Visão geral'], ['networks', Wifi, 'Redes Wi-Fi'], ['audit', FileKey2, 'Teste de senhas'], ['history', History, 'Histórico'], ['settings', Settings2, 'Configurações'] ] as const;
  const rangeControls = <>
    <div className="field-row">
      <label>Comprimento mínimo<div className="number-input"><input aria-label="Comprimento mínimo" type="number" min="8" max="63" value={config.minLength} onChange={e => update('minLength', Number(e.target.value))} /><span>caracteres</span></div></label>
      <label>Comprimento máximo<div className="number-input"><input aria-label="Comprimento máximo" type="number" min="8" max="63" value={config.maxLength} onChange={e => update('maxLength', Number(e.target.value))} /><span>caracteres</span></div></label>
    </div>
    <div className="field-title">Conjunto de caracteres <span>{charsetSize(config)} possibilidades por posição</span></div>
    <div className="charset-grid">
      {([['lower', 'abc', 'Minúsculas', 'a–z'], ['upper', 'ABC', 'Maiúsculas', 'A–Z'], ['digits', '123', 'Números', '0–9'], ['symbols', '#&!', 'Símbolos', 'Inclui espaço']] as const).map(([key, sample, title, hint]) => <label className={`charset ${config[key] ? 'checked' : ''}`} key={key}>
        <input type="checkbox" checked={config[key]} onChange={e => update(key, e.target.checked)} aria-label={title} /><span className="check-box">{config[key] && <Check size={12}/>}</span>
        <strong>{sample}</strong><b>{title}</b><small>{hint}</small>
      </label>)}
    </div>
    {invalid && <div className="validation" role="alert">{invalid}</div>}
  </>;
  const filePicker = (key: 'hashFile' | 'wordlist' | 'rules', title: string, hint: string) => <div className="file-field"><label>{title}</label><button className="file-select" onClick={() => choose(key)} disabled={busy || running}><FolderOpen size={18}/><span>{config[key] ? basename(config[key]) : hint}<small>{config[key] || 'Selecionar arquivo local'}</small></span><ChevronRight size={16}/></button>{key === 'rules' && config.rules && <button className="text-button" onClick={() => update('rules', '')}>Remover regras</button>}</div>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-symbol"><Layers size={25}/></span><div>HS Studio<span>WIRELESS SECURITY</span></div></div>
      <div className="workspace-label">WORKSPACE <span>LOCAL</span></div>
      <nav>{nav.map(([id, Icon, title]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); setPasswords(null); }}><Icon size={18}/>{title}{page === id && <span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-note"><ShieldCheck size={20}/><strong>Conheça a resistência<br/>da sua senha.</strong><p>Meça o hardware. Compare cenários. Tome decisões melhores.</p></div>
      <div className="sidebar-bottom"><span className={`status-dot ${hasEngine ? 'green' : ''}`}/><div>{hasEngine ? 'Hashcat configurado' : 'Motor não configurado'}<small>HS Studio · v1.0.0</small></div><Cpu size={17}/></div>
    </aside>
    <main>
      <header className="topbar"><div>Workspace <ChevronRight size={13}/><span>{nav.find(item => item[0] === page)?.[2]}</span></div><span className="environment-badge"><span className="status-dot green"/>{api ? 'Ambiente local' : 'Interface web · estimativas'}</span></header>
      <div className="page">
        {error && <div className="alert error" role="alert"><Info size={18}/><span>{error}</span><button aria-label="Fechar erro" onClick={() => setError('')}><X size={16}/></button></div>}
        {notice && <div className="alert" role="status"><CheckCircle2 size={18}/>{notice}</div>}
        {page === 'overview' && <>
          <div className="page-heading"><div className="eyebrow"><span/> AUDITORIA DE SENHAS</div><div className="heading-row"><div><h1>Segurança, em números.</h1><p>Descubra como o comprimento e os caracteres mudam o tempo de busca.</p></div><button className="button secondary" onClick={() => setPage('settings')}><SlidersHorizontal size={16}/> Configurar motor</button></div></div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label"><Layers size={16}/> Combinações possíveis</div><strong data-testid="space">{invalid ? '—' : number(Number(estimate.space))}</strong><span>{config.minLength === config.maxLength ? `${config.maxLength} caracteres` : `${config.minLength} a ${config.maxLength} caracteres`} · {charsetSize(config)} símbolos no conjunto</span></div>
            <div className="stat-card"><div className="stat-label"><Zap size={16}/> Velocidade de referência <span className="tiny-badge">{rateMode === 'measured' && state.benchmark ? 'MEDIDA' : 'HIPÓTESE'}</span></div><strong>{speed(rate)}</strong><span>{rateMode === 'measured' ? 'Benchmark local · WPA-PBKDF2' : 'Valor informado para simular um cenário'}</span></div>
            <div className="stat-card accent"><div className="stat-label"><Clock3 size={16}/> Tempo médio estimado</div><strong data-testid="average">{duration(estimate.average)}</strong><span>Busca uniforme · metade das combinações</span><div className="stat-glow"/></div>
          </div>
          <div className="overview-grid">
            <section className="panel config-panel"><div className="panel-heading"><div><h2><SlidersHorizontal size={18}/> Defina o cenário</h2><p>Escolha as características da senha que deseja avaliar.</p></div><span className="step-number">01</span></div>{rangeControls}<div className="separator"/><div className="field-title">Velocidade usada no cálculo</div><div className="segmented"><button className={rateMode === 'manual' ? 'selected' : ''} onClick={() => setRateMode('manual')}>Cenário hipotético</button><button className={rateMode === 'measured' ? 'selected' : ''} disabled={!state.benchmark} onClick={() => setRateMode('measured')}>Meu benchmark</button></div>{rateMode === 'manual' ? <label className="rate-input">Tentativas por segundo<div className="number-input"><input aria-label="Tentativas por segundo" type="number" min="1" max="1000000000000000" value={manualRate} onChange={e => setManualRate(Math.max(0, Number(e.target.value)))}/><span>H/s</span></div></label> : <div className="measured-info"><CheckCircle2 size={18}/><div>{speed(state.benchmark!.rate)}<small>Medido em {new Date(state.benchmark!.measuredAt).toLocaleString('pt-BR')}</small></div></div>}<div className="inline-note"><Info size={15}/><span>A estimativa muda automaticamente. Nenhuma tentativa é enviada à rede.</span></div></section>
            <div className="right-column"><section className="panel resistance-panel"><div className="panel-heading"><div><h2><BarChart3 size={18}/> O efeito do comprimento</h2><p>Mesmo conjunto, mais possibilidades.</p></div></div><div className="comparison-chart">{[8, 10, 12, 16].map(length => { const seconds = charsetSize(config) > 0 && rate > 0 ? charsetSize(config) ** length / rate / 2 : null; return <div className="chart-row" key={length}><div><span>{length} caracteres</span><b>{duration(seconds)}</b></div><div className="chart-track"><span style={{ width: `${Math.max(4, length / 16 * 100)}%` }}/></div></div>; })}</div><div className="chart-caption">Escala visual de comprimento · valores mostram o tempo médio.</div><div className="maximum"><span>Para percorrer todo o cenário escolhido</span><strong>{duration(estimate.maximum)}</strong></div></section><section className="benchmark-card"><div className="benchmark-icon"><Cpu size={23}/></div><div><h3>Qual é a velocidade do seu PC?</h3><p>Execute um benchmark real de WPA/WPA2. Nenhum arquivo da rede é necessário.</p></div><button className="button primary" disabled={busy || running} onClick={() => hasEngine ? start('benchmark') : setPage('settings')}><Play size={15}/>{hasEngine ? 'Medir com Hashcat' : 'Conectar o Hashcat'}<ArrowRight size={16}/></button></section></div>
          </div>
          <section className="assumption-note"><Info size={18}/><div><strong>Uma estimativa depende das hipóteses.</strong><p>O cálculo supõe uma senha aleatória dentro do conjunto escolhido. Palavras, padrões e senhas reutilizadas podem ser descobertos muito antes. O benchmark representa este hardware; outro equipamento pode ter outra velocidade. WPA3-SAE não usa este modelo.</p></div></section>
          {lastJob && <JobPanel job={lastJob} onStop={() => act(async () => { await requireDesktop().stop(); })} onOpen={() => setSelectedJob(lastJob)}/>}
        </>}
        {page === 'networks' && <NetworksPanel/>}
        {page === 'audit' && <>
          <div className="page-heading"><div className="eyebrow"><span/> HASHCAT · MODO 22000</div><h1>Teste de senhas.</h1><p>Verifique candidatos contra um arquivo WPA/WPA2 da sua rede.</p></div>
          <div className="audit-grid"><section className="panel"><div className="panel-heading"><h2><FileKey2 size={18}/> Arquivo e estratégia</h2></div>{filePicker('hashFile', 'Arquivo de autenticação', 'Selecionar .22000 ou .hc22000')}<label className="select-label">Estratégia<select aria-label="Estratégia" value={config.attack} onChange={e => update('attack', e.target.value)}><option value="mask">Combinações por comprimento</option><option value="custom">Máscara personalizada</option><option value="dictionary">Dicionário de senhas</option></select></label>{config.attack === 'mask' && rangeControls}{config.attack === 'custom' && <label className="select-label">Máscara Hashcat<input aria-label="Máscara Hashcat" className="plain-input mono" value={config.mask} onChange={e => update('mask', e.target.value)}/><small>?l minúsculas · ?u maiúsculas · ?d números · ?s símbolos · ?a todos · ?? literal ?</small></label>}{config.attack === 'dictionary' && <>{filePicker('wordlist', 'Dicionário', 'Selecionar arquivo de palavras')}{filePicker('rules', 'Regras (opcional)', 'Selecionar .rule')}</>}<button className="button primary full" disabled={!hasEngine || busy || running || !config.hashFile} onClick={() => start('audit')}><Play size={16}/>Iniciar teste real</button>{!hasEngine && <button className="text-button" onClick={() => setPage('settings')}>Configure o Hashcat para iniciar <ArrowRight size={14}/></button>}</section>
          <div className="right-column"><section className="panel"><div className="panel-heading"><h2><Cpu size={18}/> Execução</h2></div><label className="select-label">Carga de trabalho<select value={config.workload} onChange={e => update('workload', Number(e.target.value))}><option value="1">Baixa · uso paralelo do PC</option><option value="2">Padrão · equilibrada</option><option value="3">Alta · pode reduzir a resposta da tela</option><option value="4">Máxima · máquina dedicada</option></select></label><label className="select-label">IDs dos dispositivos<input className="plain-input" placeholder="Automático ou, por exemplo, 1,2" value={config.deviceIds} onChange={e => update('deviceIds', e.target.value)}/></label><div className="field-row"><label>Limite de tempo (s)<input className="plain-input" type="number" min="0" max="604800" value={config.runtime} onChange={e => update('runtime', Number(e.target.value))}/><small>0 = sem limite</small></label><label>Limite térmico (°C)<input className="plain-input" type="number" min="60" max="95" value={config.temperature} onChange={e => update('temperature', Number(e.target.value))}/><small>Quando suportado pelo driver</small></label></div></section><section className="panel help-panel"><ShieldCheck size={24}/><h3>O que este teste verifica?</h3><p>O Hashcat calcula cada candidato e compara o resultado com os dados do arquivo. Uma correspondência confirma uma senha para aquele registro.</p><p>A busca esgotada só significa que nenhuma combinação desse cenário correspondeu. Ela não comprova que a rede inteira é segura.</p></section></div></div>
        </>}
        {page === 'history' && <>
          <div className="page-heading"><div className="eyebrow"><span/> REGISTROS LOCAIS</div><div className="heading-row"><div><h1>Histórico de testes.</h1><p>Resultados, diagnósticos e checkpoints da sua máquina.</p></div><button className="button secondary" disabled={!state.history.length} onClick={() => act(async () => { if (await requireDesktop().exportReport()) setNotice('Relatório salvo. Senhas e logs não são incluídos.'); })}><ArrowDownToLine size={16}/>Exportar relatório</button></div></div>
          {state.history.length === 0 ? <section className="empty-state"><History size={40}/><h2>Seu primeiro teste começa aqui.</h2><p>Execute um benchmark para medir a capacidade real do seu hardware.</p><button className="button primary" onClick={() => setPage('overview')}>Ir para visão geral<ArrowRight size={16}/></button></section> : <section className="panel history-list">{state.history.map(job => <div className="history-row" key={job.id}><div className="history-icon">{job.kind === 'audit' ? <KeyRound size={19}/> : <Cpu size={19}/>}</div><div className="history-description"><strong>{kinds[job.kind]}</strong><small>{new Date(job.startedAt).toLocaleString('pt-BR')}{job.config.hashFile ? ` · ${basename(job.config.hashFile)}` : ''}</small></div><span className={`job-badge ${job.status}`}>{labels[job.status]}</span>{job.canRestore && <button className="button secondary compact" disabled={running || busy} onClick={() => act(async () => { await requireDesktop().start('restore', undefined, job.id); })}><RotateCcw size={14}/>Retomar</button>}<button className="icon-button" aria-label="Ver detalhes" onClick={() => setSelectedJob(job)}><ChevronRight size={18}/></button></div>)}</section>}
        </>}
        {page === 'settings' && <>
          <div className="page-heading"><div className="eyebrow"><span/> WINDOWS · EXECUÇÃO LOCAL</div><h1>Prepare seu motor.</h1><p>Conecte a distribuição oficial do Hashcat e verifique os dispositivos disponíveis.</p></div>
          <div className="audit-grid"><section className="panel"><div className="panel-heading"><h2><Cpu size={18}/> Hashcat</h2><span className={`job-badge ${hasEngine ? 'completed' : ''}`}>{hasEngine ? 'Configurado' : 'Pendente'}</span></div><p className="body-copy">Extraia o pacote oficial completo do Hashcat em uma pasta do Windows. Mantenha o executável junto das pastas <code>modules</code> e <code>OpenCL</code>.</p><div className="setup-steps"><div><span>1</span><p>Baixe o Hashcat em <strong>hashcat.net/hashcat</strong> e extraia o arquivo.</p></div><div><span>2</span><p>Instale o driver de GPU do fabricante, com suporte a CUDA ou OpenCL.</p></div><div><span>3</span><p>Selecione <strong>hashcat.exe</strong> abaixo e execute o diagnóstico.</p></div></div><button className="file-select" disabled={busy || running} onClick={() => choose('executable')}><FolderOpen size={20}/><span>{hasEngine ? basename(state.settings.executable) : 'Selecionar hashcat.exe'}<small>{state.settings.executable || 'Escolha o executável na pasta extraída'}</small></span><ChevronRight size={16}/></button><div className="button-row"><button className="button secondary" disabled={!hasEngine || busy || running} onClick={() => start('devices')}><Cpu size={16}/>Verificar dispositivos</button><button className="button primary" disabled={!hasEngine || busy || running} onClick={() => start('benchmark')}><Play size={16}/>Executar benchmark</button></div></section><div className="right-column"><section className="panel help-panel"><FolderOpen size={23}/><h3>Seus dados ficam neste computador.</h3><p>O aplicativo guarda configurações, histórico e resultados no perfil local do Windows. Os resultados de recuperação podem conter senhas em texto simples.</p><button className="button secondary" onClick={() => act(async () => { await requireDesktop().dataFolder(); })}>Abrir pasta de dados<ArrowRight size={16}/></button></section><section className="panel help-panel"><Wifi size={23}/><h3>Compatibilidade</h3><p>Windows 10/11 de 64 bits. Benchmark e testes de WPA/WPA2-PBKDF2, modo 22000. O desempenho depende do hardware e dos drivers.</p><p>O pacote do HS Studio não inclui o motor Hashcat nem os drivers da GPU.</p></section></div></div>
        </>}
        <footer><span><ShieldCheck size={14}/> Auditoria local · Redes próprias ou autorizadas</span><span>HS STUDIO <span className="footer-dot">/</span> WPA SECURITY WORKSPACE</span></footer>
      </div>
    </main>
    {selectedJob && <div className="modal-backdrop" onClick={() => { setSelectedJob(null); setPasswords(null); }}><section className="modal" role="dialog" aria-modal="true" aria-label="Detalhes da tarefa" onClick={e => e.stopPropagation()}><div className="panel-heading"><div><h2>{kinds[selectedJob.kind]}</h2><p>{labels[state.history.find(j => j.id === selectedJob.id)?.status || selectedJob.status]}</p></div><button className="icon-button" aria-label="Fechar detalhes" onClick={() => { setSelectedJob(null); setPasswords(null); }}><X size={20}/></button></div><pre className="log-output">{(state.history.find(j => j.id === selectedJob.id)?.logs || selectedJob.logs).join('\n') || 'Aguardando saída do Hashcat…'}</pre>{selectedJob.kind === 'audit' && <><button className="button secondary" onClick={() => act(async () => setPasswords(await requireDesktop().results(selectedJob.id)))}><Eye size={16}/>Exibir senhas recuperadas</button>{passwords && <pre className="password-output">{passwords.length ? passwords.join('\n') : 'Nenhuma senha recuperada nesta sessão.'}</pre>}</>}</section></div>}
  </div>;
}

function JobPanel({ job, onStop, onOpen }: { job: Job; onStop(): void; onOpen(): void }) {
  return <section className="panel job-panel"><div className="job-summary"><span className={`live-icon ${job.status === 'running' ? 'pulsing' : ''}`}><Activity size={19}/></span><div><h3>{kinds[job.kind]}</h3><p>{labels[job.status]}{job.rate > 0 ? ` · ${speed(job.rate)}` : ''}{job.recovered > 0 ? ` · ${job.recovered} recuperada(s)` : ''}</p></div><div className="job-actions">{job.status === 'running' && <button className="button secondary compact" onClick={onStop}><Square size={13}/>Interromper</button>}<button className="button secondary compact" onClick={onOpen}><Terminal size={15}/>Ver logs</button></div></div>{job.progress !== null && <div className="progress-track"><span style={{ width: `${job.progress}%` }}/></div>}<p className="latest-log">{job.logs.filter(line => !line.startsWith('{')).slice(-1)[0] || 'Aguardando o motor…'}</p></section>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
