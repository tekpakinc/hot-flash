const emailEl = document.querySelector('[data-confirmation-email]');
const resendButton = document.querySelector('[data-resend-confirmation]');
let countdownEl = document.querySelector('[data-resend-countdown]');
const statusEl = document.querySelector('[data-confirmation-status]');
const waitingPanel = document.querySelector('[data-waiting-panel]');
const unlockedPanel = document.querySelector('[data-unlocked-panel]');

const params = new URLSearchParams(window.location.search);
const pendingEmail = params.get('email') || sessionStorage.getItem('hotflash_pending_email') || '';
if (emailEl) emailEl.textContent = pendingEmail || 'the address you used to sign up';

function setConfirmationStatus(message, type = '') {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `small-muted ${type}`.trim();
}

function showUnlocked() {
  if (waitingPanel) waitingPanel.hidden = true;
  if (unlockedPanel) unlockedPanel.hidden = false;
  sessionStorage.removeItem('hotflash_pending_email');
  sessionStorage.removeItem('hotflash_confirmation_sent_at');
}

async function detectVerification() {
  const { data } = await hotflashSupabase.auth.getSession();
  if (data?.session?.user?.email_confirmed_at) {
    showUnlocked();
    return true;
  }
  return false;
}

let secondsLeft = 60;
const sentAt = Number(sessionStorage.getItem('hotflash_confirmation_sent_at') || Date.now());
secondsLeft = Math.max(0, 60 - Math.floor((Date.now() - sentAt) / 1000));
let countdownTimer = null;

function renderCountdown() {
  if (!resendButton) return;
  if (secondsLeft <= 0) {
    resendButton.disabled = false;
    resendButton.textContent = 'Resend confirmation email';
    countdownEl = null;
    return;
  }
  resendButton.disabled = true;
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  resendButton.innerHTML = `Resend available in <span data-resend-countdown>${minutes}:${seconds}</span>`;
  countdownEl = resendButton.querySelector('[data-resend-countdown]');
}

function startCountdown() {
  if (countdownTimer) window.clearInterval(countdownTimer);
  renderCountdown();
  countdownTimer = window.setInterval(() => {
    secondsLeft -= 1;
    renderCountdown();
    if (secondsLeft <= 0) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }, 1000);
}

startCountdown();

resendButton?.addEventListener('click', async () => {
  if (!pendingEmail) {
    setConfirmationStatus('Please return to signup and enter your email again.', 'error');
    return;
  }
  resendButton.disabled = true;
  setConfirmationStatus('Sending another confirmation email…');
  const redirectTo = new URL('signup-success.html?verified=1', window.location.href).toString();
  const { error } = await hotflashSupabase.auth.resend({
    type: 'signup',
    email: pendingEmail,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) {
    const friendly = typeof window.hotFlashFriendlyError === 'function'
      ? window.hotFlashFriendlyError(error, 'signup')
      : error.message;
    setConfirmationStatus(friendly, 'error');
    resendButton.disabled = false;
    return;
  }
  sessionStorage.setItem('hotflash_confirmation_sent_at', String(Date.now()));
  secondsLeft = 60;
  setConfirmationStatus('Confirmation email resent. Check Inbox, Spam, Junk, Promotions, and Updates.', 'success');
  startCountdown();
});

hotflashSupabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user?.email_confirmed_at) showUnlocked();
});

detectVerification();
