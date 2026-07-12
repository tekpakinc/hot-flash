function hotFlashFriendlyError(error, context = 'general') {
  const raw = String(error?.message || error || '').toLowerCase();

  console.error(`[Hot Flash ${context} error]`, error);

  if (!raw) return 'Something went wrong. Please try again.';

  if (raw.includes('rate limit') || raw.includes('too many requests')) {
    return 'Too many attempts were made in a short time. Give it a minute, then try again.';
  }
  if (raw.includes('already registered') || raw.includes('user already exists') || raw.includes('email already')) {
    return 'An account already exists with that email. Try signing in instead.';
  }
  if (raw.includes('duplicate') && raw.includes('username')) {
    return 'That username is already taken. Try another one.';
  }
  if (raw.includes('duplicate key') || raw.includes('unique constraint')) {
    return context === 'profile'
      ? 'That username may already be taken. Your account was still created, so you can sign in and choose another username.'
      : 'That information is already in use. Please try a different value.';
  }
  if (raw.includes('password') && (raw.includes('short') || raw.includes('weak') || raw.includes('least'))) {
    return 'Please choose a stronger password with at least 8 characters.';
  }
  if (raw.includes('invalid email') || raw.includes('email address is invalid')) {
    return 'Please enter a valid email address.';
  }
  if (raw.includes('invalid login credentials')) {
    return 'That email and password combination did not match.';
  }
  if (raw.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (raw.includes('network') || raw.includes('failed to fetch') || raw.includes('load failed')) {
    return 'We could not reach Hot Flash right now. Check your connection and try again.';
  }
  if (raw.includes('row') || raw.includes('line') || raw.includes('constraint') || raw.includes('postgres') || raw.includes('sql')) {
    return context === 'profile'
      ? 'Your account was created, but we could not finish the profile setup. Sign in and complete your profile from My Garage.'
      : 'We hit a setup issue behind the scenes. Please try again.';
  }

  return 'Something went wrong. Please try again. If it keeps happening, let the Hot Flash team know.';
}

window.hotFlashFriendlyError = hotFlashFriendlyError;
