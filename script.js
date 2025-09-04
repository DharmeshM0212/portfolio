document.addEventListener("DOMContentLoaded", async () => {
  const $ = (sel) => document.querySelector(sel);

  // ----- Common: year + theme -----
  const themeToggle = $("#themeToggle");
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  const setTheme = (t) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("theme", t);
    if (themeToggle) {
      themeToggle.textContent = t === "dark" ? "☀️" : "🌙";
      themeToggle.setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
    }
  };
  setTheme(localStorage.getItem("theme") || "light");
  themeToggle?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(cur === "light" ? "dark" : "light");
  });

  // ----- Helper: safe JSON fetch -----
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

  // ===============================
  // HOME (index): Latest projects
  // ===============================
  const latestList = document.querySelector("#latestList");
  if (latestList){
    const projects = await loadJSON("projects.json") || [];
    const items = projects
      .filter(p => p.date)
      .sort((a,b) => (new Date(b.date)) - (new Date(a.date)))
      .slice(0, 5);

    const fmt = (iso) => {
      try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
      catch { return iso; }
    };

    latestList.innerHTML = items.length ? items.map(p => `
      <li>
        <a href="projects.html#p=${encodeURIComponent(p.id)}">${p.title || "Untitled Project"}</a>
        <span class="latest-date">${fmt(p.date)}</span>
      </li>
    `).join("") : `<li class="muted">No recent projects yet.</li>`;
  }

  // ==================================
  // PROJECTS page (only if #grid exists)
  // ==================================
  const grid = $("#grid");
  if (grid) {
    const featuredGrid = $("#featuredGrid");
    const empty = $("#emptyState");
    const sortSelect = $("#sortSelect");
    const tagPills = $("#tagPills");
    const toggleTagsBtn = $("#toggleTags");

    // Modal bits
    const modal = $("#projectModal");
    const modalTitle = $("#modalTitle");
    const modalSubtitle = $("#modalSubtitle");
    const modalDesc = $("#modalDesc");
    const modalTags = $("#modalTags");
    const modalHighlights = $("#modalHighlights");
    const modalGithub = $("#modalGithub");
    const modalDemo = $("#modalDemo");
    const modalCopyLink = $("#modalCopyLink");
    const modalClose = modal?.querySelector(".modal-close");
    const modalLogo = $("#modalLogo");

    const projects = await loadJSON("projects.json") || [];

    // State
    let search = "";
    let selectedTags = new Set();
    let sortMode = "new";

    // Build tag list
    const allTags = Array.from(new Set(projects.flatMap(p => Array.isArray(p.tags) ? p.tags : []))).sort((a, b) => a.localeCompare(b));

    // Tag UI (collapsible)
    let tagsCollapsed = true;
    function applyTagCollapse(){
      if (!tagPills) return;
      tagPills.classList.toggle("collapsed", tagsCollapsed);
      toggleTagsBtn?.setAttribute("aria-expanded", String(!tagsCollapsed));
      if (toggleTagsBtn) toggleTagsBtn.textContent = tagsCollapsed ? "Show more" : "Show less";
    }
    function renderTags(){
      if (!tagPills) return;
      tagPills.innerHTML = allTags.map(tag => `
        <button class="pill${selectedTags.has(tag) ? " active" : ""}" data-tag="${tag}">${tag}</button>
      `).join("");
      tagPills.querySelectorAll(".pill").forEach(btn => {
        btn.addEventListener("click", () => {
          const t = btn.dataset.tag;
          if (selectedTags.has(t)) selectedTags.delete(t); else selectedTags.add(t);
          btn.classList.toggle("active");
          update();
        });
      });
      applyTagCollapse();
    }
    toggleTagsBtn?.addEventListener("click", () => { tagsCollapsed = !tagsCollapsed; applyTagCollapse(); });

    // Helpers
    function projectEmoji(p){
      if (p.emoji) return p.emoji;
      const ch = (p.title || "?").trim().slice(0,1).toUpperCase();
      return ch.match(/[A-Z0-9]/) ? ch : "📦";
    }
    function cardMarkup(p){
      return `
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
          ${Array.isArray(p.metrics) && p.metrics.length ? `<ul class="metrics">${p.metrics.map(m => `<li>${m}</li>`).join("")}</ul>` : ``}
          <div class="actions">
            <a class="btn" target="_blank" rel="noreferrer" href="${p.github || '#'}">GitHub</a>
            <button class="btn primary" data-open="${p.id || ""}">Details</button>
          </div>
        </article>`;
    }

    // Filters & sort
    function filterSort(list){
      let out = list;
      const input = document.querySelector("#searchInput");
      search = (input?.value || "").trim();

      if (search){
        const q = search.toLowerCase();
        out = out.filter(p => {
          const hay = [p.title, p.subtitle, p.description, ...(p.tags || [])].filter(Boolean).join(" ").toLowerCase();
          return hay.includes(q);
        });
      }
      if (selectedTags.size){
        out = out.filter(p => {
          const tset = new Set(p.tags || []);
          for (const t of selectedTags) if (!tset.has(t)) return false;
          return true;
        });
      }
      const byTitle = (a,b)=>(a.title||"").localeCompare(b.title||"");
      const byDate = (a,b)=> (new Date(b.date||0)) - (new Date(a.date||0));
      if (sortMode==="new") out = out.slice().sort(byDate);
      if (sortMode==="old") out = out.slice().sort((a,b)=>-byDate(a,b));
      if (sortMode==="az") out = out.slice().sort(byTitle);
      if (sortMode==="za") out = out.slice().sort((a,b)=>-byTitle(a,b));
      return out;
    }

    function render(list){
      if (!list.length){ grid.innerHTML = ""; empty?.classList.remove("hidden"); return; }
      empty?.classList.add("hidden");
      grid.innerHTML = list.map(cardMarkup).join("");
      grid.querySelectorAll("[data-open]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const id = btn.getAttribute("data-open");
          const proj = projects.find(x => String(x.id) === String(id));
          if (proj) openModal(proj);
        });
      });
    }

    // Modal logic
    function openModal(p){
      if (!modal) return;
      modalTitle.textContent = p.title || "Untitled Project";
      modalSubtitle.textContent = p.subtitle || "";
      modalDesc.textContent = p.longDescription || p.description || "";
      modalTags.innerHTML = (p.tags || []).map(t => `<span class="pill">${t}</span>`).join("");
      modalHighlights.innerHTML = (p.highlights || []).map(h => `<li>${h}</li>`).join("");
      modalGithub.href = p.github || "#";
      modalLogo.textContent = projectEmoji(p);
      if (p.demo){ modalDemo.classList.remove("hidden"); modalDemo.href = p.demo; }
      else { modalDemo.classList.add("hidden"); modalDemo.removeAttribute("href"); }

      const url = new URL(window.location.href); url.hash = `p=${encodeURIComponent(p.id||"")}`;
      history.replaceState(null,"",url.toString());
      modal.showModal();
    }
    function closeModal(){
      modal?.close();
      const url = new URL(window.location.href);
      if (url.hash.startsWith("#p=")) url.hash = "";
      history.replaceState(null,"",url.toString());
    }
    modalClose?.addEventListener("click", closeModal);
    modal?.addEventListener("click", e => {
      const rect = modal.querySelector(".modal-card").getBoundingClientRect();
      const inDialog = rect.top <= e.clientY && e.clientY <= rect.top+rect.height && rect.left <= e.clientX && e.clientX <= rect.left+rect.width;
      if (!inDialog) closeModal();
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && modal?.open) closeModal(); });
    modalCopyLink?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(window.location.href); modalCopyLink.textContent="Copied!"; setTimeout(()=>modalCopyLink.textContent="Copy link",1200); } catch {}
    });

    // Inputs
    document.querySelector("#searchInput")?.addEventListener("input", ()=>{ render(filterSort(projects)); });
    sortSelect?.addEventListener("change", ()=>{ sortMode = sortSelect.value; render(filterSort(projects)); });

    renderTags();
    render(filterSort(projects));

    // Deep-link open
    const hash = new URL(window.location.href).hash;
    if (hash.startsWith("#p=")){
      const id = decodeURIComponent(hash.slice(3));
      const proj = projects.find(x => String(x.id) === String(id));
      if (proj) openModal(proj);
    }

    // Featured row — prefer JSON flag, else fallback to manual IDs
    if (featuredGrid){
      const byDate = (a,b)=> (new Date(b.date||0)) - (new Date(a.date||0));
      let featured = projects.filter(p => p.featured === true).sort(byDate);

      if (!featured.length){
        const featuredIds = ["jittertuner","videx","audio_test"]; // fallback order
        featured = projects.filter(p => featuredIds.includes(String(p.id)));
      }

      featuredGrid.innerHTML = featured.map(cardMarkup).join("");
      featuredGrid.querySelectorAll("[data-open]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const id = btn.getAttribute("data-open");
          const proj = projects.find(x => String(x.id) === String(id));
          if (proj) openModal(proj);
        });
      });
    }
  } // end Projects page

  // ==================================
  // CERTIFICATIONS page (if present)
  // ==================================
  const certList = document.querySelector("#certList");
  if (certList){
    const certEmpty = document.querySelector("#certEmpty");
    const certs = await loadJSON("certifications.json") || [];
    if (!certs.length) certEmpty?.classList.remove("hidden");
    certList.innerHTML = certs.map(c=>`
      <li>
        <div class="row">
          <strong>${c.name || ""}</strong>
          ${c.shortDescription ? `<span class="meta">· ${c.shortDescription}</span>` : ""}
          ${c.link ? `<a href="${c.link}" target="_blank" rel="noreferrer">Verify</a>` : ""}
        </div>
      </li>`).join("");
  }

  // ==================================
  // PUBLICATIONS page (if present)
  // ==================================
  const pubList = document.querySelector("#pubList");
  if (pubList){
    const pubEmpty = document.querySelector("#pubEmpty");
    const pubs = await loadJSON("publications.json") || [];
    if (!pubs.length) pubEmpty?.classList.remove("hidden");
    pubList.innerHTML = pubs.map(p=>`
      <li>
        <div class="row">
          <strong>${p.name || ""}</strong>
          ${p.venue ? `<span class="meta">· ${p.venue}</span>` : ""}
          ${p.link ? `<a href="${p.link}" target="_blank" rel="noreferrer">Link</a>` : ""}
        </div>
      </li>`).join("");
  }
});
