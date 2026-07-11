const stream = document.querySelector('[data-feed-stream]');
const count = document.querySelector('[data-feed-count]');
const searchInput = document.querySelector('[data-feed-search]');
const filterButtons = [...document.querySelectorAll('[data-feed-filter]')];
const featuredWrap = document.querySelector('[data-featured-wrap]');
const featuredCard = document.querySelector('[data-featured-card]');

let vehicles = [];
let activeFilter = 'all';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char]));
}

function vehicleUrl(vehicle) {
  return `vehicle.html?hf=${encodeURIComponent(vehicle.hotflash_id || vehicle.id)}`;
}

function ownerName(vehicle) {
  return vehicle.owner?.display_name || vehicle.owner?.username || 'Hot Flash member';
}

function card(vehicle, featured = false) {
  const photo = vehicle.cover_photo || '';
  const title = escapeHtml(vehicle.nickname || 'Untitled build');
  const meta = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return `
    <article class="feed-card ${featured ? 'featured-feed-card' : ''}">
      <a class="feed-card-media" href="${vehicleUrl(vehicle)}" ${photo ? `style="background-image:linear-gradient(0deg,rgba(7,8,10,.72),rgba(7,8,10,.05)),url('${photo}')"` : ''}>
        <span class="feed-hf-id">${escapeHtml(vehicle.hotflash_id || 'Hot Flash build')}</span>
      </a>
      <div class="feed-card-body">
        <div>
          <p class="feed-owner">@${escapeHtml(vehicle.owner?.username || 'member')}</p>
          <h3>${title}</h3>
          <p>${escapeHtml(meta || vehicle.engine || 'Build details coming soon')}</p>
        </div>
        <a class="feed-open" href="${vehicleUrl(vehicle)}">Open build</a>
      </div>
    </article>`;
}

function filteredVehicles() {
  const query = searchInput?.value.trim().toLowerCase() || '';
  let result = [...vehicles];
  if (activeFilter === 'newest') result.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  if (activeFilter === 'classics') result = result.filter(v => Number(v.year) && Number(v.year) < 1990);
  if (activeFilter === 'modern') result = result.filter(v => Number(v.year) >= 1990);
  if (activeFilter === 'shops') result = [];
  if (query) {
    result = result.filter(v => [v.nickname,v.make,v.model,v.engine,v.hotflash_id,v.owner?.username,v.owner?.display_name]
      .filter(Boolean).join(' ').toLowerCase().includes(query));
  }
  return result;
}

function render() {
  const result = filteredVehicles();
  if (count) count.textContent = `${result.length} build${result.length === 1 ? '' : 's'}`;
  if (!result.length) {
    stream.innerHTML = `<article class="feed-empty"><strong>${activeFilter === 'shops' ? 'Shop discovery is coming next.' : 'No builds match that search yet.'}</strong><p>Try another filter, or add a vehicle and become the content.</p></article>`;
    featuredWrap.hidden = true;
    return;
  }
  featuredWrap.hidden = false;
  featuredCard.innerHTML = card(result[0], true);
  stream.innerHTML = result.map(v => card(v)).join('');
}

filterButtons.forEach(button => button.addEventListener('click', () => {
  activeFilter = button.dataset.feedFilter;
  filterButtons.forEach(b => b.classList.toggle('active', b === button));
  render();
}));
searchInput?.addEventListener('input', render);

async function loadFeed() {
  const { data, error } = await hotflashSupabase
    .from('vehicles')
    .select('*, owner:profiles!vehicles_owner_id_fkey(username, display_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    stream.innerHTML = `<article class="feed-empty"><strong>Discovery feed error</strong><p>${escapeHtml(error.message)}</p></article>`;
    if (count) count.textContent = 'Unavailable';
    return;
  }
  vehicles = data || [];
  render();
}

loadFeed();