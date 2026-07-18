(() => {
  const panel = document.getElementById('adminPanel');
  if (!panel || !window.hotflashSupabase) return;
  const locked = document.getElementById('lockedPanel');
  const statusText = document.getElementById('accessStatus');
  const list = document.getElementById('adminList');
  const filter = document.getElementById('statusFilter');

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  async function isAdmin(userId) {
    const { data } = await hotflashSupabase.from('beta_testers').select('is_admin,is_active').eq('user_id', userId).eq('is_active', true).eq('is_admin', true).maybeSingle();
    return Boolean(data);
  }

  async function saveReport(id, card) {
    const status = card.querySelector('[data-field="status"]').value;
    const response = card.querySelector('[data-field="admin_response"]').value.trim() || null;
    const notes = card.querySelector('[data-field="admin_notes"]').value.trim() || null;
    const button = card.querySelector('[data-save]');
    button.disabled = true;
    button.textContent = 'Saving…';
    const { error } = await hotflashSupabase.from('beta_feedback').update({ status, admin_response: response, admin_notes: notes, updated_at: new Date().toISOString() }).eq('id', id);
    button.disabled = false;
    button.textContent = error ? 'Try again' : 'Saved';
    setTimeout(() => button.textContent = 'Save update', 1400);
  }

  async function loadReports() {
    list.innerHTML = '<div class="bf-empty">Loading reports…</div>';
    let query = hotflashSupabase.from('beta_feedback').select('*').order('created_at', { ascending: false });
    if (filter.value) query = query.eq('status', filter.value);
    const { data, error } = await query;
    if (error) { list.innerHTML = '<div class="bf-empty">Could not load feedback.</div>'; return; }
    if (!data?.length) { list.innerHTML = '<div class="bf-empty">No reports in this view.</div>'; return; }
    list.innerHTML = data.map(item => `
      <article class="bf-report" data-id="${item.id}">
        <div class="bf-report-head"><strong>${escapeHtml(item.title)}</strong><span class="bf-badge">${escapeHtml(item.severity)}</span></div>
        <p>${escapeHtml(item.category)} · ${new Date(item.created_at).toLocaleString()}</p>
        <p><strong>Page:</strong> ${escapeHtml(item.page_url || 'Unknown')}</p>
        <p>${escapeHtml(item.description)}</p>
        ${item.reproduction_steps ? `<p><strong>Steps:</strong><br>${escapeHtml(item.reproduction_steps).replace(/\n/g,'<br>')}</p>` : ''}
        <label>Status<select data-field="status">${['new','reviewing','planned','in_progress','fixed','declined'].map(s => `<option value="${s}" ${s===item.status?'selected':''}>${s.replace('_',' ')}</option>`).join('')}</select></label>
        <label>Tester-visible response<textarea data-field="admin_response" rows="3">${escapeHtml(item.admin_response || '')}</textarea></label>
        <label>Private admin notes<textarea data-field="admin_notes" rows="3">${escapeHtml(item.admin_notes || '')}</textarea></label>
        <button class="bf-primary" data-save type="button">Save update</button>
      </article>`).join('');
    list.querySelectorAll('[data-save]').forEach(button => button.addEventListener('click', () => saveReport(button.closest('[data-id]').dataset.id, button.closest('[data-id]'))));
  }

  document.getElementById('refreshAdmin').addEventListener('click', loadReports);
  filter.addEventListener('change', loadReports);

  (async () => {
    const session = await (window.hotFlashGetStableSession ? window.hotFlashGetStableSession() : hotflashSupabase.auth.getSession().then(r => r.data.session));
    if (!session || !(await isAdmin(session.user.id))) { statusText.textContent = 'Locked'; locked.hidden = false; return; }
    statusText.textContent = 'Admin access'; panel.hidden = false; loadReports();
  })();
})();