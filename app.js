// Footer year follows the visitor's clock, so it never needs editing.
document.querySelectorAll("[data-year]").forEach(el => { el.textContent = new Date().getFullYear(); });

(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // photographs can't be saved with right-click or dragged out of the page
  const isPhoto = (t) => t && (t.tagName === "IMG" || (t.closest && t.closest(".open, .m-tile, .lb, .w-card, .c-img")));
  document.addEventListener("contextmenu", (e) => { if (isPhoto(e.target)) e.preventDefault(); });
  document.addEventListener("dragstart", (e) => { if (e.target.tagName === "IMG") e.preventDefault(); });

  // =====================================================================
  // Start page: moving mosaic.
  // Watches live in two "watch columns" that move in step, half a cycle apart.
  // Each watch column holds one watch per cycle, and a cycle is a little shorter
  // than screen + one watch, so every column always shows a watch:
  // 2 watches on screen at any moment (briefly 3 while one leaves and the next enters).
  // =====================================================================
  const mosaic = document.querySelector(".mosaic");
  const mData = document.getElementById("mosaic-data");
  if (mosaic && mData) {
    const data = JSON.parse(mData.textContent);
    const srcset = (p) => p.widths.map((w) => `${p.src}-${w}.webp ${w}w`).join(", ");
    const tile = (p, colW, height) => {
      const t = document.createElement("span");
      t.className = "m-tile";
      t.style.height = height.toFixed(1) + "px";
      const im = new Image();
      im.decoding = "async";
      im.loading = "eager";
      im.sizes = Math.ceil(colW) + "px";
      im.srcset = srcset(p);
      im.alt = "";
      t.appendChild(im);
      return t;
    };

    let built = "";
    const build = () => {
      const W = innerWidth, H = innerHeight;
      const ncol = W >= 1000 ? 4 : W >= 640 ? 3 : 2;
      const key = `${ncol}:${Math.round(W / 50)}:${Math.round(H / 50)}`;
      if (key === built) return;
      built = key;
      mosaic.innerHTML = "";

      const g = Math.max(6, Math.min(12, W * 0.008));
      mosaic.style.setProperty("--g", g + "px");
      const colW = (W - g * (ncol + 1)) / ncol;
      const watchCols = ncol === 4 ? [1, 3] : ncol === 3 ? [0, 2] : [0, 1];
      const th = colW * 1.25;                       // watch tile, 4:5
      const L = H + th - 0.1 * H;                   // one cycle per watch column
      let m = Math.max(1, Math.round((L - th - g) / (colW * 1.1 + g)));
      let vh = (L - th - g - m * g) / m;            // filler height so the cycle is exactly L
      while (vh < colW * 0.55 && m > 1) { m--; vh = (L - th - g - m * g) / m; }
      const watches = data.watch.length ? data.watch : data.view;
      const K = Math.max(2, Math.ceil(watches.length / 2));
      const speed = H / 38;                         // px per second
      let v = 0;
      const nextView = () => data.view[v++ % data.view.length];

      for (let c = 0; c < ncol; c++) {
        const col = document.createElement("div");
        col.className = "m-col";
        const run = document.createElement("div");
        run.className = "m-run";
        const isWatch = watchCols.includes(c);
        const seq = [];                             // [photo, height]
        if (isWatch) {
          const w0 = watchCols.indexOf(c);
          for (let k = 0; k < K; k++) {
            seq.push([watches[(k * 2 + w0) % watches.length], th]);
            for (let i = 0; i < m; i++) seq.push([nextView(), vh]);
          }
        } else {
          let len = 0;
          while (len < H * 1.6) { const p = nextView(); const h = colW * p.h / p.w; seq.push([p, h]); len += h + g; }
        }
        const len = seq.reduce((s, [, h]) => s + h + g, 0);
        for (let r = 0; r < 2; r++) seq.forEach(([p, h]) => run.appendChild(tile(p, colW, h)));   // twice: seamless loop
        run.style.setProperty("--len", len + "px");
        const sp = isWatch ? speed : speed * (c === 0 ? 0.85 : 1.15);
        run.style.setProperty("--dur", (len / sp).toFixed(2) + "s");
        run.style.setProperty("--anim", isWatch ? "m-up" : "m-down");
        if (isWatch && watchCols.indexOf(c) === 1) run.style.setProperty("--delay", (-(L / 2) / sp).toFixed(2) + "s");
        if (reduced) run.style.animation = "none";
        col.appendChild(run);
        mosaic.appendChild(col);
      }
    };
    build();
    let rt;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(build, 250); });

  }

  // =====================================================================
  // Galleries: minute track + full-screen viewer
  // =====================================================================
  const dataEl = document.getElementById("photos");
  if (!dataEl) return;
  const photos = JSON.parse(dataEl.textContent);
  const units = [...document.querySelectorAll(".unit")].sort((a, b) => a.dataset.u - b.dataset.u);
  const pageTrack = document.querySelector(".page-track .track");
  const lb = document.querySelector(".lb");
  const lbImg = lb.querySelector(".lb-img");
  const lbCap = lb.querySelector(".lb-cap");
  const lbTrack = lb.querySelector(".track");

  const setTrack = (track, i) => {
    track.querySelector(".track-now").textContent = i + 1;
    track.querySelectorAll(".tick").forEach((t, n) => {
      if (n === i) {
        t.setAttribute("aria-current", "true");
        const box = t.parentElement;
        if (t.offsetLeft < box.scrollLeft || t.offsetLeft > box.scrollLeft + box.clientWidth - 20)
          box.scrollLeft = t.offsetLeft - box.clientWidth / 2;
      } else t.removeAttribute("aria-current");
    });
  };

  // which unit is nearest the middle of the screen
  const visible = new Set();
  const pick = () => {
    let best = null, bestD = Infinity;
    const mid = innerHeight / 2;
    visible.forEach((el) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestD) { bestD = d; best = el; }
    });
    if (best) setTrack(pageTrack, +best.dataset.u);
  };
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
    pick();
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  units.forEach((el) => io.observe(el));
  addEventListener("scroll", () => requestAnimationFrame(pick), { passive: true });
  setTrack(pageTrack, 0);
  pageTrack.addEventListener("click", (e) => {
    const t = e.target.closest(".tick");
    if (t) units[+t.dataset.i].scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
  });

  let at = 0, busy = false;
  const srcset = (p) => p.widths.map((w) => `${p.src}-${w}.webp ${w}w`).join(", ");
  // the viewer shows a photo no wider than the screen and no taller than the screen minus the bars
  const lbSizes = (p) => `min(100vw, calc((100vh - 9rem) * ${(p.w / p.h).toFixed(3)}))`;
  const preload = (i) => {
    const p = photos[(i + photos.length) % photos.length];
    const im = new Image(); im.sizes = lbSizes(p); im.srcset = srcset(p);
  };
  const thumbOf = (i) => document.querySelector(`.open[data-p="${i}"] img`);

  // show photo i; start from the already-loaded thumbnail, swap to the sharp version when it arrives
  const show = (i) => {
    at = (i + photos.length) % photos.length;
    const p = photos[at];
    const t = thumbOf(at);
    lbImg.removeAttribute("srcset");
    lbImg.src = (t && t.currentSrc) || `${p.src}-${p.widths[0]}.webp`;
    lbImg.width = p.w; lbImg.height = p.h;
    lbImg.alt = p.c || `Photograph ${at + 1} of ${photos.length}`;
    lbCap.textContent = p.c || "";
    setTrack(lbTrack, at);
    const hi = new Image();
    hi.sizes = lbSizes(p); hi.srcset = srcset(p);
    const want = at;
    hi.onload = () => { if (want === at) { lbImg.sizes = hi.sizes; lbImg.srcset = hi.srcset; } };
    preload(at + 1); preload(at - 1);
  };

  const EASE = "cubic-bezier(.22,.7,.18,1)";
  // transform that puts the viewer image exactly over a thumbnail
  const fromThumb = (t) => {
    const r0 = (t.closest(".open") || t).getBoundingClientRect(), r1 = lbImg.getBoundingClientRect();
    if (!r0.width || !r1.width) return null;
    const sc = Math.sqrt((r0.width * r0.height) / (r1.width * r1.height));
    const dx = r0.left + r0.width / 2 - (r1.left + r1.width / 2);
    const dy = r0.top + r0.height / 2 - (r1.top + r1.height / 2);
    return `translate(${dx}px, ${dy}px) scale(${sc})`;
  };
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };

  const open = (i) => {
    if (busy) return;
    show(i);
    lb.showModal();
    if (reduced) return;
    const t = thumbOf(at);
    const tr = t && inView(t) ? fromThumb(t) : null;
    lb.animate([{ backgroundColor: "transparent" }, { backgroundColor: getComputedStyle(lb).backgroundColor }], { duration: 450, easing: "ease-out" });
    lb.querySelectorAll(".lb-cap, .lb-close, .lb-btn, .track").forEach((el) =>
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, delay: 250, easing: "ease-out", fill: "backwards" }));
    if (tr) {
      if (t) t.style.visibility = "hidden";
      lbImg.animate([{ transform: tr }, { transform: "none" }], { duration: 550, easing: EASE })
        .finished.then(() => { if (t) t.style.visibility = ""; });
    } else {
      lbImg.animate([{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 450, easing: EASE });
    }
  };

  const close = () => {
    if (busy || !lb.open) return;
    const t = thumbOf(at);
    if (t && !inView(t)) t.closest(".open").scrollIntoView({ block: "center" });
    const done = () => {
      busy = false;
      lb.close();
      if (t) { t.style.visibility = ""; t.closest(".open").focus({ preventScroll: true }); }
    };
    if (reduced) return done();
    busy = true;
    const tr = t ? fromThumb(t) : null;
    lb.querySelectorAll(".lb-cap, .lb-close, .lb-btn, .track").forEach((el) =>
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).finished.then((a) => a.cancel()));
    lb.animate([{ backgroundColor: getComputedStyle(lb).backgroundColor }, { backgroundColor: "transparent" }], { duration: 450, easing: "ease-in", fill: "forwards" })
      .finished.then((a) => a.cancel());
    const anim = tr
      ? lbImg.animate([{ transform: "none" }, { transform: tr }], { duration: 480, easing: EASE, fill: "forwards" })
      : lbImg.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(.96)" }], { duration: 350, easing: "ease-in", fill: "forwards" });
    if (tr && t) setTimeout(() => (t.style.visibility = "hidden"), 0);
    anim.finished.then(() => { anim.cancel(); done(); });
  };

  document.querySelectorAll(".open").forEach((b) => b.addEventListener("click", () => open(+b.dataset.p)));
  lbImg.addEventListener("click", close);                                       // click the photo to close
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });       // or the empty space around it
  lb.querySelector(".lb-prev").addEventListener("click", () => show(at - 1));
  lb.querySelector(".lb-next").addEventListener("click", () => show(at + 1));
  lb.querySelector(".lb-close").addEventListener("click", close);
  lbTrack.addEventListener("click", (e) => {
    const t = e.target.closest(".tick");
    if (t) show(+t.dataset.i);
  });
  lb.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") show(at + 1);
    else if (e.key === "ArrowLeft") show(at - 1);
  });
  let x0 = null;
  lb.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(at + (dx < 0 ? 1 : -1));
    x0 = null;
  });
})();
