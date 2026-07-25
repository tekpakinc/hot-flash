const listEl = document.querySelector('[data-conversation-list]');
const threadEl = document.querySelector('[data-message-thread]');
const threadWrap = document.querySelector('[data-thread]');
const emptyEl = document.querySelector('[data-empty-thread]');
const statusEl = document.querySelector('[data-message-status]');
const newMessageForm = document.querySelector('[data-new-message-form]');
const sendMessageForm = document.querySelector('[data-send-message-form]');

let session;
let currentConversation = null;
let openingConversation = false;
let sendingMessage = false;

const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[character]));

const actions = () => window.HotFlashActions;

function friendlyError(error, fallback) {
  if (!navigator.onLine) return 'You appear to be offline. Check your connection and try again.';
  if (error?.code === '42501') return 'Your session no longer has permission to do that. Please sign in again.';
  return fallback || error?.message || 'Something went wrong. Please try again.';
}

function setStatus(message, type = '') {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `small-muted${type ? ` ${type}` : ''}`;
}

async function init() {
  try {
    const { data, error } = await hotflashSupabase.auth.getSession();
    if (error) throw error;
    session = data.session;

    if (!session) {
      location.href = `login.html?returnTo=${encodeURIComponent('messages.html' + location.search)}`;
      return;
    }

    await loadConversations();
    const target = new URLSearchParams(location.search).get('u');
    if (target) await startConversation(target);
  } catch (error) {
    setStatus(friendlyError(error, 'Could not load messages.'), 'error');
    listEl.innerHTML = '<p class="error">Messages could not be loaded. Please refresh and try again.</p>';
  }
}

async function loadConversations() {
  listEl.innerHTML = '<p class="small-muted">Loading conversations…</p>';

  const { data: memberships, error: membershipError } = await hotflashSupabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', session.user.id);

  if (membershipError) throw new Error(friendlyError(membershipError, 'Could not load your conversations.'));

  const ids = [...new Set((memberships || []).map((row) => row.conversation_id))];
  if (!ids.length) {
    listEl.innerHTML = '<p class="small-muted">No conversations yet.</p>';
    return;
  }

  const { data: members, error: memberError } = await hotflashSupabase
    .from('conversation_members')
    .select('conversation_id,user_id,profiles(username,display_name)')
    .in('conversation_id', ids)
    .neq('user_id', session.user.id);

  if (memberError) throw new Error(friendlyError(memberError, 'Could not load conversation members.'));

  listEl.innerHTML = '';
  (members || []).forEach((row) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'conversation-card';
    button.innerHTML = `<strong>${escapeHtml(row.profiles?.display_name || row.profiles?.username || 'Member')}</strong><span class="small-muted">@${escapeHtml(row.profiles?.username || 'member')}</span>`;
    button.addEventListener('click', () => openConversation(row.conversation_id, button));
    listEl.appendChild(button);
  });

  if (!listEl.children.length) listEl.innerHTML = '<p class="small-muted">No conversations yet.</p>';
}

async function startConversation(username) {
  if (openingConversation) return;

  const button = newMessageForm?.querySelector('button[type="submit"]');
  const cleaned = String(username || '').trim().replace(/^@/, '');
  if (!cleaned) {
    setStatus('Enter a member username first.', 'error');
    return;
  }

  openingConversation = true;
  actions()?.begin(button, 'Finding…');
  if (button) button.disabled = true;
  setStatus('Finding member…');

  try {
    const { data: person, error: profileError } = await hotflashSupabase
      .from('profiles')
      .select('id,username')
      .ilike('username', cleaned)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!person) throw new Error('Member not found.');
    if (person.id === session.user.id) throw new Error('That would be a very philosophical conversation.');

    const { data: conversationId, error: startError } = await hotflashSupabase
      .rpc('start_direct_conversation', { p_target_user_id: person.id });

    if (startError) throw startError;
    if (!conversationId) throw new Error('The conversation was not created.');

    setStatus('Conversation opened.', 'success');
    newMessageForm?.reset();
    actions()?.finish(button, 'Opened ✓');
    actions()?.success('Conversation ready', 'You can send a message now.');
    await loadConversations();
    await openConversation(conversationId);
  } catch (error) {
    const message = friendlyError(error, 'Could not start that conversation.');
    setStatus(message, 'error');
    actions()?.fail(button);
    actions()?.error('Conversation was not started', message);
  } finally {
    openingConversation = false;
    if (button) button.disabled = false;
  }
}

async function openConversation(id, button) {
  if (!id) return;

  currentConversation = id;
  document.querySelectorAll('.conversation-card').forEach((item) => item.classList.remove('active'));
  button?.classList.add('active');
  emptyEl.hidden = true;
  threadWrap.hidden = false;
  threadEl.innerHTML = '<p class="small-muted">Loading messages…</p>';

  try {
    await loadMessages();

    const { error: readError } = await hotflashSupabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', id)
      .neq('sender_id', session.user.id)
      .is('read_at', null);

    if (readError) console.warn('Messages loaded, but read status could not be updated.', readError);
  } catch (error) {
    threadEl.innerHTML = `<p class="error">${escapeHtml(friendlyError(error, 'Could not load this conversation.'))}</p>`;
  }
}

async function loadMessages(highlightId) {
  const { data, error } = await hotflashSupabase
    .from('messages')
    .select('*,profiles:sender_id(username,display_name)')
    .eq('conversation_id', currentConversation)
    .order('created_at');

  if (error) throw error;

  threadEl.innerHTML = (data || []).map((message) => `<div class="message-bubble ${message.sender_id === session.user.id ? 'mine' : ''}" data-message-id="${escapeHtml(message.id)}"><strong>${escapeHtml(message.profiles?.display_name || message.profiles?.username || 'Member')}</strong><div>${escapeHtml(message.body)}</div><small>${new Date(message.created_at).toLocaleString()}</small></div>`).join('') || '<p class="small-muted">No messages yet.</p>';

  const freshMessage = highlightId ? threadEl.querySelector(`[data-message-id="${CSS.escape(String(highlightId))}"]`) : null;
  actions()?.pulse(freshMessage);
  threadEl.scrollTop = threadEl.scrollHeight;
}

newMessageForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  startConversation(new FormData(event.currentTarget).get('username'));
});

sendMessageForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentConversation || sendingMessage) return;

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const body = String(new FormData(form).get('body') || '').trim();
  if (!body) return;

  sendingMessage = true;
  if (button) button.disabled = true;
  actions()?.begin(button, 'Sending…');

  try {
    const { data, error } = await hotflashSupabase
      .from('messages')
      .insert({ conversation_id: currentConversation, sender_id: session.user.id, body })
      .select('id')
      .single();

    if (error) throw error;

    form.reset();
    actions()?.finish(button, 'Sent ✓');
    actions()?.success('Message sent');
    await loadMessages(data.id);
  } catch (error) {
    const message = friendlyError(error, 'Your message was not sent. Please try again.');
    actions()?.fail(button);
    actions()?.error('Message was not sent', message);
    setStatus(message, 'error');
  } finally {
    sendingMessage = false;
    if (button) button.disabled = false;
  }
});

document.addEventListener('DOMContentLoaded', init);
