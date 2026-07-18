(() => {
  const form = document.getElementById('feedbackForm');
  if (!form || !window.hotflashSupabase) return;

  const locked = document.getElementById('lockedPanel');
  const historyPanel = document.getElementById('historyPanel');
  const status = document.getElementById('accessStatus');
  const message = document.getElementById('formMessage');
  const captured = document.getElementById('capturedDetails');
  let session = null;

  const deviceInfo = () => ({
    page_url: new URLSearchParams(location.search).get('from') || document.referrer || location.href,
    user_agent: navigator.userAgent,
    screen_size: `${window.innerWidth}x${window.innerHeight}`,
    platform: navigator.platform || 'unknown'
  });

  const showMessage = (text, type = '') => {
    message.textContent = text;
    message.className = type ? `bf-${type}` : '';
  };

  document.querySelectorAll('[data-type]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-type]').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      document.getElementById('feedbackType').value = button.dataset.type;
    });
  });

  async function hasAccess(userId) {
    const { data, error } = await hotflashSupabase
      .from('beta_testers')
      .select('user_id,is_active,is_admin')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    if (error) console.warn('[Beta access]', error);
    return Boolean(data);
  }

  async function uploadScreenshot(userId) {
    const file = document.getElementById('screenshot').files[0];
    if (!file) return null;
    if (file.size > 8 * 1024 * 1024) throw new Error('Screenshot must be smaller than 8 MB.');
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_');
    const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await hotflashSupabase.storage.from('beta-feedback').upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  }

  async function loadHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = '<div class="bf-empty">Loading reports…</div>';
    const { data, error } = await hotflashSupabase
      .from('beta_feedback')
      .select('id,title,category,severity,status,admin_response,created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (error) {
      list.innerHTML = '<div class="bf-empty">Could not load reports.</div>';
      return;
    }
    if (!data?.length) {
      list.innerHTML = '<div class="bf-empty">No reports yet.</div>';
      return;
    }
    list.innerHTML = data.map(item => `
      <article class="bf-report">
        <div class="bf-report-head"><strong>${escapeHtml(item.title)}</strong><span class="bf-badge">${escapeHtml(item.status)}</span></div>
        <p>${escapeHtml(item.category)} · ${escapeHtml(item.severity)} · ${new Date(item.created_at).toLocaleDateString()}</p>
        ${item.admin_response ? `<p><strong>Pit crew:</strong> ${escapeHtml(item.admin_response)}</p>` : ''}
      </article>`).join('');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('submitButton');
    button.disabled = true;
    showMessage('Sending diagnostic report…');
    try {
      const screenshotPath = await uploadScreenshot(session.user.id);
      const info = deviceInfo();
      const payload = {
        user_id: session.user.id,
        category: document.getElementById('feedbackType').value,
        severity: document.getElementById('severity').value,
        title: document.getElementById('title').value.trim(),
        description: document.getElementById('description').value.trim(),
        reproduction_steps: document.getElementById('steps').value.trim() || null,
        screenshot_path: screenshotPath,
        ...info
      };
      const { error } = await hotflashSupabase.from('beta_feedback').insert(payload);
      if (error) throw error;
      form.reset();
      document.getElementById('feedbackType').value = 'bug';
      document.querySelectorAll('[data-type]').forEach((item, i) => item.classList.toggle('active', i === 0));
      showMessage('Report received. Thank you!', 'success');
      await loadHistory();
    } catch (error) {
      console.error(error);
      showMessage(error.message || 'Could not send the report.', 'error');
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById('refreshHistory').addEventListener('click', loadHistory);

  async function init() {
    captured.textContent = `${deviceInfo().screen_size} · ${navigator.platform || 'device'} · current page included`;
    session = await (window.hotFlashGetStableSession ? window.hotFlashGetStableSession() : hotflashSupabase.auth.getSession().then(r => r.data.session));
    if (!session || !(await hasAccess(session.user.id))) {
      status.textContent = 'Locked';
      locked.hidden = false;
      return;
    }
    status.textContent = 'Tester access';
    form.hidden = false;
    historyPanel.hidden = false;
    loadHistory();
  }

  init();
})();