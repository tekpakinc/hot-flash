document.querySelectorAll('[data-google-auth]').forEach((button) => {
  button.addEventListener('click', async () => {
    button.disabled = true;
    const originalText = button.innerHTML;
    button.textContent = 'Opening Google...';

    const status = document.querySelector('[data-auth-status]');
    if (status) status.textContent = 'Redirecting securely to Google...';

    const redirectTo = `${window.location.origin}/dashboard.html`;
    const { error } = await hotflashSupabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      button.disabled = false;
      button.innerHTML = originalText;
      if (status) {
        status.textContent = error.message;
        status.className = 'error';
      }
    }
  });
});
