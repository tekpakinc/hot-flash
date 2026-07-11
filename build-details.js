const expandedVehicleForm = document.querySelector('[data-expanded-vehicle-form]');
const expandedCoverInput = document.querySelector('[data-expanded-cover-input]');
const expandedCoverPreview = document.querySelector('[data-expanded-cover-preview]');

function expandedStatus(message, type = '') {
  const status = document.querySelector('[data-auth-status]');
  if (!status) return;
  status.textContent = message;
  status.className = type;
}

function expandedSlugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

expandedCoverInput?.addEventListener('change', () => {
  const file = expandedCoverInput.files?.[0];
  if (!expandedCoverPreview) return;
  if (!file) {
    expandedCoverPreview.innerHTML = '<span>No cover photo selected yet.</span>';
    return;
  }
  const url = URL.createObjectURL(file);
  expandedCoverPreview.innerHTML = `<img src="${url}" alt="Selected vehicle cover preview" /><span>Cover photo ready.</span>`;
});

async function uploadExpandedCover(file, userId, slug) {
  if (!file || !file.size) return null;
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const extension = file.name?.split('.').pop()?.toLowerCase() || file.type.split('/')[1] || 'jpg';
  const path = `${userId}/${slug || 'vehicle'}/cover-${Date.now()}.${extension}`;
  const { error } = await hotflashSupabase.storage.from('vehicle-images').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  return hotflashSupabase.storage.from('vehicle-images').getPublicUrl(path).data.publicUrl;
}

expandedVehicleForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const { data: sessionData, error: sessionError } = await hotflashSupabase.auth.getSession();
  if (sessionError) {
    expandedStatus(sessionError.message, 'error');
    return;
  }
  const session = sessionData.session;
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const form = new FormData(expandedVehicleForm);
  const nickname = form.get('nickname');
  const slug = expandedSlugify(nickname);
  expandedStatus('Adding vehicle and build details...', '');

  try {
    const coverPhoto = await uploadExpandedCover(form.get('cover_photo'), session.user.id, slug);
    const powertrain = String(form.get('powertrain') || '').trim();
    const buildSummary = String(form.get('build_summary') || '').trim();

    const { error } = await hotflashSupabase.from('vehicles').insert({
      owner_id: session.user.id,
      nickname,
      slug,
      year: Number(form.get('year')) || null,
      make: form.get('make') || null,
      model: form.get('model') || null,
      trim: form.get('trim') || null,
      horsepower: Number(form.get('horsepower')) || null,
      engine: powertrain || buildSummary || null,
      build_summary: buildSummary || null,
      powertrain: powertrain || null,
      suspension_brakes: String(form.get('suspension_brakes') || '').trim() || null,
      wheels_tires: String(form.get('wheels_tires') || '').trim() || null,
      exterior: String(form.get('exterior') || '').trim() || null,
      interior: String(form.get('interior') || '').trim() || null,
      electronics_audio: String(form.get('electronics_audio') || '').trim() || null,
      cover_photo: coverPhoto,
    });
    if (error) throw error;

    expandedVehicleForm.reset();
    if (expandedCoverPreview) expandedCoverPreview.innerHTML = '<span>No cover photo selected yet.</span>';
    expandedStatus('Vehicle added with full build details.', 'success');
    window.setTimeout(() => window.location.reload(), 500);
  } catch (error) {
    expandedStatus(error.message, 'error');
  }
});
