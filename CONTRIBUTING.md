# Contributing to SuperTunnel

Thanks for your interest in contributing! We welcome improvements across code, docs, tooling, and examples.

## Getting started
- Fork and clone the repo
- Install dependencies: `npm install`
- Build the extension: `npm run build:extension`
- Load the unpacked extension from `dist-extension/` in Chrome

## Development commands
- `npm run dev:extension` – Vite dev server for the extension
- `npm run build:extension` – build the MV3 extension bundle
- `npm run gen:icons` – generate placeholder icons (replace with real assets for release)

## Code guidelines
- Use TypeScript and meaningful names; optimize for clarity and readability
- Keep functions small with early returns and clear error handling
- Match existing formatting; avoid large unrelated diffs
- Prefer explicit, typed APIs and avoid `any`

## Commit and PR process
1. Create a feature branch
2. Keep PRs focused and describe the rationale
3. Include tests or manual verification steps where applicable
4. Link related issues and outline migration notes when needed

## Reporting issues
- Provide environment details (OS, Node, browser)
- Steps to reproduce and expected vs. actual behavior
- Logs, console output, or screenshots if helpful

## Security
If you discover a security issue, please report it privately first. We will coordinate a fix before public disclosure.

## License
By contributing, you agree your contributions are licensed under the MIT License.
