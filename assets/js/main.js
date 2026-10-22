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
