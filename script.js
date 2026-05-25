(function () {
  const header = document.querySelector("[data-header]");
  const nav = document.querySelector("[data-nav]");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const copyButton = document.querySelector("[data-copy-code]");
  const quickstartCode = document.getElementById("quickstart-code");

  if (header) {
    const onScroll = () => {
      header.toggleAttribute("data-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  if (header && nav && navToggle) {
    const setOpen = (open) => {
      header.toggleAttribute("data-nav-open", open);
      navToggle.setAttribute("aria-expanded", String(open));
    };

    navToggle.addEventListener("click", () => {
      setOpen(!header.hasAttribute("data-nav-open"));
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });
  }

  if (copyButton && quickstartCode) {
    copyButton.addEventListener("click", async () => {
      const text = quickstartCode.textContent.trim();
      const original = copyButton.textContent;

      try {
        await navigator.clipboard.writeText(text);
        copyButton.textContent = "Copied";
      } catch (_) {
        copyButton.textContent = "Select";
      }

      window.setTimeout(() => {
        copyButton.textContent = original;
      }, 1300);
    });
  }
})();
