const authStatus = document.querySelector("[data-auth-status]");
const signupForm = document.querySelector("[data-signup-form]");
const loginForm = document.querySelector("[data-login-form]");
const logoutButton = document.querySelector("[data-logout]");
const profileForm = document.querySelector("[data-profile-form]");
const vehicleForm = document.querySelector("[data-vehicle-form]");
const garageList = document.querySelector("[data-garage-list]");
const profileSummary = document.querySelector("[data-profile-summary]");
const coverPhotoInput = document.querySelector("[data-cover-photo-input]");
const coverPreview = document.querySelector("[data-cover-preview]");

const VEHICLE_IMAGE_BUCKET = "vehicle-images";

function setStatus(message, type = "") {
  if (!authStatus) return;
  authStatus.textContent = message;
  authStatus.className = type;
}

function slugify(value) {
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function getFileExtension(file) {
  const fallback = file.type?.split("/")[1] || "jpg";
  return file.name?.split(".").pop()?.toLowerCase() || fallback;
}

function installPasswordToggles() {
  document.querySelectorAll('input[type="password"]').forEach((input) => {
    const wrapper = document.createElement("div");
    wrapper.className = "password-field";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "password-toggle";
    button.setAttribute("aria-label", "Show password");
    button.textContent = "Show";

    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    wrapper.appendChild(button);

    button.addEventListener("click", () => {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      button.textContent = isHidden ? "Hide" : "Show";
      button.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    });
  });
}

installPasswordToggles();

coverPhotoInput?.addEventListener("change", () => {
  const file = coverPhotoInput.files?.[0];
  if (!coverPreview) return;

  if (!file) {
    coverPreview.innerHTML = "<span>No cover photo selected yet.</span>";
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  coverPreview.innerHTML = `<img src="${previewUrl}" alt="Selected vehicle cover preview" /><span>Cover photo ready.</span>`;
});

async function getSession() {
  const { data, error } = await hotflashSupabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

async function requireSession() {
  const session = await getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

async function uploadVehicleCover(file, userId, vehicleSlug) {
  if (!file) return null;

  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file for the vehicle cover photo.");
  }

  const extension = getFileExtension(file);
  const safeSlug = vehicleSlug || "vehicle";
  const filePath = `${userId}/${safeSlug}/cover-${Date.now()}.${extension}`;

  const { error: uploadError } = await hotflashSupabase.storage
    .from(VEHICLE_IMAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = hotflashSupabase.storage
    .from(VEHICLE_IMAGE_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function loadDashboard() {
  const session = await requireSession();
  if (!session) return;

  const user = session.user;
  const { data: profile } = await hotflashSupabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileSummary) {
    profileSummary.innerHTML = profile
      ? `<strong>${profile.display_name || profile.username}</strong><span>@${profile.username}</span>`
      : `<strong>Welcome to Hot Flash</strong><span>Create your founder profile below.</span>`;
  }

  if (profileForm && profile) {
    profileForm.display_name.value = profile.display_name || "";
    profileForm.username.value = profile.username || "";
    profileForm.bio.value = profile.bio || "";
  }

  await loadGarage(user.id);
}

async function loadGarage(userId) {
  if (!garageList) return;
  garageList.innerHTML = `<article class="post-card"><strong>Loading garage...</strong></article>`;

  const { data, error } = await hotflashSupabase
    .from("vehicles")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    garageList.innerHTML = `<article class="post-card"><strong>Garage error</strong><p class="small-muted">${error.message}</p></article>`;
    return;
  }

  if (!data || data.length === 0) {
    garageList.innerHTML = `<article class="post-card"><strong>No vehicles yet</strong><p class="small-muted">Add your first ride and claim account history like a menace.</p></article>`;
    return;
  }

  garageList.innerHTML = data
    .map(
      (vehicle) => `
        <article class="vehicle-card vehicle-card-live">
          <div class="vehicle-art ${vehicle.cover_photo ? "has-cover" : ""}" ${vehicle.cover_photo ? `style="background-image: linear-gradient(0deg, rgba(5, 6, 7, 0.58), rgba(5, 6, 7, 0.08)), url('${vehicle.cover_photo}')"` : ""}></div>
          <div class="vehicle-body">
            <p class="eyebrow">${vehicle.hotflash_id || "Hot Flash build"}</p>
            <h2>${vehicle.nickname}</h2>
            <p class="vehicle-meta">${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}</p>
            <p class="small-muted">${vehicle.engine || "Engine details coming soon"}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

signupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Creating account...", "");

  const form = new FormData(signupForm);
  const email = form.get("email");
  const password = form.get("password");
  const username = slugify(form.get("username"));
  const displayName = form.get("display_name");

  const { data, error } = await hotflashSupabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        display_name: displayName,
      },
    },
  });

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  if (data.user) {
    const { error: profileError } = await hotflashSupabase.from("profiles").upsert({
      id: data.user.id,
      username,
      display_name: displayName,
      email,
      bio: "",
    });

    if (profileError) {
      setStatus(profileError.message, "error");
      return;
    }
  }

  setStatus("Account created. Check your email if confirmation is enabled, then log in.", "success");
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Logging in...", "");

  const form = new FormData(loginForm);
  const email = form.get("email");
  const password = form.get("password");

  const { error } = await hotflashSupabase.auth.signInWithPassword({ email, password });

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  window.location.href = "dashboard.html";
});

logoutButton?.addEventListener("click", async () => {
  await hotflashSupabase.auth.signOut();
  window.location.href = "login.html";
});

profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const session = await requireSession();
  if (!session) return;

  setStatus("Saving profile...", "");
  const form = new FormData(profileForm);
  const username = slugify(form.get("username"));

  const { error } = await hotflashSupabase.from("profiles").upsert({
    id: session.user.id,
    email: session.user.email,
    username,
    display_name: form.get("display_name"),
    bio: form.get("bio"),
  });

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  setStatus("Profile saved.", "success");
  await loadDashboard();
});

vehicleForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const session = await requireSession();
  if (!session) return;

  setStatus("Adding vehicle...", "");
  const form = new FormData(vehicleForm);
  const nickname = form.get("nickname");
  const vehicleSlug = slugify(nickname);
  const coverFile = form.get("cover_photo");

  try {
    const coverPhotoUrl = coverFile && coverFile.size > 0
      ? await uploadVehicleCover(coverFile, session.user.id, vehicleSlug)
      : null;

    // Premium roadmap: verified/founder accounts can auto-watermark uploads with their profile avatar.
    const { error } = await hotflashSupabase.from("vehicles").insert({
      owner_id: session.user.id,
      nickname,
      slug: vehicleSlug,
      year: Number(form.get("year")) || null,
      make: form.get("make"),
      model: form.get("model"),
      trim: form.get("trim"),
      engine: form.get("engine"),
      horsepower: Number(form.get("horsepower")) || null,
      cover_photo: coverPhotoUrl,
    });

    if (error) throw error;

    vehicleForm.reset();
    if (coverPreview) coverPreview.innerHTML = "<span>No cover photo selected yet.</span>";
    setStatus("Vehicle added. Garage updated.", "success");
    await loadDashboard();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

if (document.body.dataset.page === "dashboard") {
  loadDashboard().catch((error) => setStatus(error.message, "error"));
}
