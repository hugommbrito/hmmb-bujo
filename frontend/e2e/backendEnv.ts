// Ponto único do settings module do backend usado pelos E2E (story 11.1).
// O webServer do Playwright e todos os seeds (`manage.py shell`) importam
// daqui para nunca divergirem.
export const DJANGO_SETTINGS_MODULE = 'config.settings.e2e'

// Banco OFICIAL da suíte desde 2026-07-28 (docs/e2e-neon-reset.md §4b): Postgres
// LOCAL `bujo_e2e` (mesmo container docker-compose do pytest, `hmmb-test-db`) —
// substitui a branch Neon `e2e`, cujo cold-start (~2min) e latência intermitente
// (gaps de 8-20s por requisição) derrubavam a suíte inteira no fixture de signup
// (achado da story 14.9), mesmo com o backend saudável (zero erro/5xx).
//
// `??=` só aplica o default se DATABASE_URL não estiver setada no shell — quem
// quiser validar contra a branch Neon `e2e` real exporta a connection string
// dela ANTES de rodar o Playwright, sem editar nenhum arquivo.
//
// Efeito colateral proposital: todo arquivo que importa este módulo (webServer
// em playwright.config.ts + todo seed `manage.py shell` abaixo, via `env:
// { ...process.env, DJANGO_SETTINGS_MODULE }`) roda este side-effect no MESMO
// process.env que espalham — webServer e seeds nunca divergem de banco.
export const LOCAL_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/bujo_e2e'
process.env.DATABASE_URL ??= LOCAL_DATABASE_URL
