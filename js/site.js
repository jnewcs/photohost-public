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
  let turnstileWidgetId = null;

  const mountTurnstile = () => {
    if (!turnstileContainer || turnstileWidgetId !== null) return;
    if (!window.turnstile) {
      window.setTimeout(mountTurnstile, 200);
      return;
    }
    turnstileWidgetId = window.turnstile.render(turnstileContainer, {
      sitekey: config.turnstileSiteKey,
      theme: "light",
    });
  };
  mountTurnstile();

  // Contact form
  const form = $("#contact-form");
  if (!form) return;

  const status = $("#form-status");
  const submit = $("#contact-submit");
  let startedAt = performance.now();
  let sending = false;
  const showStatus = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
  };

  const resetTurnstile = () => {
    if (turnstileWidgetId !== null && window.turnstile) {
      window.turnstile.reset(turnstileWidgetId);
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;

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
      showStatus("Please complete the verification below before sending.", "error");
      return;
    }

    const data = new FormData(form);
    data.set("turnstile_token", token);
    data.set("elapsed_ms", String(Math.round(performance.now() - startedAt)));

    sending = true;
    submit.disabled = true;
    submit.textContent = "Sending…";

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

      showStatus("Thank you! Your inquiry is on its way. I'll be in touch soon.", "success");
      form.reset();
      startedAt = performance.now();
    } catch (error) {
      const message = error.name === "AbortError"
        ? "The message took too long to send. Please try again."
        : error.message;
      showStatus(message, "error");
    } finally {
      window.clearTimeout(timeout);
      sending = false;
      submit.disabled = false;
      submit.textContent = "Send inquiry";
      resetTurnstile();
    }
  });
})();
