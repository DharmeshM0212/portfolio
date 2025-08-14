document.addEventListener("DOMContentLoaded", async () => {
  const $ = (sel) => document.querySelector(sel);
  const grid = $("#grid");
  const empty = $("#emptyState");
  const searchInput = $("#searchInput");
  const sortSelect = $("#sortSelect");
  const tagPills = $("#tagPills");
  const year = $("#year");
  const themeToggle = $("#themeToggle");

  // Modal elements
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

  // THEME
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
  themeToggle.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });

  // LOAD PROJECTS
  let projects = [];
  try {
    const res = await fetch("projects.json", { cache: "no-store" });
    projects = await res.json();
  } catch (err) {
    console.error("Failed to load projects.json", err);
  }

  // State
  let search = "";
  let selectedTags = new Set();
  let sortMode = "new"; // new | old | az | za

  // Build tag list
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

  // Filter + Sort
  function filterSort(list) {
    let out = list;

    // Search
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

    // Tags
    if (selectedTags.size) {
      out = out.filter(p => {
        const t = new Set(p.tags || []);
        for (const tag of selectedTags) if (!t.has(tag)) return false;
        return true;
      });
    }

    // Sort
    const byTitle = (a, b) => a.title.localeCompare(b.title);
    const byDate = (a, b) => {
      // Expect ISO date string (YYYY-MM-DD). Fallback to title if missing.
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
    // Optional emoji field; else derive from first letter
    if (p.emoji) return p.emoji;
    const ch = (p.title || "?").trim().slice(0,1).toUpperCase();
    return ch.match(/[A-Z0-9]/) ? ch : "📦";
    }

  // Render grid
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

    // Attach handlers
    grid.querySelectorAll("[data-open]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-open");
        const proj = projects.find(x => String(x.id) === String(id));
        if (proj) openModal(proj);
      });
    });
  }

  // Modal logic
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

    // Deep link like #p=project-id
    const url = new URL(window.location.href);
    url.hash = `p=${encodeURIComponent(p.id || "")}`;
    history.replaceState(null, "", url.toString());

    modal.showModal();
  }

  function closeModal() {
    modal.close();
    // Remove deep link on close
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

  // Controls
  searchInput.addEventListener("input", () => { search = searchInput.value; update(); });
  sortSelect.addEventListener("change", () => { sortMode = sortSelect.value; update(); });

  function update() {
    render(filterSort(projects));
  }

  renderTags();
  update();

  // Open from deep-link if present (#p=ID)
  const hash = new URL(window.location.href).hash;
  if (hash.startsWith("#p=")) {
    const id = decodeURIComponent(hash.slice(3));
    const proj = projects.find(x => String(x.id) === String(id));
    if (proj) openModal(proj);
  }
});
