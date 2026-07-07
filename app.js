const forms = [
  {
    form: document.querySelector("#heroForm"),
    note: document.querySelector("#formNote"),
    success: "You are on the early access list. Next step: private alpha invite.",
  },
  {
    form: document.querySelector("#waitlistForm"),
    note: document.querySelector("#waitlistNote"),
    success: "Invite request captured for the alpha list.",
  },
];

forms.forEach(({ form, note, success }) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const button = form.querySelector("button");
    const originalText = button.textContent;
    button.textContent = "Submitted";
    button.disabled = true;
    note.textContent = success;
    note.classList.add("success");

    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
      form.reset();
    }, 1800);
  });
});
