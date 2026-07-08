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
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const button = form.querySelector("button");
    const originalText = button.textContent;
    button.textContent = "Submitting...";
    button.disabled = true;
    note.textContent = "Sending your request...";
    note.classList.remove("error");
    note.classList.remove("success");

    try {
      const response = await fetch(form.action, {
        method: form.method,
        body: new FormData(form),
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Form submission failed");
      }

      button.textContent = "Submitted";
      note.textContent = success;
      note.classList.add("success");
      form.reset();
    } catch (error) {
      button.textContent = originalText;
      note.textContent = "Something went wrong. Please try again in a moment.";
      note.classList.add("error");
    } finally {
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 1800);
    }
  });
});
