// Vault App Registry (loaded dynamically from Electron)
let vaultApps = [];

async function loadVaultApps() {
  try {
    const response = await fetch("../tools/tools.json");
    const data = await response.json();
    vaultApps = data.tools || [];
  } catch (err) {
    console.error("Failed to load tools.json", err);
  }
}

const setAppVersion = async () => {
  const el = document.getElementById("appVersion");
  if (!el) return;

  try {
    if (window.vault && window.vault.getVersion) {
      const v = await window.vault.getVersion();
      el.textContent = `Version ${v || ""}`;
    }
  } catch (err) {
    el.textContent = "Version";
  }
};

function getDetailsContainer() {
  return document.getElementById('detailsContent');
}

function renderEmptyDetails() {
  const el = getDetailsContainer();
  if (!el) return;
  el.innerHTML = '<div class="details-empty">Select <strong>Details</strong> on any Vault app to view more information here.</div>';
}

function renderAppDetails(app) {
  const el = getDetailsContainer();
  if (!el) return;

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div style="font-size:16px;font-weight:700;">${app.name}</div>
      <div style="font-size:13px;color:#9ca3af;">${app.description}</div>
      <div style="font-size:12px;color:#9ca3af;">
        <div><strong>Entry:</strong> ${app.entry}</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:6px;">
        <button id="detailsLaunchBtn" class="vault-btn primary">Launch</button>
        <button id="detailsCopyPathBtn" class="vault-btn secondary">Copy Entry Path</button>
      </div>
    </div>
  `;

  const frame = document.querySelector('.vault-frame');
  const launchBtn = document.getElementById('detailsLaunchBtn');
  const copyBtn = document.getElementById('detailsCopyPathBtn');

  if (launchBtn) {
    launchBtn.addEventListener('click', () => {
      if (frame) frame.src = app.entry;
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(app.entry);
        copyBtn.textContent = 'Copied';
        setTimeout(() => (copyBtn.textContent = 'Copy Entry Path'), 900);
      } catch {
        copyBtn.textContent = 'Copy failed';
        setTimeout(() => (copyBtn.textContent = 'Copy Entry Path'), 900);
      }
    });
  }
}

// Generate dashboard cards
function renderVaultApps() {
  const container = document.querySelector(".vault-cards");

  if (!container) return;

  container.innerHTML = "";

  vaultApps.forEach(app => {
    const card = document.createElement("div");
    card.className = "vault-card";
    card.dataset.appName = app.name;
    card.addEventListener("click", (e) => {
      // Ignore clicks coming from action buttons
      if (e.target.closest('.card-actions')) return;

      document.querySelectorAll(".vault-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      window.__selectedVaultApp = app;
    });

    const iconHtml = app.icon ? `<img src="${app.icon}" class="card-icon" />` : "";

    card.innerHTML = `
      <div class="card-header">
        ${iconHtml}
        <div class="card-title">${app.name}</div>
      </div>
      <div class="card-desc">${app.description}</div>
      <div class="card-actions">
        <button class="vault-btn primary">Launch</button>
        <button class="vault-btn secondary">Details</button>
      </div>
    `;

    const launchBtn = card.querySelector(".primary");

    launchBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const frame = document.querySelector(".vault-frame");
      if (frame) {
        frame.src = app.entry;
      }
    });

    const detailsBtn = card.querySelector(".secondary");

    detailsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      renderAppDetails(app);
    });

    container.appendChild(card);
  });
}

// Initialize dashboard
window.addEventListener("DOMContentLoaded", async () => {
  console.log("Vault dashboard initializing");

  await loadVaultApps();
  renderVaultApps();
  setAppVersion();
  renderEmptyDetails();

  const settingsBtn = document.getElementById("settingsBtn");
  const helpBtn = document.getElementById("helpBtn");

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      alert("Settings panel coming soon.");
    });
  }

  if (helpBtn) {
    helpBtn.addEventListener("click", () => {
      alert("Vault platform help coming soon.");
    });
  }
});
