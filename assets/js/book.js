/* Strategy call booking page: calendar, time slots and the request form.
   Settings live in SITE.booking (assets/js/config.js). */
(() => {
  const cfg = SITE.booking;
  const $ = (sel) => document.querySelector(sel);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const first = addDays(today, cfg.leadDays);
  const last = addDays(today, cfg.rangeDays);
  const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString();

  let view = new Date(first.getFullYear(), first.getMonth(), 1);
  let pickedDate = null;
  let pickedTime = null;

  const bookable = (d) => d >= first && d <= last && cfg.days.includes(d.getDay());

  // Short time zone name for the availability zone, e.g. "CST"
  const tzName = (() => {
    try {
      const part = new Intl.DateTimeFormat("en-US", { timeZone: cfg.timezone, timeZoneName: "short" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName");
      return part ? part.value : cfg.timezone;
    } catch {
      return cfg.timezone;
    }
  })();
  $("[data-tz-label]").textContent = `(${tzName})`;

  const fmtDate = (d) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const fmtTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  };
  const isoDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // ---- Calendar ----
  const grid = $("[data-cal-grid]");
  const prev = $("[data-cal-prev]");
  const next = $("[data-cal-next]");

  function renderCalendar() {
    $("[data-cal-month]").textContent = view.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    prev.disabled = view <= new Date(first.getFullYear(), first.getMonth(), 1);
    next.disabled = view >= new Date(last.getFullYear(), last.getMonth(), 1);

    grid.innerHTML = "";
    const lead = view.getDay();
    for (let i = 0; i < lead; i++) grid.append(document.createElement("span"));
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (let n = 1; n <= daysInMonth; n++) {
      const d = new Date(view.getFullYear(), view.getMonth(), n);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cal__day";
      b.textContent = n;
      b.setAttribute("aria-label", fmtDate(d));
      if (sameDay(d, today)) b.classList.add("is-today");
      if (!bookable(d)) {
        b.disabled = true;
      } else {
        b.addEventListener("click", () => pickDate(d));
      }
      if (sameDay(d, pickedDate)) {
        b.classList.add("is-picked");
        b.setAttribute("aria-pressed", "true");
      }
      grid.append(b);
    }
  }
  prev.addEventListener("click", () => {
    view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
    renderCalendar();
  });
  next.addEventListener("click", () => {
    view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    renderCalendar();
  });

  // ---- Time slots ----
  const slots = $("[data-slots]");
  function pickDate(d) {
    pickedDate = d;
    pickedTime = null;
    renderCalendar();
    $("[data-time-hint]").textContent = `Open times on ${fmtDate(d)}:`;
    slots.innerHTML = "";
    for (let m = cfg.startHour * 60; m + cfg.slotMinutes <= cfg.endHour * 60; m += cfg.slotMinutes) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "slot";
      b.textContent = fmtTime(m);
      b.addEventListener("click", () => {
        pickedTime = fmtTime(m);
        slots.querySelectorAll(".slot").forEach((s) => s.classList.toggle("is-picked", s === b));
        updateSummary();
        if (matchMedia("(max-width: 900px)").matches) $("#book-form").scrollIntoView({ behavior: "smooth" });
      });
      slots.append(b);
    }
    updateSummary();
  }

  const summary = $("[data-summary]");
  function updateSummary() {
    if (pickedDate && pickedTime) {
      summary.innerHTML = `<strong>${fmtDate(pickedDate)}</strong> at <strong>${pickedTime} ${tzName}</strong> &middot; 30 min`;
      summary.classList.add("is-set");
    } else {
      summary.textContent = pickedDate ? "Now pick a time." : "No time picked yet.";
      summary.classList.remove("is-set");
    }
  }

  // ---- Form ----
  const form = $("#book-form");
  const error = $("[data-error]");
  const showError = (msg) => {
    error.textContent = msg;
    error.hidden = false;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    if (!pickedDate || !pickedTime) return showError("Pick a day and a time first.");
    const missing = [...form.querySelectorAll("[required]")].find((f) => !f.value.trim());
    if (missing) {
      missing.focus();
      return showError(`Please fill in your ${missing.closest(".field").querySelector("span").textContent.replace(" *", "").toLowerCase()}.`);
    }
    if (!form.elements.email.checkValidity()) {
      form.elements.email.focus();
      return showError("That email address doesn't look right.");
    }

    const when = `${fmtDate(pickedDate)} at ${pickedTime} ${tzName}`;
    const done = $("[data-done]");

    if (!cfg.endpoint) {
      form.hidden = true;
      $("[data-done-kicker]").textContent = "Not sent";
      $("[data-done-title]").textContent = "Booking isn't connected yet.";
      $("[data-done-body]").textContent =
        `Your request for ${when} wasn't sent because this form isn't hooked up to an inbox yet. Please reach out to Josh directly.`;
      done.hidden = false;
      done.focus();
      return;
    }

    const data = new FormData(form);
    data.set("services", data.getAll("services").join(", ") || "Not specified");
    data.append("date", isoDate(pickedDate));
    data.append("time", `${pickedTime} ${tzName}`);
    data.append("requested", when);
    data.append("_subject", `Strategy call request: ${form.elements.name.value} — ${when}`);
    data.append("_replyto", form.elements.email.value);

    const btn = form.querySelector(".book__submit");
    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      const res = await fetch(cfg.endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      form.hidden = true;
      $("#step-date").hidden = true;
      $("#step-time").hidden = true;
      $("[data-done-body]").textContent =
        `Thanks, ${form.elements.name.value.split(" ")[0]}. Your request for ${when} is in. You'll get a confirmation by email or text within one business day.`;
      done.hidden = false;
      done.focus();
    } catch {
      btn.disabled = false;
      btn.innerHTML = 'Request this time <span aria-hidden="true">&rarr;</span>';
      showError("Your request didn't go through. Check your connection and try again.");
    }
  });

  renderCalendar();
})();
