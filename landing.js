const mobileMenuButton = document.querySelector('[data-mobile-menu]');
const mobileNav = document.querySelector('[data-mobile-nav]');
const homeFeed = document.querySelector('[data-home-feed]');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  }[char]));
}

mobileMenuButton?.addEventListener('click', () => {
  const opening = mobileNav.hasAttribute('hidden');
  mobileNav.toggleAttribute('hidden', !opening);
  mobileMenuButton.setAttribute('aria-expanded', String(opening));
  mobileMenuButton.textContent = opening ? '✕' : '☰';
});

mobileNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    mobileNav.setAttribute('hidden', '');
    mobileMenuButton?.setAttribute('aria-expanded', 'false');
    if (mobileMenuButton) mobileMenuButton.textContent = '☰';
  });
});

function buildUrl(vehicle) {
  return `vehicle.html?hf=${encodeURIComponent(vehicle.hotflash_id || vehicle.id)}`;
}

function renderBuild(vehicle) {
  const profile = vehicle.owner_profile || {};
  const photo = vehicle.cover_photo || '';
  const meta = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return `
    <article class="home-build-card">
      <a class="home-build-media" href="${buildUrl(vehicle)}" ${photo ? `style="background-image:linear-gradient(0deg,rgba(5,6,7,.72),rgba(5,6,7,.04)),url('${photo}')"` : ''}>
        <span class="home-build-id">${escapeHtml(vehicle.hotflash_id || 'Hot Flash build')}</span>
      </a>
      <div class="home-build-body">
        <p class="home-build-owner">@${escapeHtml(profile.username || 'member')}</p>
        <h3>${escapeHtml(vehicle.nickname || 'Untitled build')}</h3>
        <p>${escapeHtml(meta || vehicle.engine || 'Build details coming soon')}</p>
        <a class="text-link" href="${buildUrl(vehicle)}">Open build</a>
      </div>
    </article>`;
}

async function loadHomeFeed() {
  if (!homeFeed || typeof hotflashSupabase === 'undefined') return;

  const { data, error } = await hotflashSupabase
    .from('vehicles')
    .select('*, owner_profile:profiles!vehicles_owner_id_fkey(username, display_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(6);

  if (error) {
    homeFeed.innerHTML = '<article class="home-feed-empty"><strong>The live garage is warming up.</strong><p>Browse the full discovery feed while we reconnect.</p><a class="text-link" href="feed.html">Open Discover</a></article>';
    return;
  }

  if (!data?.length) {
    homeFeed.innerHTML = '<article class="home-feed-empty"><strong>Be one of the first builds here.</strong><p>Create an account and put your ride in the live feed.</p><a class="text-link" href="signup.html">Create your garage</a></article>';
    return;
  }

  homeFeed.innerHTML = data.map(renderBuild).join('');
}

loadHomeFeed();
