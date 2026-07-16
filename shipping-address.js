const shippingForm = document.querySelector('[data-shipping-form]');
const shippingStatus = document.querySelector('[data-shipping-status]');

function setShippingStatus(message, type = '') {
  if (!shippingStatus) return;
  shippingStatus.textContent = message;
  shippingStatus.className = `small-muted ${type}`.trim();
}

async function loadShippingAddress() {
  if (!shippingForm) return;
  const session = typeof window.hotFlashGetStableSession === 'function'
    ? await window.hotFlashGetStableSession()
    : (await hotflashSupabase.auth.getSession()).data.session;
  if (!session) return;

  const { data, error } = await hotflashSupabase
    .from('shipping_addresses')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) {
    console.error('[Hot Flash shipping load]', error);
    setShippingStatus('Shipping details are unavailable until the database update is installed.', 'error');
    return;
  }

  if (!data) return;
  ['full_name','address_line_1','address_line_2','city','state_region','postal_code','country','phone'].forEach((field) => {
    if (shippingForm.elements[field]) shippingForm.elements[field].value = data[field] || '';
  });
}

shippingForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const session = typeof window.hotFlashGetStableSession === 'function'
    ? await window.hotFlashGetStableSession()
    : (await hotflashSupabase.auth.getSession()).data.session;
  if (!session) {
    window.location.href = 'login.html?returnTo=dashboard.html';
    return;
  }

  setShippingStatus('Saving private shipping details…');
  const form = new FormData(shippingForm);
  const payload = {
    user_id: session.user.id,
    full_name: String(form.get('full_name') || '').trim() || null,
    address_line_1: String(form.get('address_line_1') || '').trim() || null,
    address_line_2: String(form.get('address_line_2') || '').trim() || null,
    city: String(form.get('city') || '').trim() || null,
    state_region: String(form.get('state_region') || '').trim() || null,
    postal_code: String(form.get('postal_code') || '').trim() || null,
    country: String(form.get('country') || '').trim() || 'United States',
    phone: String(form.get('phone') || '').trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await hotflashSupabase.from('shipping_addresses').upsert(payload);
  if (error) {
    console.error('[Hot Flash shipping save]', error);
    setShippingStatus('We could not save that address. Please check the fields and try again.', 'error');
    return;
  }
  setShippingStatus('Private shipping details saved.', 'success');
});

document.addEventListener('DOMContentLoaded', loadShippingAddress);
