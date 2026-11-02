// A read-only Moonraker client. This is the only place the server touches the
// network, and the only thing it can do is GET a short list of documented read
// endpoints (https://moonraker.readthedocs.io, External API). There is no
// method for POST, PUT or DELETE, and a path outside the list is refused before
// any request is made.

export class MoonrakerError extends Error {}

/** Paths (without the query) the server may request. Every one is a GET that only reads. */
export const READ_ONLY_PATHS: readonly RegExp[] = [
  /^\/server\/files\/klippy\.log$/, // Download klippy.log
  /^\/server\/files\/logs\/klippy\.log$/, // Download from the read-only "logs" root
  /^\/server\/files\/config\/.+$/, // Download a file from the "config" root
  /^\/printer\/info$/, // Klippy state and state_message
  /^\/printer\/objects\/query$/, // Status of print_stats and webhooks
];

/** The one query string allowed, on /printer/objects/query. */
const OBJECTS_QUERY = 'print_stats&webhooks';

export interface MoonrakerOptions {
  url: string;
  apiKey?: string;
  token?: string;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface PrinterStatus {
  klippy: { state?: string; state_message?: string; software_version?: string };
  print?: { state?: string; message?: string; filename?: string };
  warnings: string[];
}

const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

export class MoonrakerClient {
  private readonly base: URL;
  private readonly basePath: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;

  constructor(opts: MoonrakerOptions) {
    let u: URL;
    try {
      u = new URL(opts.url);
    } catch {
      throw new MoonrakerError('MOONRAKER_URL is not a valid URL. Use something like http://printer.local:7125');
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new MoonrakerError('MOONRAKER_URL must start with http:// or https://');
    }
    if (u.username || u.password) {
      throw new MoonrakerError('MOONRAKER_URL must not contain a username or password. Use MOONRAKER_API_KEY or MOONRAKER_TOKEN.');
    }
    u.search = '';
    u.hash = '';
    this.base = u;
    this.basePath = u.pathname.replace(/\/+$/, ''); // keeps a reverse-proxy prefix, drops the trailing slash
    this.headers = { accept: '*/*' };
    if (opts.apiKey) this.headers['x-api-key'] = opts.apiKey;
    if (opts.token) this.headers['authorization'] = `Bearer ${opts.token}`;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  }

  /** Where this client points, safe to show: scheme, host and port only. */
  get origin(): string {
    return this.base.host;
  }

  /** GET a read endpoint and return the body as text. */
  async getText(pathAndQuery: string): Promise<string> {
    const [path, query] = splitQuery(pathAndQuery);
    assertReadable(path, query);
    const url = new URL(this.base.href);
    url.pathname = this.basePath + path;
    url.search = query ? `?${query}` : '';

    // timeoutMs bounds the wait for response headers and, separately, each gap
    // between body chunks. A big klippy.log on a slow link may take far longer
    // than timeoutMs in total, so it must not bound the whole download.
    const ac = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        ac.abort();
      }, this.timeoutMs);
    };
    try {
      arm();
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'GET',
          headers: this.headers,
          redirect: 'error', // never forward the key or token to another host
          signal: ac.signal,
        });
      } catch {
        const why = timedOut ? `no answer in ${this.timeoutMs / 1000}s` : 'connection failed';
        throw new MoonrakerError(`Could not reach Moonraker at ${this.origin} (${why}). Check MOONRAKER_URL and that Moonraker is running.`);
      }
      if (!res.ok) {
        const detail = await errorDetail(res);
        const hint = res.status === 401 || res.status === 403 ? ' Set MOONRAKER_API_KEY or MOONRAKER_TOKEN.' : '';
        throw new MoonrakerError(`Moonraker answered HTTP ${res.status} for GET ${path}${detail ? `: ${detail}` : ''}.${hint}`);
      }
      try {
        return await readLimited(res, this.maxBytes, path, arm);
      } catch (e) {
        if (e instanceof MoonrakerError) throw e;
        const why = timedOut ? `no data for ${this.timeoutMs / 1000}s` : 'connection interrupted';
        throw new MoonrakerError(`Download of ${path} from ${this.origin} stopped (${why}). Try again; if the file is large, check the network link to the printer.`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async getJson(pathAndQuery: string): Promise<unknown> {
    const text = await this.getText(pathAndQuery);
    try {
      return JSON.parse(text);
    } catch {
      throw new MoonrakerError(`Moonraker returned something that is not JSON for GET ${pathAndQuery.split('?')[0]}.`);
    }
  }

  /** klippy.log: the documented top-level endpoint, then the logs root. */
  async fetchKlippyLog(): Promise<string> {
    try {
      return await this.getText('/server/files/klippy.log');
    } catch (e) {
      if (!(e instanceof MoonrakerError) || !/HTTP 404/.test(e.message)) throw e;
      return this.getText('/server/files/logs/klippy.log');
    }
  }

  /** A file from the config root, printer.cfg by default. */
  fetchConfig(file = 'printer.cfg'): Promise<string> {
    return this.getText(`/server/files/config/${encodeConfigPath(file)}`);
  }

  /** Klippy's state and message, plus the print state if Moonraker will give it. */
  async printerStatus(): Promise<PrinterStatus> {
    const info = obj(obj(await this.getJson('/printer/info'))['result']);
    const out: PrinterStatus = {
      klippy: {
        state: str(info['state']),
        state_message: str(info['state_message']),
        software_version: str(info['software_version']),
      },
      warnings: [],
    };
    try {
      const status = obj(obj(obj(await this.getJson(`/printer/objects/query?${OBJECTS_QUERY}`))['result'])['status']);
      const ps = obj(status['print_stats']);
      out.print = { state: str(ps['state']), message: str(ps['message']), filename: str(ps['filename']) };
    } catch (e) {
      out.warnings.push(`Print state not available: ${e instanceof MoonrakerError ? e.message : 'unexpected response'}`);
    }
    return out;
  }
}

function splitQuery(p: string): [string, string] {
  const i = p.indexOf('?');
  return i < 0 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)];
}

function assertReadable(path: string, query: string): void {
  const ok =
    READ_ONLY_PATHS.some((re) => re.test(path)) &&
    !hasTraversal(path) &&
    (query === '' || (path === '/printer/objects/query' && query === OBJECTS_QUERY));
  if (!ok) throw new MoonrakerError(`Refusing ${path}: this server is read-only and that path is not allowed.`);
}

function hasTraversal(path: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return true;
  }
  return decoded.split('/').some((s) => s === '..' || s === '.') || decoded.includes('\\');
}

/** Turn a user-supplied config file name into a safe relative URL path. */
export function encodeConfigPath(file: string): string {
  const parts = file.split('/');
  if (!file || file.startsWith('/') || parts.some((s) => s === '' || s === '.' || s === '..') || /[\\\0-\x1f]/.test(file)) {
    throw new MoonrakerError(`config_file must be a relative path inside Moonraker's config root, got "${file.slice(0, 80)}".`);
  }
  return parts.map(encodeURIComponent).join('/');
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.text()).slice(0, 2000);
    const j = JSON.parse(body) as unknown;
    const e = obj(obj(j)['error']);
    const msg = str(e['message']);
    return msg ? msg.slice(0, 200) : '';
  } catch {
    return '';
  }
}

async function readLimited(res: Response, max: number, path: string, onChunk: () => void): Promise<string> {
  const tooBig = () => new MoonrakerError(`${path} is larger than ${Math.round(max / 1024 / 1024)} MiB, which is more than this server will read.`);
  const len = Number(res.headers.get('content-length'));
  if (Number.isFinite(len) && len > max) throw tooBig();
  if (!res.body) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    onChunk();
    total += chunk.byteLength;
    if (total > max) throw tooBig();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
