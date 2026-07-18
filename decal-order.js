const PAYPAL_CHECKOUT_URL = 'https://www.paypal.com/ncp/payment/B44AXTRYGFKD2';

document.addEventListener('DOMContentLoaded', async () => {
  const title = document.querySelector('[data-order-title]');
  const copy = document.querySelector('[data-order-copy]');
  const price = document.querySelector('[data-order-price]');
  const benefit = document.querySelector('[data-order-benefit]');
  const button = document.querySelector('[data-create-order]');
  const status = document.querySelector('[data-order-status]');
  const vehicleId = new URLSearchParams(location.search).get('vehicle');
  const session = window.hotFlashGetStableSession ? await window.hotFlashGetStableSession() : (await hotflashSupabase.auth.getSession()).data.session;
  if (!session) { location.href = `login.html?returnTo=${encodeURIComponent(location.pathname + location.search)}`; return; }
  if (!vehicleId) { status.textContent = 'No vehicle was selected.'; return; }

  const [{ data: vehicle }, { data: profile }, { data: shipping }] = await Promise.all([
    hotflashSupabase.from('vehicles').select('id,owner_id,nickname,year,make,model,hotflash_id').eq('id', vehicleId).maybeSingle(),
    hotflashSupabase.from('profiles').select('account_tier,subscription_status,subscription_ends_at').eq('id', session.user.id).maybeSingle(),
    hotflashSupabase.from('shipping_addresses').select('*').eq('user_id', session.user.id).maybeSingle(),
  ]);
  if (!vehicle || vehicle.owner_id !== session.user.id) { status.textContent = 'That vehicle is not available for this account.'; return; }
  title.textContent = `Printed decal for ${vehicle.nickname || vehicle.hotflash_id}`;
  copy.textContent = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Hot Flash vehicle decal';

  const active = ['active','trialing'].includes(profile?.subscription_status) && (!profile?.subscription_ends_at || new Date(profile.subscription_ends_at) > new Date());
  const included = active && ['verified','plus','shop','brand','admin'].includes(profile?.account_tier);
  price.textContent = included ? 'Included' : '$5.99';
  benefit.textContent = included ? 'Your active membership includes one eligible printed vehicle decal.' : 'Professional printed FlashTag decal for free members. Shipping is included and your private mailing address is used for fulfillment.';
  button.textContent = included ? 'Claim Included Decal' : 'Order Official Decal — $5.99';
  button.disabled = false;

  button.addEventListener('click', async () => {
    if (!shipping?.address_line_1 || !shipping?.city || !shipping?.state_region || !shipping?.postal_code) {
      status.textContent = 'Add a complete private mailing address in My Garage before ordering.';
      return;
    }
    button.disabled = true;
    status.textContent = included ? 'Creating your included decal request…' : 'Creating your decal order…';
    const snapshot = {
      full_name: shipping.full_name, address_line_1: shipping.address_line_1, address_line_2: shipping.address_line_2,
      city: shipping.city, state_region: shipping.state_region, postal_code: shipping.postal_code,
      country: shipping.country, phone: shipping.phone,
    };
    const { data: order, error } = await hotflashSupabase.from('decal_orders').insert({
      user_id: session.user.id,
      vehicle_id: vehicle.id,
      order_type: included ? 'subscription_included' : 'paid',
      amount_cents: included ? 0 : 599,
      status: included ? 'approved' : 'pending_payment',
      shipping_address_snapshot: snapshot,
    }).select().single();
    if (error) { console.error(error); status.textContent = 'Could not create the decal order.'; button.disabled = false; return; }
    if (included) { status.textContent = 'Decal request received. You can track fulfillment from your account once shipping tools are live.'; button.textContent = 'Request received'; return; }

    try {
      window.sessionStorage.setItem('hotflash-pending-decal-order', JSON.stringify({
        orderId: order.id,
        vehicleId: vehicle.id,
        vehicleName: vehicle.nickname || vehicle.hotflash_id,
        createdAt: new Date().toISOString(),
      }));
    } catch (_) {}

    status.textContent = 'Opening secure PayPal checkout…';
    window.location.assign(PAYPAL_CHECKOUT_URL);
  });
});