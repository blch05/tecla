/* Mensajes de error de Supabase Auth, en castellano y con qué hacer. */

export function authMessage(raw: string | null | undefined): string {
  const m = (raw || '').toLowerCase();
  if (!m) return 'No pudimos iniciar sesión. Probá de nuevo.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('for security purposes'))
    return 'Pediste varios links seguidos. Esperá un minuto antes de pedir otro (y revisá también el spam).';
  if (m.includes('provider is not enabled') || m.includes('unsupported provider'))
    return 'El inicio con ese proveedor todavía no está activado.';
  if (m.includes('expired') || m.includes('otp_expired') || m.includes('invalid or has expired'))
    return 'El link o el código venció o ya se usó. Pedí uno nuevo.';
  if (m.includes('code verifier') || m.includes('code_verifier') || m.includes('flow state'))
    return 'Abriste el link en otro navegador o dispositivo. Pedí uno nuevo y abrilo en este mismo navegador, o usá el código del email.';
  if (m.includes('token') && m.includes('invalid')) return 'Ese código no es válido. Revisá que sea el del último email.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Por ahora no se pueden crear cuentas nuevas.';
  if (m.includes('invalid email') || m.includes('unable to validate email')) return 'Ese email no parece válido.';
  if (m.includes('redirect')) return 'La dirección de vuelta no está autorizada en Supabase (URL Configuration).';
  if (m.includes('error sending') || m.includes('smtp')) return 'No pudimos mandar el email. Probá en un rato.';
  return raw || 'No pudimos iniciar sesión. Probá de nuevo.';
}

/** Error que Supabase deja en la URL al volver (en el query o en el hash). */
export function urlAuthError(href: string): string | null {
  try {
    const u = new URL(href);
    const h = new URLSearchParams(u.hash.replace(/^#/, ''));
    const get = (k: string) => u.searchParams.get(k) || h.get(k);
    const err = get('error_description') || get('error_code') || get('error');
    return err ? err.replace(/\+/g, ' ') : null;
  } catch { return null; }
}
