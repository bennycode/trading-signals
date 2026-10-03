# Workspace Conventions

## Node.js & ESM

- This project targets the latest Node.js LTS release (see `.nvmrc`)
- Use native ESM features instead of legacy workarounds
- Use `import.meta.dirname` instead of `dirname(fileURLToPath(import.meta.url))` (available since Node.js 21.2)
- Use `import.meta.filename` instead of `fileURLToPath(import.meta.url)` when a file path is needed

## Environment Variables

- One `.env` (gitignored) and one `.env.defaults` at the repository root serve every package. Scripts load them by importing their package's `src/loadEnv.ts` first.

## Commit & PR Conventions

- Use the actual package name in the scope brackets of commit/PR titles, e.g. `fix(trading-signals-docs):` not `fix(docs):`
