# Workspace Conventions

## Node.js & ESM

- This project targets the latest Node.js LTS release (see `.nvmrc`)
- Use native ESM features instead of legacy workarounds
- Use `import.meta.dirname` instead of `dirname(fileURLToPath(import.meta.url))` (available since Node.js 21.2)
- Use `import.meta.filename` instead of `fileURLToPath(import.meta.url)` when a file path is needed

## Environment Variables

- One `.env.defaults` (committed) and one optional `.env` (gitignored) at the repository root serve every package. npm scripts load them with Node's `--env-file=../../.env.defaults --env-file-if-exists=../../.env` flags.
- Secrets live in the "trading-signals" 1Password vault. `.env.op` (committed) holds only `op://` references; run a script with `op run --env-file=.env.op -- npm run <script>` to inject them.

## Commit & PR Conventions

- Use the actual package name in the scope brackets of commit/PR titles, e.g. `fix(trading-signals-docs):` not `fix(docs):`
