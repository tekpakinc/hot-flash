const params = new URLSearchParams(window.location.search);
const vehicleRef = params.get("id") || params.get("hf");
const statusEl = document.querySelector("[data-vehicle-status]");
const galleryEl = document.querySelector("[data-gallery]");
const heroImage = document.querySelector("[data-hero-image]");
const thumbnailsEl = document.querySelector("[data-gallery-thumbnails]");
const ownerTools = document.querySelector("[data-owner-gallery-tools]");
const uploadInput = document.querySelector("[data-gallery-upload]");
const uploadButton = document.querySelector("[data-gallery-upload-button]");
const uploadStatus = document.querySelector("[data-gallery-upload-status]");
const lightbox = document.querySelector("[data-photo-lightbox]");
const lightboxImage = document.querySelector("[data-lightbox-image]");
const lightboxCaption = document.querySelector("[data-lightbox-caption]");
const lightboxCounter = document.querySelector("[data-lightbox-counter]");

let currentVehicle;
let galleryImages = [];
let activeIndex = 0;
let touchStartX = 0;

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = isError ? "small-muted error" : "small-muted";
}

function updateLightbox() {
  if (!lightbox || lightbox.hidden || !galleryImages.length) return;
  const image = galleryImages[activeIndex];
  lightboxImage.src = image.image_url;
  lightboxImage.alt = image.caption || currentVehicle.nickname;
  lightboxCaption.textContent = image.caption || `${currentVehicle.nickname} photo ${activeIndex + 1}`;
  lightboxCounter.textContent = `${activeIndex + 1} / ${galleryImages.length}`;
}

function showImage(index) {
  if (!galleryImages.length) return;
  activeIndex = (index + galleryImages.length) % galleryImages.length;
  heroImage.src = galleryImages[activeIndex].image_url;
  heroImage.alt = galleryImages[activeIndex].caption || currentVehicle.nickname;
  [...thumbnailsEl.children].forEach((thumb, thumbIndex) => {
    thumb.classList.toggle("active", thumbIndex === activeIndex);
  });
  updateLightbox();
}

function openLightbox() {
  if (!lightbox || !galleryImages.length) return;
  lightbox.hidden = false;
  document.body.classList.add("lightbox-open");
  updateLightbox();
  document.querySelector("[data-lightbox-close]")?.focus();
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.hidden = true;
  document.body.classList.remove("lightbox-open");
}

function renderGallery() {
  if (!galleryImages.length && currentVehicle.cover_photo) {
    galleryImages = [{ image_url: currentVehicle.cover_photo, caption: `${currentVehicle.nickname} cover photo` }];
  }

  if (!galleryImages.length) {
    galleryImages = [{ image_url: "assets/hero.png", caption: "Hot Flash vehicle placeholder" }];
  }

  thumbnailsEl.innerHTML = galleryImages
    .map((image, index) => `<button type="button" data-thumb-index="${index}" aria-label="View photo ${index + 1}"><img src="${image.image_url}" alt="${image.caption || `Vehicle photo ${index + 1}`}" /></button>`)
    .join("");

  thumbnailsEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-thumb-index]");
    if (!button) return;
    showImage(Number(button.dataset.thumbIndex));
  });

  document.querySelector("[data-gallery-prev]")?.addEventListener("click", () => showImage(activeIndex - 1));
  document.querySelector("[data-gallery-next]")?.addEventListener("click", () => showImage(activeIndex + 1));
  document.querySelector("[data-open-lightbox]")?.addEventListener("click", openLightbox);
  document.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
  document.querySelector("[data-lightbox-prev]")?.addEventListener("click", () => showImage(activeIndex - 1));
  document.querySelector("[data-lightbox-next]")?.addEventListener("click", () => showImage(activeIndex + 1));

  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  lightbox?.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });
  lightbox?.addEventListener("touchend", (event) => {
    const distance = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(distance) < 45) return;
    showImage(distance < 0 ? activeIndex + 1 : activeIndex - 1);
  }, { passive: true });

  document.addEventListener("keydown", (event) => {
    if (!lightbox || lightbox.hidden) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") showImage(activeIndex - 1);
    if (event.key === "ArrowRight") showImage(activeIndex + 1);
  });

  showImage(0);
  galleryEl.hidden = false;
  document.querySelector("[data-stat-photos]").textContent = String(galleryImages.length);
}

function renderVehicle(profile) {
  document.title = `${currentVehicle.nickname} | Hot Flash`;
  document.querySelector("[data-hotflash-id]").textContent = currentVehicle.hotflash_id || "Hot Flash vehicle";
  document.querySelector("[data-vehicle-name]").textContent = currentVehicle.nickname;
  document.querySelector("[data-vehicle-summary]").textContent = [currentVehicle.year, currentVehicle.make, currentVehicle.model].filter(Boolean).join(" ");
  document.querySelector("[data-owner-summary]").textContent = `Owner: ${profile?.display_name || profile?.username || "Hot Flash member"}`;
  document.querySelector("[data-owner-name]").textContent = profile?.display_name || profile?.username || "Hot Flash member";
  document.querySelector("[data-stat-hp]").textContent = currentVehicle.horsepower || "—";

  const storyCopy = currentVehicle.build_summary || currentVehicle.engine;
  if (storyCopy) {
    document.querySelector("[data-story-title]").textContent = "What's done to it";
    document.querySelector("[data-story-copy]").textContent = storyCopy;
  }

  const specs = [
    ["Year", currentVehicle.year],
    ["Make", currentVehicle.make],
    ["Model", currentVehicle.model],
    ["Trim", currentVehicle.trim],
    ["Powertrain", currentVehicle.powertrain || currentVehicle.engine],
    ["Suspension & brakes", currentVehicle.suspension_brakes],
    ["Wheels & tires", currentVehicle.wheels_tires],
    ["Exterior", currentVehicle.exterior],
    ["Interior", currentVehicle.interior],
    ["Electronics & audio", currentVehicle.electronics_audio],
    ["Hot Flash ID", currentVehicle.hotflash_id],
  ].filter(([, value]) => value);

  document.querySelector("[data-specs-grid]").innerHTML = specs
    .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
}

async function loadVehicle() {
  if (!vehicleRef) throw new Error("No vehicle was selected.");

  let query = hotflashSupabase.from("vehicles").select("*");
  query = vehicleRef.startsWith("HF-") ? query.eq("hotflash_id", vehicleRef) : query.eq("id", vehicleRef);
  const { data: vehicle, error } = await query.maybeSingle();
  if (error) throw error;
  if (!vehicle) throw new Error("Vehicle not found.");
  currentVehicle = vehicle;

  const [{ data: profile }, { data: images }, { data: sessionData }] = await Promise.all([
    hotflashSupabase.from("profiles").select("username, display_name, avatar_url").eq("id", vehicle.owner_id).maybeSingle(),
    hotflashSupabase.from("vehicle_images").select("*").eq("vehicle_id", vehicle.id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    hotflashSupabase.auth.getSession(),
  ]);

  galleryImages = images || [];
  renderVehicle(profile);
  renderGallery();

  if (sessionData?.session?.user?.id === vehicle.owner_id) ownerTools.hidden = false;
  setStatus("");
}

uploadButton?.addEventListener("click", async () => {
  const files = [...(uploadInput.files || [])];
  if (!files.length || !currentVehicle) return;

  uploadButton.disabled = true;
  uploadStatus.textContent = `Uploading ${files.length} photo${files.length === 1 ? "" : "s"}...`;

  try {
    const session = (await hotflashSupabase.auth.getSession()).data.session;
    if (!session) throw new Error("Please log in again before uploading.");

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (!file.type.startsWith("image/")) continue;
      const extension = file.name.split(".").pop() || "jpg";
      const path = `${session.user.id}/${currentVehicle.slug}/gallery-${Date.now()}-${index}.${extension}`;
      const { error: uploadError } = await hotflashSupabase.storage.from("vehicle-images").upload(path, file, { cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data: publicData } = hotflashSupabase.storage.from("vehicle-images").getPublicUrl(path);
      const { error: insertError } = await hotflashSupabase.from("vehicle_images").insert({
        vehicle_id: currentVehicle.id,
        owner_id: session.user.id,
        image_url: publicData.publicUrl,
        storage_path: path,
        sort_order: galleryImages.length + index,
      });
      if (insertError) throw insertError;
    }

    uploadStatus.textContent = "Photos uploaded. Refreshing gallery...";
    window.location.reload();
  } catch (error) {
    uploadStatus.textContent = error.message;
  } finally {
    uploadButton.disabled = false;
  }
});

document.querySelectorAll("[data-tab-button]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab-button]").forEach((item) => item.classList.toggle("active", item === button));
    document.querySelectorAll("[data-tab-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.tabPanel === button.dataset.tabButton));
  });
});

loadVehicle().catch((error) => setStatus(error.message, true));
