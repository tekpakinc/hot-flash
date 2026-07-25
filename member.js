const params = new URLSearchParams(location.search);
const handle = (params.get('u') || '').replace(/^@/, '');
const statusEl = document.querySelector('[data-member-status]');
const card = document.querySelector('[data-member-card]');
const followButton = document.querySelector('[data-follow-member]');

let profile;
let session;
let isFollowing = false;
let followRequestPending = false;

function setStatus(message, type = '') {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `small-muted${type ? ` ${type}` : ''}`;
}

function friendlyError(error, fallback) {
  if (!error) return fallback;
  if (!navigator.onLine) return 'You appear to be offline. Check your connection and try again.';
  if (error.code === '23505') return 'That action was already completed.';
  if (error.code === '42501') return 'Your session no longer has permission to do that. Please sign in again.';
  return fallback || error.message || 'Something went wrong. Please try again.';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function postCard(post) {
  return `<article class="social-post"><div class="social-post-head"><div class="social-avatar">${escapeHtml((profile.display_name || profile.username || 'H')[0])}</div><div><strong>${escapeHtml(profile.display_name || profile.username)}</strong><div class="small-muted">${new Date(post.created_at).toLocaleString()}</div></div></div><p class="social-post-body">${escapeHtml(post.body)}</p>${post.image_url ? `<img class="social-post-image" src="${escapeHtml(post.image_url)}" alt="Post image">` : ''}${post.vehicle_id ? `<a href="vehicle.html?hf=${encodeURIComponent(post.vehicle_id)}">Open related build</a>` : ''}</article>`;
}

async function loadGarage() {
  const { data, error } = await hotflashSupabase
    .from('vehicles')
    .select('*')
    .eq('owner_id', profile.id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(friendlyError(error, 'Could not load this member’s garage.'));

  document.querySelector('[data-member-vehicles]').textContent = data?.length || 0;
  document.querySelector('[data-member-garage]').innerHTML = (data || []).map((vehicle) => `<a class="vehicle-card" href="vehicle.html?hf=${encodeURIComponent(vehicle.hotflash_id)}"><div class="vehicle-art ${vehicle.cover_photo ? 'has-cover' : ''}" ${vehicle.cover_photo ? `style="background-image:url('${escapeHtml(vehicle.cover_photo)}')"` : ''}></div><div class="vehicle-body"><p class="eyebrow">${escapeHtml(vehicle.hotflash_id)}</p><h3>${escapeHtml(vehicle.nickname)}</h3><p>${escapeHtml([vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' '))}</p></div></a>`).join('') || '<p class="small-muted">No public vehicles yet.</p>';
}

async function loadPosts() {
  const { data, error } = await hotflashSupabase
    .from('posts')
    .select('*')
    .eq('author_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(friendlyError(error, 'Could not load this member’s posts.'));

  document.querySelector('[data-member-posts]').textContent = data?.length || 0;
  document.querySelector('[data-member-posts-list]').innerHTML = (data || []).map(postCard).join('') || '<p class="small-muted">No posts yet.</p>';
}

async function loadFollowers() {
  const { count, error: countError } = await hotflashSupabase
    .from('profile_followers')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profile.id);

  if (countError) throw new Error(friendlyError(countError, 'Could not load follower information.'));
  document.querySelector('[data-member-followers]').textContent = count || 0;

  if (!session) return;

  const { data, error } = await hotflashSupabase
    .from('profile_followers')
    .select('profile_id')
    .eq('profile_id', profile.id)
    .eq('follower_id', session.user.id)
    .maybeSingle();

  if (error) throw new Error(friendlyError(error, 'Could not check your follow status.'));
  isFollowing = Boolean(data);
  renderFollowButton();
}

function renderFollowButton() {
  if (!followButton) return;
  followButton.textContent = followRequestPending ? 'Saving…' : (isFollowing ? 'Following ✓' : 'Follow member');
  followButton.classList.toggle('following', isFollowing);
  followButton.disabled = followRequestPending;
}

async function toggleFollow() {
  if (!session) {
    location.href = `login.html?returnTo=${encodeURIComponent(location.pathname + location.search)}`;
    return;
  }
  if (followRequestPending) return;

  followRequestPending = true;
  renderFollowButton();
  setStatus(isFollowing ? 'Removing follow…' : 'Following member…');

  try {
    if (isFollowing) {
      const { error } = await hotflashSupabase
        .from('profile_followers')
        .delete()
        .eq('profile_id', profile.id)
        .eq('follower_id', session.user.id);

      if (error) throw error;
      isFollowing = false;
      setStatus('You are no longer following this member.', 'success');
    } else {
      const { error } = await hotflashSupabase
        .from('profile_followers')
        .insert({ profile_id: profile.id, follower_id: session.user.id });

      if (error && error.code !== '23505') throw error;
      isFollowing = true;

      const { error: notificationError } = await hotflashSupabase
        .from('notifications')
        .insert({
          recipient_id: profile.id,
          actor_id: session.user.id,
          type: 'profile_follow',
          message: 'started following you'
        });

      if (notificationError) console.warn('Follow succeeded, but notification creation failed.', notificationError);
      setStatus('You are now following this member.', 'success');
    }

    const { count, error: countError } = await hotflashSupabase
      .from('profile_followers')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profile.id);

    if (!countError) document.querySelector('[data-member-followers]').textContent = count || 0;
  } catch (error) {
    setStatus(friendlyError(error, 'Could not update your follow status. Please try again.'), 'error');
  } finally {
    followRequestPending = false;
    renderFollowButton();
  }
}

async function load() {
  const { data: sessionData, error: sessionError } = await hotflashSupabase.auth.getSession();
  if (sessionError) throw new Error(friendlyError(sessionError, 'Could not check your login session.'));
  session = sessionData.session;

  const id = params.get('id');
  if (!handle && !id) throw new Error('No member was specified.');

  let query = hotflashSupabase.from('profiles').select('*');
  query = handle ? query.eq('username', handle) : query.eq('id', id);
  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(friendlyError(error, 'Could not load this member.'));
  if (!data) throw new Error('Member not found.');

  profile = data;
  document.title = `${profile.display_name || profile.username} | Hot Flash`;
  document.querySelector('[data-member-avatar]').src = profile.avatar_url || 'assets/hot-flash-logo.png';
  document.querySelector('[data-member-handle]').textContent = `@${profile.username}${profile.founder_number ? ` • Founder #${String(profile.founder_number).padStart(6, '0')}` : ''}`;
  document.querySelector('[data-member-name]').textContent = profile.display_name || profile.username;

  const bio = document.querySelector('[data-member-bio]');
  bio.textContent = profile.bio || 'This member is still writing their garage story.';
  if (profile.location && profile.location_visibility !== 'private') {
    bio.insertAdjacentHTML('afterend', `<p class="small-muted">📍 ${escapeHtml(profile.location)}</p>`);
  }

  card.hidden = false;
  await Promise.all([loadGarage(), loadPosts(), loadFollowers()]);

  if (session?.user?.id === profile.id) {
    document.querySelector('[data-edit-own-profile]').hidden = false;
  } else {
    followButton.hidden = false;
    followButton.addEventListener('click', toggleFollow);
    const actions = followButton.parentElement || card;
    const messageLink = document.createElement('a');
    messageLink.className = 'secondary-button';
    messageLink.href = `messages.html?u=${encodeURIComponent(profile.username)}`;
    messageLink.textContent = 'Message';
    actions.appendChild(messageLink);
  }

  setStatus('');
}

load().catch((error) => setStatus(error.message || 'Could not load this member.', 'error'));
