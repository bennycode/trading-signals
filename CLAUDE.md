# Workspace Conventions

## Node.js & ESM

- This project targets the latest Node.js LTS release (see `.nvmrc`)
- Use native ESM features instead of legacy workarounds
- Use `import.meta.dirname` instead of `dirname(fileURLToPath(import.meta.url))` (available since Node.js 21.2)
- Use `import.meta.filename` instead of `fileURLToPath(import.meta.url)` when a file path is needed

## Environment Variables

Configuration is split into secrets and flags, in three files at the repository root:

- `.env.flags` (committed): flags and settings as plain values, e.g. `TRADING212_USE_PAPER=true`. Never secrets.
- `.env.op` (committed): secrets only, each as an `op://` reference to the "trading-signals" 1Password vault. Never plain values, since `op run` masks every output matching a resolved value.
- `.env` (gitignored, optional): real secret values for setups without 1Password, and local overrides of flags.

Scripts that need configuration preload `loadEnv.ts` with `tsx --import ../../loadEnv.ts`, and each has an `:op` variant (`op run --env-file=../../.env.op -- npm run <script>`) that resolves the secrets. The shell environment wins over `.env`, which wins over `.env.flags`.

## Commit & PR Conventions

- Use the actual package name in the scope brackets of commit/PR titles, e.g. `fix(trading-signals-docs):` not `fix(docs):`
