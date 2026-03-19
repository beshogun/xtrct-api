/** Writes a timestamped line to stderr. */
export function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19); // HH:MM:SS UTC
  process.stderr.write(`[${ts}] ${msg}\n`);
}
