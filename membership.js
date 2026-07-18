const HOTFLASH_TIERS = {
  free: { label: 'Hot Flash Free', price: 'Always free' },
  verified: { label: 'Hot Flash Verified', price: '$1.99/month', includesDecals: true },
  plus: { label: 'Hot Flash Plus', price: '$4.99/month', includesDecals: true },
  shop: { label: 'Verified Shop', price: '$59.99 every 6 months', includesDecals: true },
  brand: { label: 'Verified Brand', price: 'Custom', includesDecals: true },
  admin: { label: 'Hot Flash Admin', price: '', includesDecals: true },
};

function hfActiveMembership(profile) {
  if (!profile) return false;
  if (!['active', 'trialing'].includes(profile.subscription_status)) return false;
  if (!profile.subscription_ends_at) return true;
  return new Date(profile.subscription_ends_at).getTime() > Date.now();
}

function hfTierIncludesDecal(profile) {
  const tier = HOTFLASH_TIERS[profile?.account_tier || 'free'];
  return Boolean(tier?.includesDecals && (profile.account_tier === 'admin' || hfActiveMembership(profile)));
}

async function hfLoadMembership() {
  const session = window.hotFlashGetStableSession
    ? await window.hotFlashGetStableSession()
    : (await hotflashSupabase.auth.getSession()).data.session;
  if (!session) return null;
  const { data } = await hotflashSupabase
    .from('profiles')
    .select('account_tier,subscription_status,subscription_started_at,subscription_ends_at,verified_at')
    .eq('id', session.user.id)
    .maybeSingle();
  return { session, profile: data || { account_tier: 'free', subscription_status: 'inactive' } };
}

async function hfInstallDecalOrderButton() {
  if (document.body.dataset.page !== 'vehicle') return;
  const actions = document.querySelector('[data-flashtag-owner-actions]');
  if (!actions || actions.querySelector('[data-order-decal]')) return;
  const membership = await hfLoadMembership();
  if (!membership) return;

  const params = new URLSearchParams(location.search);
  const ref = params.get('hf') || params.get('id');
  if (!ref) return;
  let query = hotflashSupabase.from('vehicles').select('id,owner_id,hotflash_id,nickname');
  query = ref.startsWith('HF-') ? query.eq('hotflash_id', ref) : query.eq('id', ref);
  const { data: vehicle } = await query.maybeSingle();
  if (!vehicle || vehicle.owner_id !== membership.session.user.id) return;

  const included = hfTierIncludesDecal(membership.profile);
  const button = document.createElement('a');
  button.dataset.orderDecal = 'true';
  button.className = included ? 'secondary-button decal-included-button' : 'secondary-button decal-order-button';
  button.href = `decal-order.html?vehicle=${encodeURIComponent(vehicle.id)}`;
  button.textContent = included ? 'Claim Included Printed Decal' : 'Order Printed Decal — $5.99';
  button.title = included
    ? 'One printed decal per eligible vehicle is included while your verified membership is active.'
    : 'Order a printed Hot Flash vehicle decal through PayPal.';
  actions.appendChild(button);
}

async function hfDecorateMembershipSettings() {
  const card = document.querySelector('[data-founder-number]')?.closest('.founder-status-card');
  if (!card) return;
  const membership = await hfLoadMembership();
  if (!membership) return;
  const tier = HOTFLASH_TIERS[membership.profile.account_tier || 'free'] || HOTFLASH_TIERS.free;
  const active = hfActiveMembership(membership.profile);
  const line = document.createElement('p');
  line.className = 'membership-summary';
  line.innerHTML = `<strong>${tier.label}</strong><span>${active ? 'Active' : tier.price}</span>`;
  card.prepend(line);
  const pricing = document.createElement('a');
  pricing.className = 'secondary-button';
  pricing.href = 'pricing.html';
  pricing.textContent = active ? 'Manage membership' : 'Explore paid features';
  card.appendChild(pricing);
}

document.addEventListener('DOMContentLoaded', () => {
  hfInstallDecalOrderButton().catch(console.error);
  hfDecorateMembershipSettings().catch(console.error);
});
