(() => {
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

  // Brand assets gallery
  const lightbox = document.getElementById("lightbox");
  if (lightbox) {
    const img = lightbox.querySelector("img");
    const caption = lightbox.querySelector("[data-lb-caption]");
    const count = lightbox.querySelector("[data-lb-count]");
    let items = [];
    let index = 0;
    const show = (i) => {
      index = (i + items.length) % items.length;
      img.src = items[index].href;
      img.alt = items[index].text;
      caption.textContent = items[index].text;
      count.textContent = `${index + 1} / ${items.length}`;
    };
    document.querySelectorAll("[data-gallery]").forEach((btn) =>
      btn.addEventListener("click", () => {
        items = [...btn.querySelector("template").content.querySelectorAll("a")].map((a) => ({
          href: a.getAttribute("href"),
          text: a.textContent.trim(),
        }));
        show(0);
        lightbox.showModal();
      })
    );
    lightbox.querySelector("[data-lb-prev]").addEventListener("click", () => show(index - 1));
    lightbox.querySelector("[data-lb-next]").addEventListener("click", () => show(index + 1));
    lightbox.querySelector("[data-lb-close]").addEventListener("click", () => lightbox.close());
    lightbox.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.close(); });
    lightbox.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
    // swipe on phones
    let x0 = null;
    lightbox.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
    lightbox.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
      x0 = null;
    });
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
