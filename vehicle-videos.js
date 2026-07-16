document.addEventListener('DOMContentLoaded', async () => {
  const root = document.querySelector('[data-vehicle-videos]');
  const ownerTools = document.querySelector('[data-video-owner-tools]');
  const input = document.querySelector('[data-video-upload]');
  const captionInput = document.querySelector('[data-video-caption]');
  const uploadButton = document.querySelector('[data-video-upload-button]');
  const status = document.querySelector('[data-video-status]');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const ref = params.get('hf') || params.get('id');
  if (!ref) return;

  let query = hotflashSupabase.from('vehicles').select('id,owner_id,slug,hotflash_id,nickname');
  query = ref.startsWith('HF-') ? query.eq('hotflash_id', ref) : query.eq('id', ref);
  const { data: vehicle, error: vehicleError } = await query.maybeSingle();
  if (vehicleError || !vehicle) {
    root.innerHTML = '<p class="small-muted">Videos could not be loaded.</p>';
    return;
  }

  const session = await (window.hotFlashGetStableSession ? window.hotFlashGetStableSession() : hotflashSupabase.auth.getSession().then(r => r.data.session));
  const isOwner = session?.user?.id === vehicle.owner_id;
  if (isOwner && ownerTools) ownerTools.hidden = false;

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  async function loadVideos() {
    const { data, error } = await hotflashSupabase
      .from('vehicle_videos')
      .select('*')
      .eq('vehicle_id', vehicle.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Hot Flash vehicle videos]', error);
      root.innerHTML = '<p class="small-muted">Videos are unavailable until the video migration is installed.</p>';
      return;
    }

    if (!data?.length) {
      root.innerHTML = '<p class="small-muted">No videos have been added to this build yet.</p>';
      return;
    }

    root.innerHTML = data.map(video => `
      <article class="vehicle-video-card" data-video-id="${video.id}" data-storage-path="${escapeHtml(video.storage_path)}">
        <video controls playsinline preload="metadata" src="${escapeHtml(video.video_url)}"></video>
        <div class="vehicle-video-copy">
          ${video.caption ? `<p>${escapeHtml(video.caption)}</p>` : '<p class="small-muted">Vehicle clip</p>'}
          ${isOwner ? '<button type="button" class="danger" data-delete-video>Delete video</button>' : ''}
        </div>
      </article>`).join('');

    if (isOwner) {
      root.querySelectorAll('[data-delete-video]').forEach(button => {
        button.addEventListener('click', async () => {
          const card = button.closest('[data-video-id]');
          if (!confirm('Delete this video?')) return;
          button.disabled = true;
          const path = card.dataset.storagePath;
          const id = card.dataset.videoId;
          const { error: storageError } = await hotflashSupabase.storage.from('vehicle-videos').remove([path]);
          const { error: rowError } = await hotflashSupabase.from('vehicle_videos').delete().eq('id', id).eq('owner_id', session.user.id);
          if (storageError || rowError) {
            button.disabled = false;
            if (status) status.textContent = 'Could not delete that video.';
            return;
          }
          card.remove();
          if (!root.children.length) root.innerHTML = '<p class="small-muted">No videos have been added to this build yet.</p>';
        });
      });
    }
  }

  uploadButton?.addEventListener('click', async () => {
    const file = input?.files?.[0];
    if (!file || !session || !isOwner) return;
    const allowed = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!allowed.includes(file.type)) {
      status.textContent = 'Choose an MP4, MOV, or WebM video.';
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      status.textContent = 'Videos must be 50 MB or smaller for now.';
      return;
    }

    uploadButton.disabled = true;
    status.textContent = 'Uploading video… Keep this page open.';
    const extension = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const storagePath = `${session.user.id}/${vehicle.id}/video-${Date.now()}.${extension}`;
    const { error: uploadError } = await hotflashSupabase.storage
      .from('vehicle-videos')
      .upload(storagePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });

    if (uploadError) {
      console.error(uploadError);
      status.textContent = uploadError.message || 'Video upload failed.';
      uploadButton.disabled = false;
      return;
    }

    const videoUrl = hotflashSupabase.storage.from('vehicle-videos').getPublicUrl(storagePath).data.publicUrl;
    const { error: rowError } = await hotflashSupabase.from('vehicle_videos').insert({
      vehicle_id: vehicle.id,
      owner_id: session.user.id,
      video_url: videoUrl,
      storage_path: storagePath,
      caption: String(captionInput?.value || '').trim() || null,
    });

    if (rowError) {
      await hotflashSupabase.storage.from('vehicle-videos').remove([storagePath]);
      console.error(rowError);
      status.textContent = rowError.message || 'Video details could not be saved.';
      uploadButton.disabled = false;
      return;
    }

    input.value = '';
    if (captionInput) captionInput.value = '';
    status.textContent = 'Video added to the vehicle page.';
    uploadButton.disabled = false;
    await loadVideos();
  });

  await loadVideos();
});
