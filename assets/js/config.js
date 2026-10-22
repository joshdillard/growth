/* =========================================================
   SITE SETTINGS: paste your real links here.
   Any link left empty keeps its on-page fallback.
   ========================================================= */
const SITE = {
  videoSite: "",         // your video production site
  social: {
    instagram: "",
    x: "",
    linkedin: "",
    youtube: "",
  },

  // Strategy call booking page (book.html)
  booking: {
    // Where booking requests are sent. Create a free form at https://formspree.io
    // and paste its endpoint here, e.g. "https://formspree.io/f/abcdwxyz".
    // Until this is set, the page shows visitors that booking isn't connected yet.
    endpoint: "",
    timezone: "America/Chicago", // the time zone your availability is in
    days: [1, 2, 3, 4, 5],       // 0 = Sunday ... 6 = Saturday
    startHour: 9,                // first call slot (24h clock)
    endHour: 17,                 // calls end by this hour
    slotMinutes: 30,
    leadDays: 1,                 // earliest bookable day, counted from today
    rangeDays: 60,               // how far ahead people can book
  },
};
