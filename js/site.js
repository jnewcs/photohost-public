(() => {
  "use strict";

  const config = window.PHOTOHOST_CONFIG || {};
  const $ = (selector, root = document) => root.querySelector(selector);

  // Footer year
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  // Mobile navigation
  const navToggle = $(".nav-toggle");
  const siteNav = $("#site-nav");
  if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
      const open = siteNav.dataset.open === "true";
      siteNav.dataset.open = String(!open);
      navToggle.setAttribute("aria-expanded", String(!open));
    });

    siteNav.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        siteNav.dataset.open = "false";
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Gallery lightbox
  const lightbox = $("#lightbox");
  if (lightbox) {
    const lightboxImage = $("img", lightbox);
    const caption = $("figcaption", lightbox);
    const previous = $(".lightbox-prev", lightbox);
    const next = $(".lightbox-next", lightbox);
    let items = [];
    let index = 0;

    const render = () => {
      const item = items[index];
      if (!item) return;
      lightboxImage.src = item.full;
      lightboxImage.alt = item.alt;
      caption.textContent = `${index + 1} / ${items.length}`;
      previous.hidden = items.length < 2;
      next.hidden = items.length < 2;
    };

    const step = (delta) => {
      index = (index + delta + items.length) % items.length;
      render();
    };

    document.querySelectorAll(".gallery-grid").forEach((grid) => {
      grid.addEventListener("click", (event) => {
        const button = event.target.closest(".gallery-item");
        if (!button) return;
        items = Array.from(grid.querySelectorAll(".gallery-item")).map((item) => ({
          full: item.dataset.full,
          alt: item.dataset.alt || "",
        }));
        index = Array.from(grid.querySelectorAll(".gallery-item")).indexOf(button);
        render();
        lightbox.showModal();
      });
    });

    previous.addEventListener("click", () => step(-1));
    next.addEventListener("click", () => step(1));
    $(".lightbox-close", lightbox).addEventListener("click", () => lightbox.close());
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) lightbox.close();
    });
    lightbox.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
    });
  }

  // Cloudflare Turnstile (explicit render so the key stays in config.js)
  const turnstileContainer = $("#turnstile-widget");
  const form = $("#contact-form");
  const status = $("#form-status");
  const fields = $("#contact-fields");
  const successPanel = $("#form-success");
  const anotherButton = $("#contact-another");
  const submitButton = $("#contact-submit");
  const submitLabel = submitButton ? $(".button-label", submitButton) : null;
  const submitSpinner = submitButton ? $(".button-spinner", submitButton) : null;
  let turnstileWidgetId = null;
  let verifyState = "loading";
  let sending = false;
  let startedAt = performance.now();

  const showStatus = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
  };

  const showVerificationError = () => {
    status.innerHTML =
      'Verification could not load. Please refresh the page, or email ' +
      '<a href="mailto:saumyasinghalphotography@gmail.com">saumyasinghalphotography@gmail.com</a>.';
    status.dataset.state = "error";
  };

  const updateSubmit = () => {
    if (!submitButton) return;
    submitButton.disabled = sending || verifyState !== "ready";
    if (submitSpinner) submitSpinner.hidden = !(sending || verifyState === "loading");
    if (!submitLabel) return;
    if (sending) submitLabel.textContent = "Sending…";
    else if (verifyState === "ready") submitLabel.textContent = "Send inquiry";
    else if (verifyState === "interactive") submitLabel.textContent = "Complete verification";
    else if (verifyState === "error") submitLabel.textContent = "Verification unavailable";
    else submitLabel.textContent = "Verifying…";
  };
  updateSubmit();

  const resetTurnstile = () => {
    if (turnstileWidgetId !== null && window.turnstile) {
      window.turnstile.reset(turnstileWidgetId);
    }
  };

  const verificationTimeout = window.setTimeout(() => {
    // Only fail when Turnstile never rendered; an interactive challenge can
    // legitimately wait for the visitor.
    if (verifyState === "ready" || turnstileWidgetId !== null) return;
    verifyState = "error";
    updateSubmit();
    showVerificationError();
  }, 12000);

  const mountTurnstile = () => {
    if (!turnstileContainer || turnstileWidgetId !== null) return;
    if (!window.turnstile) {
      window.setTimeout(mountTurnstile, 200);
      return;
    }
    turnstileWidgetId = window.turnstile.render(turnstileContainer, {
      sitekey: config.turnstileSiteKey,
      theme: "light",
      callback: () => {
        window.clearTimeout(verificationTimeout);
        verifyState = "ready";
        updateSubmit();
      },
      "expired-callback": () => {
        verifyState = "loading";
        updateSubmit();
      },
      "error-callback": (code) => {
        window.console.warn("Turnstile error", code);
        verifyState = "error";
        updateSubmit();
        showVerificationError();
      },
      "before-interactive-callback": () => {
        verifyState = "interactive";
        updateSubmit();
      },
      "after-interactive-callback": () => {
        verifyState = "loading";
        updateSubmit();
      },
    });
  };
  mountTurnstile();

  if (!form) return;

  if (anotherButton) {
    anotherButton.addEventListener("click", () => {
      if (successPanel) successPanel.hidden = true;
      if (fields) fields.hidden = false;
      form.reset();
      status.textContent = "";
      delete status.dataset.state;
      startedAt = performance.now();
      verifyState = "loading";
      resetTurnstile();
      updateSubmit();
      $("#name")?.focus();
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending || verifyState !== "ready") return;

    status.textContent = "";
    delete status.dataset.state;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const token = turnstileWidgetId !== null && window.turnstile
      ? window.turnstile.getResponse(turnstileWidgetId)
      : "";
    if (!token) {
      verifyState = "loading";
      updateSubmit();
      showStatus("Verification is still checking. Please wait a moment and try again.", "error");
      return;
    }

    const data = new FormData(form);
    data.set("turnstile_token", token);
    data.set("elapsed_ms", String(Math.round(performance.now() - startedAt)));

    sending = true;
    updateSubmit();

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(config.contactUrl, {
        method: "POST",
        body: new URLSearchParams(data),
        signal: controller.signal,
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        throw new Error(payload.error || "Something went wrong. Please try again.");
      }

      form.reset();
      startedAt = performance.now();
      status.textContent = "";
      delete status.dataset.state;
      if (fields) fields.hidden = true;
      if (successPanel) {
        successPanel.hidden = false;
        successPanel.querySelector("h3")?.focus();
      }
    } catch (error) {
      const message = error.name === "AbortError"
        ? "The message took too long to send. Please try again."
        : error.message;
      showStatus(message, "error");
    } finally {
      window.clearTimeout(timeout);
      sending = false;
      verifyState = "loading";
      resetTurnstile();
      updateSubmit();
    }
  });
})();
