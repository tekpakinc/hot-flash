const authStatus = document.querySelector("[data-auth-status]");
const signupForm = document.querySelector("[data-signup-form]");
const loginForm = document.querySelector("[data-login-form]");
const logoutButton = document.querySelector("[data-logout]");
const profileForm = document.querySelector("[data-profile-form]");
const vehicleForm = document.querySelector("[data-vehicle-form]");
const garageList = document.querySelector("[data-garage-list]");
const profileSummary = document.querySelector("[data-profile-summary]");

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
        <article class="vehicle-card">
          <div class="vehicle-art"></div>
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

  const { error } = await hotflashSupabase.from("vehicles").insert({
    owner_id: session.user.id,
    nickname,
    slug: slugify(nickname),
    year: Number(form.get("year")) || null,
    make: form.get("make"),
    model: form.get("model"),
    trim: form.get("trim"),
    engine: form.get("engine"),
    horsepower: Number(form.get("horsepower")) || null,
  });

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  vehicleForm.reset();
  setStatus("Vehicle added. Garage updated.", "success");
  await loadDashboard();
});

if (document.body.dataset.page === "dashboard") {
  loadDashboard().catch((error) => setStatus(error.message, "error"));
}
