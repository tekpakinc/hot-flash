const vehicleControlsGarage = document.querySelector('[data-garage-list]');

function setVehicleControlStatus(message, type = '') {
  const status = document.querySelector('[data-auth-status]');
  if (!status) return;
  status.textContent = message;
  status.className = type;
}

async function deleteVehicleByHotFlashId(hotflashId, nickname, button) {
  const confirmed = window.confirm(
    `Delete ${nickname || hotflashId}?\n\nThis removes the vehicle profile, gallery records, followers, and related database history. This cannot be undone.`,
  );

  if (!confirmed) return;

  button.disabled = true;
  button.textContent = 'Deleting…';
  setVehicleControlStatus(`Deleting ${nickname || hotflashId}…`);

  const { data: sessionData, error: sessionError } = await hotflashSupabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    button.disabled = false;
    button.textContent = 'Delete';
    setVehicleControlStatus('Please log in again before deleting a vehicle.', 'error');
    return;
  }

  const { error } = await hotflashSupabase
    .from('vehicles')
    .delete()
    .eq('hotflash_id', hotflashId)
    .eq('owner_id', sessionData.session.user.id);

  if (error) {
    button.disabled = false;
    button.textContent = 'Delete';
    setVehicleControlStatus(error.message, 'error');
    return;
  }

  button.closest('.vehicle-card-live')?.remove();
  setVehicleControlStatus(`${nickname || hotflashId} was deleted.`, 'success');

  if (vehicleControlsGarage && !vehicleControlsGarage.querySelector('.vehicle-card-live')) {
    vehicleControlsGarage.innerHTML = '<article class="post-card"><strong>No vehicles yet</strong><p class="small-muted">Add your first ride whenever you are ready.</p></article>';
  }
}

function installVehicleControls() {
  vehicleControlsGarage?.querySelectorAll('.vehicle-card-live').forEach((card) => {
    if (card.dataset.controlsReady === 'true') return;

    const hotflashId = card.querySelector('.eyebrow')?.textContent?.trim();
    if (!hotflashId?.startsWith('HF-')) return;

    const nickname = card.querySelector('h2')?.textContent?.trim() || hotflashId;
    const body = card.querySelector('.vehicle-body');
    if (!body) return;

    card.dataset.controlsReady = 'true';

    const actions = document.createElement('div');
    actions.className = 'vehicle-owner-actions';

    const openLink = document.createElement('a');
    openLink.className = 'vehicle-action-button';
    openLink.href = `vehicle.html?hf=${encodeURIComponent(hotflashId)}`;
    openLink.textContent = 'Open';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'vehicle-action-button danger';
    deleteButton.dataset.vehicleDelete = hotflashId;
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      deleteVehicleByHotFlashId(hotflashId, nickname, deleteButton);
    });

    actions.append(openLink, deleteButton);
    body.appendChild(actions);
  });
}

if (vehicleControlsGarage) {
  new MutationObserver(installVehicleControls).observe(vehicleControlsGarage, { childList: true, subtree: true });
  installVehicleControls();
}
