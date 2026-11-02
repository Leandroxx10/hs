export type Config = {
  mode: string; minLength: number; maxLength: number; lower: boolean; upper: boolean; digits: boolean; symbols: boolean;
  attack: string; mask: string; hashFile: string; wordlist: string; rules: string;
  deviceIds: string; workload: number; runtime: number; temperature: number;
};
export type Job = { id: string; kind: string; status: string; config: Config; startedAt: string; finishedAt?: string;
  rate: number; progress: number | null; recovered: number; logs: string[]; canRestore?: boolean; exitCode?: number };
export type State = { settings: { executable: string }; active: Job | null; history: Job[];
  benchmark: { rate: number; measuredAt: string; executable: string } | null };
export type API = {
  state(): Promise<State>;
  choose(kind: string): Promise<string | null>;
  start(kind: string, config?: Config, id?: string): Promise<State>;
  stop(): Promise<State>;
  results(id: string): Promise<string[]>;
  exportReport(): Promise<boolean>;
  dataFolder(): Promise<void>;
  scanNetworks(): Promise<Scan>;
  subscribe(callback: (state: State) => void): () => void;
};
export type Scan = { scannedAt: string; raw: string; networks: { ssid: string; authentication: string; encryption: string; accessPoints: { bssid: string; signal: number | null; channel: number | null }[] }[] };
declare global { interface Window { hs?: API } }
