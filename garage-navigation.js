const garageContainer = document.querySelector("[data-garage-list]");

function wireGarageCards() {
  garageContainer?.querySelectorAll(".vehicle-card-live").forEach((card) => {
    if (card.dataset.navigationReady === "true") return;
    const hotflashId = card.querySelector(".eyebrow")?.textContent?.trim();
    if (!hotflashId || !hotflashId.startsWith("HF-")) return;

    card.dataset.navigationReady = "true";
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    card.setAttribute("aria-label", `Open ${card.querySelector("h2")?.textContent || "vehicle"} profile`);

    const openProfile = () => {
      window.location.href = `vehicle.html?hf=${encodeURIComponent(hotflashId)}`;
    };

    card.addEventListener("click", openProfile);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openProfile();
      }
    });
  });
}

if (garageContainer) {
  new MutationObserver(wireGarageCards).observe(garageContainer, { childList: true, subtree: true });
  wireGarageCards();
}
