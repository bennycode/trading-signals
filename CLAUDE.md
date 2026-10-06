# Workspace Conventions

## Node.js & ESM

- This project targets the latest Node.js LTS release (see `.nvmrc`)
- Use native ESM features instead of legacy workarounds
- Use `import.meta.dirname` instead of `dirname(fileURLToPath(import.meta.url))` (available since Node.js 21.2)
- Use `import.meta.filename` instead of `fileURLToPath(import.meta.url)` when a file path is needed

## Environment Variables

- `.env.op` (committed) at the repository root lists every variable the packages read: secrets as `op://` references to the "trading-signals" 1Password vault, settings as plain values. Run a script with `op run --env-file=.env.op -- npm run <script>`.
- Without 1Password, a gitignored `.env` at the root holds the same variables with real values. npm scripts load it with Node's `--env-file-if-exists=../../.env` flag.

## Commit & PR Conventions

- Use the actual package name in the scope brackets of commit/PR titles, e.g. `fix(trading-signals-docs):` not `fix(docs):`
