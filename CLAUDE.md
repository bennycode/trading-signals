# Workspace Conventions

## Node.js & ESM

- This project targets the latest Node.js LTS release (see `.nvmrc`)
- Use native ESM features instead of legacy workarounds
- Use `import.meta.dirname` instead of `dirname(fileURLToPath(import.meta.url))` (available since Node.js 21.2)
- Use `import.meta.filename` instead of `fileURLToPath(import.meta.url)` when a file path is needed
