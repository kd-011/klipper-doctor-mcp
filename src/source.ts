import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { MoonrakerClient, MoonrakerError } from './moonraker.js';

/** A problem with what the caller asked for. Its message is safe to show. */
export class InputError extends Error {}

export const MAX_BYTES = 64 * 1024 * 1024;

export interface Context {
  /** Undefined when MOONRAKER_URL is not set. A string when it is set but unusable. */
  moonraker?: MoonrakerClient | string;
  /** From KLIPPER_DOCTOR_ALLOWED_DIRS. Empty means any readable file. */
  allowedDirs: string[];
}

export interface SourceInput {
  text?: string;
  path?: string;
  moonraker?: boolean;
  config_file?: string;
}

export interface Loaded {
  text: string;
  source: 'text' | 'path' | 'moonraker';
}

export function moonrakerOrThrow(ctx: Context): MoonrakerClient {
  if (ctx.moonraker === undefined) {
    throw new InputError('Moonraker is not configured. Set the MOONRAKER_URL environment variable (for example http://printer.local:7125) in the MCP server config.');
  }
  if (typeof ctx.moonraker === 'string') throw new InputError(ctx.moonraker);
  return ctx.moonraker;
}

/** Load text from exactly one of: pasted text, a local path, or Moonraker. */
export async function load(input: SourceInput, ctx: Context, what: 'klippy.log' | 'printer.cfg'): Promise<Loaded> {
  const given = [input.text !== undefined, input.path !== undefined, input.moonraker === true].filter(Boolean).length;
  if (given !== 1) throw new InputError('Give exactly one of: text (the file contents), path (a file on this machine), or moonraker: true.');

  if (input.text !== undefined) {
    if (input.text.length > MAX_BYTES) throw new InputError('text is too large.');
    return { text: input.text, source: 'text' };
  }
  if (input.path !== undefined) return { text: await readLocal(input.path, ctx), source: 'path' };

  const client = moonrakerOrThrow(ctx);
  try {
    const text = what === 'klippy.log' ? await client.fetchKlippyLog() : await client.fetchConfig(input.config_file);
    return { text, source: 'moonraker' };
  } catch (e) {
    if (e instanceof MoonrakerError) throw new InputError(e.message);
    throw e;
  }
}

async function readLocal(path: string, ctx: Context): Promise<string> {
  const abs = resolve(path);
  let real: string;
  try {
    real = await realpath(abs);
  } catch {
    throw new InputError(`Cannot read ${path}: no such file.`);
  }
  if (ctx.allowedDirs.length > 0 && !ctx.allowedDirs.some((d) => real === d || real.startsWith(d.endsWith(sep) ? d : d + sep))) {
    throw new InputError(`Cannot read ${path}: it is outside KLIPPER_DOCTOR_ALLOWED_DIRS.`);
  }
  try {
    const st = await stat(real);
    if (!st.isFile()) throw new InputError(`Cannot read ${path}: not a regular file.`);
    if (st.size > MAX_BYTES) throw new InputError(`Cannot read ${path}: larger than ${MAX_BYTES / 1024 / 1024} MiB.`);
    return await readFile(real, 'utf8');
  } catch (e) {
    if (e instanceof InputError) throw e;
    throw new InputError(`Cannot read ${path}: ${(e as NodeJS.ErrnoException).code ?? 'read failed'}.`);
  }
}

/** Resolve allowed dirs once, following symlinks so the prefix check is on real paths. */
export async function resolveAllowedDirs(raw: string | undefined): Promise<string[]> {
  if (!raw) return [];
  const out: string[] = [];
  for (const d of raw.split(':').filter(Boolean)) {
    try {
      out.push(await realpath(resolve(d)));
    } catch {
      /* a directory that does not exist allows nothing */
    }
  }
  // Set but nothing resolved: allow nothing rather than everything.
  return out.length > 0 ? out : ['/\0none'];
}
