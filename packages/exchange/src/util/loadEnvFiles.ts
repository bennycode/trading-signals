/**
 * Load optional env files into `process.env` so entrypoints stay self-contained (a direct
 * `npx tsx <script>` works without wrapper flags). Matches `--env-file` semantics: variables
 * that already exist are never overridden, and missing files are skipped so a script runs
 * with whatever subset of files the machine has.
 */
export function loadEnvFiles(...paths: string[]): void {
  for (const path of paths) {
    try {
      process.loadEnvFile(path);
    } catch {
      // Optional file — skip when absent.
    }
  }
}
