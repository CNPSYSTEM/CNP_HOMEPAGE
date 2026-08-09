/**
 * C&P SYSTEM — V1 Homepage
 * Phase 1: minimal vanilla JS only — nav toggle, scroll reveal,
 * and rendering the three data/*.json sources into their sections.
 */

(function () {
  "use strict";

  /* ---------- Mobile nav toggle ---------- */
  const navToggle = document.getElementById("nav-toggle");
  const mainNav = document.getElementById("main-nav");

  if (navToggle && mainNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    mainNav.addEventListener("click", (event) => {
      if (event.target.tagName === "A") {
        mainNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Scroll reveal ---------- */
  const revealTargets = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealTargets.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealTargets.forEach((el) => observer.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById("footer-year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* ---------- Data loading helper ---------- */
  async function loadJSON(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.status}`);
    }
    return response.json();
  }

  /* ---------- DESIGN / PORTFOLIO ---------- */
  const workGrid = document.getElementById("work-grid");

  loadJSON("data/portfolio.json")
    .then((data) => {
      const projects = data.projects || [];
      if (!workGrid) return;

      if (!projects.length) {
        workGrid.innerHTML = '<p class="work-empty">프로젝트 정보가 아직 준비 중입니다.</p>';
        return;
      }

      workGrid.innerHTML = projects
        .map(
          (project) => `
          <article class="work-card">
            <div class="work-card-media">
              ${project.image ? `<img src="${project.image}" alt="${project.title}" class="work-card-image" loading="lazy" />` : '<div class="image-placeholder" role="img" aria-label="이미지 (준비 중)"><span>[PLACEHOLDER IMAGE]</span></div>'}
            </div>
            <p class="work-card-title">${project.title}</p>
            <p class="work-card-meta">${project.scope}</p>
          </article>
        `
        )
        .join("");
    })
    .catch((err) => {
      console.warn(
        "[C&P] 포트폴리오 데이터를 불러오지 못했습니다. 로컬 서버(예: python3 -m http.server)로 실행 중인지 확인하세요.",
        err
      );
      if (workGrid) {
        workGrid.innerHTML =
          '<p class="work-empty">데이터를 불러오지 못했습니다. 로컬 서버로 실행해 주세요. (예: <code>python3 -m http.server</code>)</p>';
      }
    });

  /* ---------- PRINT ---------- */
  const capabilityGrid = document.getElementById("capability-grid");

  loadJSON("data/capability.json")
    .then((data) => {
      if (!capabilityGrid) return;
      const verifiedItems = (data.items || []).filter((item) => item.verified);
      capabilityGrid.innerHTML = verifiedItems
        .map((item) => `<li>${item.label}</li>`)
        .join("");
    })
    .catch((err) => {
      console.warn("[C&P] capability 데이터를 불러오지 못했습니다.", err);
    });

  /* ---------- SELECTED CLIENTS (hidden until verified data exists) ---------- */
  const clientsSection = document.getElementById("clients");
  const clientsGrid = document.getElementById("clients-grid");
  const navClientsItem = document.querySelector(".nav-clients");

  loadJSON("data/clients.json")
    .then((data) => {
      const clients = data.clients || [];
      if (!clients.length) return; // stays hidden

      if (clientsGrid) {
        clientsGrid.innerHTML = clients
          .map((client) => `<li>${client.name}</li>`)
          .join("");
      }
      if (clientsSection) clientsSection.hidden = false;
      if (navClientsItem) navClientsItem.hidden = false;
    })
    .catch((err) => {
      console.warn("[C&P] clients 데이터를 불러오지 못했습니다.", err);
    });
})();
