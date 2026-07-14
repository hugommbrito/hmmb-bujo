// Ponto único do settings module do backend usado pelos E2E (story 11.1).
// O webServer do Playwright e todos os seeds (`manage.py shell`) importam
// daqui para nunca divergirem: todos apontam para a branch Neon `e2e`,
// isolada da branch de dev onde o app é de fato usado.
export const DJANGO_SETTINGS_MODULE = 'config.settings.e2e'
