/* =========================================================
   SITE SETTINGS: paste your real links here.
   Any link left empty keeps its on-page fallback.
   ========================================================= */
const SITE = {
  calendly: "",          // e.g. "https://calendly.com/joshdillard/strategy-call"
  videoSite: "",         // your video production site
  social: {
    instagram: "",
    x: "",
    linkedin: "",
    youtube: "",
  },
};

(() => {
  // Booking buttons
  if (SITE.calendly) {
    document.querySelectorAll("[data-book]").forEach((a) => {
      a.href = SITE.calendly;
      a.target = "_blank";
      a.rel = "noopener";
    });
  }

  // Video production site link
  document.querySelectorAll("[data-video-site]").forEach((a) => {
    if (SITE.videoSite) {
      a.href = SITE.videoSite;
      a.target = "_blank";
      a.rel = "noopener";
    } else {
      a.parentElement.hidden = true;
    }
  });

  // Footer socials: hide any without a link
  document.querySelectorAll("[data-social]").forEach((a) => {
    const url = SITE.social[a.dataset.social];
    if (url) {
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
    } else {
      a.hidden = true;
    }
  });

  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  // Nav background on scroll
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Mobile menu
  const toggle = document.querySelector(".nav__toggle");
  const menu = document.querySelector(".nav__mobile");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.hidden = !open;
    nav.classList.toggle("is-scrolled", open || window.scrollY > 20);
  };
  toggle.addEventListener("click", () => setMenu(menu.hidden));
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

  // Remote preview images: a screenshot service or YouTube can answer with a small
  // placeholder instead of the real image. Retry once, fall back, or hide it so the
  // tile's own card shows instead.
  document.querySelectorAll("img[data-min-width]").forEach((img) => {
    const check = () => {
      if (img.naturalWidth >= Number(img.dataset.minWidth)) return;
      if (img.dataset.fallback) {
        const next = img.dataset.fallback;
        delete img.dataset.fallback;
        img.src = next;
      } else if ("retry" in img.dataset) {
        delete img.dataset.retry;
        setTimeout(() => (img.src = img.src + "&r=" + Date.now()), 6000);
      } else {
        img.remove();
      }
    };
    img.addEventListener("load", check);
    if (img.complete && img.naturalWidth) check();
  });

  // Video pop-up player
  const player = document.getElementById("player");
  if (player) {
    const frame = player.querySelector("iframe");
    const link = player.querySelector("[data-player-link]");
    document.querySelectorAll("[data-video]").forEach((btn) =>
      btn.addEventListener("click", () => {
        frame.src = btn.dataset.video;
        link.href = btn.dataset.videoLink || btn.dataset.video;
        player.querySelector("[data-player-source]").textContent = btn.dataset.videoSource || "the original site";
        player.classList.toggle("player--tall", btn.dataset.videoShape === "tall");
        player.showModal();
      })
    );
    player.addEventListener("close", () => (frame.src = ""));
    player.querySelector("[data-player-close]").addEventListener("click", () => player.close());
    player.addEventListener("click", (e) => { if (e.target === player) player.close(); });
  }

  // Reveal on scroll: only elements below the first screen wait to animate in
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const items = [...document.querySelectorAll(".reveal")].filter(
    (el) => el.getBoundingClientRect().top > window.innerHeight
  );
  items.forEach((el) => el.classList.add("is-pending"));
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        // stagger siblings that enter together
        const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
        el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 5) * 80}ms`;
        el.classList.remove("is-pending");
        io.unobserve(el);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  items.forEach((el) => io.observe(el));
})();
