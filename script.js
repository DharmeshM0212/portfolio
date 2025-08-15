document.addEventListener("DOMContentLoaded", async () => {
  const $ = (sel) => document.querySelector(sel);
  const grid = $("#grid");
  const empty = $("#emptyState");
  const searchInput = $("#searchInput");
  const sortSelect = $("#sortSelect");
  const tagPills = $("#tagPills");
  const year = $("#year");
  const themeToggle = $("#themeToggle");

  
  const modal = $("#projectModal");
  const modalTitle = $("#modalTitle");
  const modalSubtitle = $("#modalSubtitle");
  const modalDesc = $("#modalDesc");
  const modalTags = $("#modalTags");
  const modalHighlights = $("#modalHighlights");
  const modalGithub = $("#modalGithub");
  const modalDemo = $("#modalDemo");
  const modalCopyLink = $("#modalCopyLink");
  const modalClose = modal.querySelector(".modal-close");
  const modalLogo = $("#modalLogo");

  year.textContent = new Date().getFullYear();

  
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
  themeToggle?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });

  
  let projects = [];
  try {
    const res = await fetch("projects.json", { cache: "no-store" });
    projects = await res.json();
  } catch (err) {
    console.error("Failed to load projects.json", err);
  }

  
  let search = "";
  let selectedTags = new Set();
  let sortMode = "new";

  
  const allTags = Array.from(
    new Set(projects.flatMap(p => Array.isArray(p.tags) ? p.tags : []))
  ).sort((a, b) => a.localeCompare(b));

  function renderTags() {
    tagPills.innerHTML = allTags.map(tag => `
      <button class="pill${selectedTags.has(tag) ? " active" : ""}" data-tag="${tag}">
        ${tag}
      </button>
    `).join("");
    tagPills.querySelectorAll(".pill").forEach(btn => {
      btn.addEventListener("click", () => {
        const t = btn.dataset.tag;
        if (selectedTags.has(t)) selectedTags.delete(t); else selectedTags.add(t);
        btn.classList.toggle("active");
        update();
      });
    });
  }

  
  function filterSort(list) {
    let out = list;
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(p => {
        const hay = [
          p.title, p.subtitle, p.description,
          ...(p.tags || [])
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    if (selectedTags.size) {
      out = out.filter(p => {
        const t = new Set(p.tags || []);
        for (const tag of selectedTags) if (!t.has(tag)) return false;
        return true;
      });
    }
    const byTitle = (a, b) => a.title.localeCompare(b.title);
    const byDate = (a, b) => {
      if (!a.date && !b.date) return byTitle(a, b);
      return (new Date(b.date || 0)) - (new Date(a.date || 0));
    };
    if (sortMode === "new") out = out.slice().sort(byDate);
    if (sortMode === "old") out = out.slice().sort((a, b) => -byDate(a, b));
    if (sortMode === "az") out = out.slice().sort(byTitle);
    if (sortMode === "za") out = out.slice().sort((a, b) => -byTitle(a, b));
    return out;
  }

  function projectEmoji(p) {
    if (p.emoji) return p.emoji;
    const ch = (p.title || "?").trim().slice(0,1).toUpperCase();
    return ch.match(/[A-Z0-9]/) ? ch : "📦";
  }

  function render(list) {
    if (!list.length) {
      grid.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    grid.innerHTML = list.map(p => `
      <article class="card" role="listitem">
        <div class="header">
          <div class="emoji">${projectEmoji(p)}</div>
          <div>
            <h3>${p.title || "Untitled Project"}</h3>
            <div class="subtitle">${p.subtitle || ""}</div>
          </div>
        </div>
        <p class="desc">${p.description || ""}</p>
        <div class="tags pills compact">
          ${(p.tags || []).map(t => `<span class="pill" tabindex="-1">${t}</span>`).join("")}
        </div>
        <div class="actions">
          <a class="btn" target="_blank" rel="noreferrer" href="${p.github || '#'}">GitHub</a>
          <button class="btn primary" data-open="${p.id || ""}">Details</button>
        </div>
      </article>
    `).join("");

    grid.querySelectorAll("[data-open]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-open");
        const proj = projects.find(x => String(x.id) === String(id));
        if (proj) openModal(proj);
      });
    });
  }

  
  function openModal(p) {
    modalTitle.textContent = p.title || "Untitled Project";
    modalSubtitle.textContent = p.subtitle || "";
    modalDesc.textContent = p.longDescription || p.description || "";
    modalTags.innerHTML = (p.tags || []).map(t => `<span class="pill">${t}</span>`).join("");
    modalHighlights.innerHTML = (p.highlights || []).map(h => `<li>${h}</li>`).join("");
    modalGithub.href = p.github || "#";
    modalLogo.textContent = projectEmoji(p);

    if (p.demo) {
      modalDemo.classList.remove("hidden");
      modalDemo.href = p.demo;
    } else {
      modalDemo.classList.add("hidden");
      modalDemo.removeAttribute("href");
    }

    const url = new URL(window.location.href);
    url.hash = `p=${encodeURIComponent(p.id || "")}`;
    history.replaceState(null, "", url.toString());

    modal.showModal();
  }

  function closeModal() {
    modal.close();
    const url = new URL(window.location.href);
    if (url.hash.startsWith("#p=")) url.hash = "";
    history.replaceState(null, "", url.toString());
  }

  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    const rect = modal.querySelector(".modal-card").getBoundingClientRect();
    const inDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                     rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
    if (!inDialog) closeModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.open) closeModal();
  });

  modalCopyLink.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      modalCopyLink.textContent = "Copied!";
      setTimeout(() => modalCopyLink.textContent = "Copy link", 1200);
    } catch {}
  });

  
  searchInput.addEventListener("input", () => { search = searchInput.value; update(); });
  sortSelect.addEventListener("change", () => { sortMode = sortSelect.value; update(); });

  function update() { render(filterSort(projects)); }

  renderTags();
  update();

  const hash = new URL(window.location.href).hash;
  if (hash.startsWith("#p=")) {
    const id = decodeURIComponent(hash.slice(3));
    const proj = projects.find(x => String(x.id) === String(id));
    if (proj) openModal(proj);
  }

  
  const certList = $("#certList");
  const pubList = $("#pubList");
  const certEmpty = $("#certEmpty");
  const pubEmpty = $("#pubEmpty");

  async function loadJSON(url) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error("Fetch failed");
      return await r.json();
    } catch (e) {
      console.warn("Could not load", url, e);
      return null;
    }
  }

  function renderCerts(arr) {
    if (!certList || !Array.isArray(arr)) return;
    if (!arr.length) { certEmpty?.classList.remove("hidden"); return; }
    certEmpty?.classList.add("hidden");
    certList.innerHTML = arr.map(c => `
      <li>
        <div class="row">
          <strong>${c.name || ""}</strong>
          ${c.shortDescription ? `<span class="meta">· ${c.shortDescription}</span>` : ""}
          ${c.link ? `<a href="${c.link}" target="_blank" rel="noreferrer">Verify</a>` : ""}
        </div>
      </li>
    `).join("");
  }

  function renderPubs(arr) {
    if (!pubList || !Array.isArray(arr)) return;
    if (!arr.length) { pubEmpty?.classList.remove("hidden"); return; }
    pubEmpty?.classList.add("hidden");
    pubList.innerHTML = arr.map(p => `
      <li>
        <div class="row">
          <strong>${p.name || ""}</strong>
          ${p.venue ? `<span class="meta">· ${p.venue}</span>` : ""}
          ${p.link ? `<a href="${p.link}" target="_blank" rel="noreferrer">Link</a>` : ""}
        </div>
      </li>
    `).join("");
  }

  loadJSON("certifications.json").then(data => data && renderCerts(data));
  loadJSON("publications.json").then(data => data && renderPubs(data));
});
