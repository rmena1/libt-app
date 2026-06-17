# Contributing

Thanks for your interest in improving libt-app.

This is a personal notes app, but contributions, forks, and experiments are welcome. Please keep changes focused, tested, and aligned with the existing architecture.

## Development

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env
```

3. Bootstrap the local database:

```bash
npm run db:bootstrap
```

4. Start the app:

```bash
npm run dev
```

## Checks

Before opening a pull request, run the relevant checks:

```bash
npm run lint
npm run test
npm run build
```

For end-to-end coverage:

```bash
npm run test:e2e
```

## Pull Requests

- Keep pull requests small and easy to review.
- Include tests when changing behavior.
- Avoid committing secrets, local database files, build output, or personal data.
- Document new setup requirements in `README.md` or `.env.example`.
