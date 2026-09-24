import { authMessage, urlAuthError } from '@/lib/authErrors';

describe('authMessage', () => {
  it('traduce los errores comunes de Supabase', () => {
    expect(authMessage('email rate limit exceeded')).toMatch(/esperá/i);
    expect(authMessage('For security purposes, you can only request this after 42 seconds.')).toMatch(/esperá/i);
    expect(authMessage('Unsupported provider: provider is not enabled')).toMatch(/no está activado/);
    expect(authMessage('Email link is invalid or has expired')).toMatch(/venció/);
    expect(authMessage('invalid request: both auth code and code verifier should be non-empty')).toMatch(/otro navegador/);
    expect(authMessage('Token has expired or is invalid')).toMatch(/venció/);
  });
  it('sin mensaje da uno genérico, y lo desconocido pasa tal cual', () => {
    expect(authMessage('')).toMatch(/no pudimos/i);
    expect(authMessage(null)).toMatch(/no pudimos/i);
    expect(authMessage('algo raro')).toBe('algo raro');
  });
});

describe('urlAuthError', () => {
  it('lee el error del hash (flujo implícito) y del query (PKCE)', () => {
    expect(urlAuthError('https://x.app/auth#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'))
      .toBe('Email link is invalid or has expired');
    expect(urlAuthError('https://x.app/auth?error=server_error&error_description=bad')).toBe('bad');
  });
  it('sin error devuelve null (también con tokens válidos o URLs rotas)', () => {
    expect(urlAuthError('https://x.app/auth#access_token=abc&refresh_token=def')).toBeNull();
    expect(urlAuthError('https://x.app/auth?code=123')).toBeNull();
    expect(urlAuthError('no es una url')).toBeNull();
  });
});
