// Platform session persistence
const toolSessions = {}
let currentTool = null
let currentFrame = null

// Tabbed workspace support
const toolFrames = {}

// Tab UI support
const toolTabs = {}

// Workspace Manager
const workspaceManager = {
  save() {
    const openTools = Object.keys(toolFrames)
    localStorage.setItem("vaultWorkspace", JSON.stringify(openTools))
  },
  load() {
    try {
      const data = JSON.parse(localStorage.getItem("vaultWorkspace") || "[]")
      return Array.isArray(data) ? data : []
    } catch {
      return []
    }
  },
  clear() {
    localStorage.removeItem("vaultWorkspace")
  }
}

function getToolWorkspaceHost() {
  let workspace = document.getElementById('workspace')

  if (!workspace) {
    workspace = document.querySelector('.workspace')
  }

  if (!workspace) {
    console.error('Vault workspace container not found')
    return null
  }

  workspace.style.position = 'relative'
  workspace.style.overflow = 'hidden'

  let host = document.getElementById('vaultToolWorkspaceHost')

  if (!host) {
    host = document.createElement('div')
    host.id = 'vaultToolWorkspaceHost'
    host.style.position = 'absolute'
    host.style.inset = '0'
    host.style.display = 'none'
    host.style.width = '100%'
    host.style.height = '100%'
    host.style.background = 'transparent'
    host.style.zIndex = '2'

    workspace.appendChild(host)
  }

  return host
}

function ensureTabBar() {
  let tabBar = document.querySelector('.vault-tabbar')
  if (!tabBar) {
    tabBar = document.createElement('div')
    tabBar.className = 'vault-tabbar'
    tabBar.style.display = 'flex'
    tabBar.style.gap = '4px'
    tabBar.style.padding = '6px'
    tabBar.style.borderBottom = '1px solid #2a2a2a'
    tabBar.style.background = '#111'

    const workspace = document.querySelector('#workspace') || document.querySelector('.workspace') || document.body
    workspace.parentNode.insertBefore(tabBar, workspace)
  }
  return tabBar
}

function createTab(app) {
  const tabBar = ensureTabBar()

  if (toolTabs[app.name]) return toolTabs[app.name]

  const tab = document.createElement('div')
  tab.className = 'vault-tab'
  const title = document.createElement('span')
  title.textContent = app.name

  tab.appendChild(title)

  const closeBtn = document.createElement('span')
  closeBtn.textContent = ' ×'
  closeBtn.style.marginLeft = '6px'
  closeBtn.style.cursor = 'pointer'
  closeBtn.style.color = '#888'

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    closeToolSession(app.name)
  })

  tab.appendChild(closeBtn)

  tab.style.padding = '4px 10px'
  tab.style.cursor = 'pointer'
  tab.style.background = '#1a1a1a'
  tab.style.border = '1px solid #333'
  tab.style.borderBottom = 'none'
  tab.style.fontSize = '12px'

  tab.addEventListener('click', () => {
    currentTool = app.name
    currentFrame = toolFrames[app.name]
    activateToolFrame(app.name)
  })

  tabBar.appendChild(tab)
  toolTabs[app.name] = tab

  return tab
}

function activateTab(toolName) {
  Object.keys(toolTabs).forEach(name => {
    const tab = toolTabs[name]
    if (!tab) return

    if (name === toolName) {
      tab.style.background = '#2b2b2b'
      tab.style.color = '#fff'
    } else {
      tab.style.background = '#1a1a1a'
      tab.style.color = '#aaa'
    }
  })
}

function closeToolSession(toolName) {
  const frame = toolFrames[toolName]
  const tab = toolTabs[toolName]

  if (frame) {
    frame.remove()
    delete toolFrames[toolName]
  }

  if (tab) {
    tab.remove()
    delete toolTabs[toolName]
  }

  if (currentTool === toolName) {
    currentTool = null
    currentFrame = null
  }

  const remainingTools = Object.keys(toolFrames)
  const host = document.getElementById('vaultToolWorkspaceHost')

  if (!remainingTools.length) {
    if (host) host.style.display = 'none'
  } else {
    const nextTool = remainingTools[0]
    currentTool = nextTool
    currentFrame = toolFrames[nextTool]
    activateToolFrame(nextTool)
  }

  workspaceManager.save()
}

function activateToolFrame(toolName) {
  const host = getToolWorkspaceHost()
  if (!host) return

  host.style.display = 'block'

  Object.keys(toolFrames).forEach(name => {
    const f = toolFrames[name]
    if (f) {
      f.style.display = name === toolName ? 'block' : 'none'
      f.style.position = 'absolute'
      f.style.inset = '0'
      f.style.width = '100%'
      f.style.height = '100%'
      f.style.border = 'none'
      f.style.background = 'transparent'
    }
  })

  activateTab(toolName)
}

function getOrCreateToolFrame(app) {
  const host = getToolWorkspaceHost()
  if (!host) return null

  if (toolFrames[app.name]) {
    return toolFrames[app.name]
  }

  const frame = document.createElement('iframe')
  frame.className = 'vault-frame'
  frame.src = app.entry
  frame.style.display = 'none'
  frame.style.position = 'absolute'
  frame.style.inset = '0'
  frame.style.width = '100%'
  frame.style.height = '100%'
  frame.style.border = 'none'
  frame.style.background = 'transparent'

  host.appendChild(frame)
  createTab(app)
  toolFrames[app.name] = frame
  workspaceManager.save()

  return frame
}

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

  let frame;
  const launchBtn = document.getElementById('detailsLaunchBtn');
  const copyBtn = document.getElementById('detailsCopyPathBtn');

  if (launchBtn) {
    launchBtn.addEventListener('click', () => {

      // request state from current tool before switching
      if (currentFrame && currentTool) {
        try {
          currentFrame.contentWindow.postMessage({ type: "vault-request-state" }, "*");
        } catch (err) {
          console.warn("State request failed", err);
        }
      }

      const frame = getOrCreateToolFrame(app)
      if (!frame) return

      currentTool = app.name
      currentFrame = frame

      activateToolFrame(app.name)

      frame.onload = () => {
        if (toolSessions[currentTool]) {
          frame.contentWindow.postMessage({
            type: "vault-restore-state",
            data: toolSessions[currentTool]
          }, "*");
        }
      };

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

    let frame;

    launchBtn.addEventListener("click", (e) => {
      e.stopPropagation();

      // request state from current tool before switching
      if (currentFrame && currentTool) {
        try {
          currentFrame.contentWindow.postMessage({ type: "vault-request-state" }, "*");
        } catch (err) {
          console.warn("State request failed", err);
        }
      }

      const frame = getOrCreateToolFrame(app)
      if (!frame) return

      currentTool = app.name
      currentFrame = frame

      activateToolFrame(app.name)

      frame.onload = () => {
        if (toolSessions[currentTool]) {
          frame.contentWindow.postMessage({
            type: "vault-restore-state",
            data: toolSessions[currentTool]
          }, "*");
        }
      };

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

  // Restore previous workspace
  const savedTools = workspaceManager.load()
  if (savedTools.length) {
    savedTools.forEach(name => {
      const app = vaultApps.find(a => a.name === name)
      if (app) {
        const frame = getOrCreateToolFrame(app)
        if (!frame) return
        currentTool = app.name
        currentFrame = frame
        activateToolFrame(app.name)
      }
    })
  }

  renderVaultApps();
  setAppVersion();
  renderEmptyDetails();

  const settingsBtn = document.getElementById("settingsBtn");
  const helpBtn = document.getElementById("helpBtn");

  const settingsPanel = document.getElementById("settingsPanel");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const toggleDevBtn = document.getElementById("toggleDevToolsBtn");

  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener("click", () => {
      settingsPanel.style.display = "block";
    });
  }

  if (closeSettingsBtn && settingsPanel) {
    closeSettingsBtn.addEventListener("click", () => {
      settingsPanel.style.display = "none";
    });
  }

  if (toggleDevBtn) {
    toggleDevBtn.addEventListener("click", async () => {
      try {
        const bridge =
          window.api ||
          window.vault ||
          (window.parent && window.parent.vault) ||
          null;

        if (bridge && bridge.toggleDevTools) {
          await bridge.toggleDevTools();
        } else {
          console.warn("DevTools bridge not available");
        }
      } catch (err) {
        console.error("DevTools toggle failed", err);
      }
    });
  }

  if (helpBtn) {
    helpBtn.addEventListener("click", () => {
      alert("Vault platform help coming soon.");
    });
  }

  // Session persistence listener
  window.addEventListener("message", (event) => {
    const msg = event.data

    if (!msg || !msg.type) return

    if (msg.type === "vault-save-state") {
      if (currentTool) {
        toolSessions[currentTool] = msg.data
        console.log("Saved session state for", currentTool)
      }
    }
  })

  // Hot reload listener for tool changes
  const bridge =
    window.api ||
    window.vault ||
    (window.parent && window.parent.vault) ||
    null;

  if (bridge && bridge.on) {
    bridge.on("vault:tool-updated", (filePath) => {
      const frame = document.querySelector(".vault-frame");

      // Write reload indicator to the log panel if it exists
      const logPanel = document.getElementById("logOutput");
      if (logPanel) {
        const ts = new Date().toLocaleTimeString();
        logPanel.textContent += `[${ts}] Tool updated — reloading (${filePath || 'tool'})\n`;
        logPanel.scrollTop = logPanel.scrollHeight;
      }

      console.log("Tool updated — reloading", filePath);

      // Show visual reload banner
      const banner = document.getElementById("reloadBanner");
      if (banner) {
        banner.style.display = "block";

        // hide banner after short delay
        setTimeout(() => {
          banner.style.display = "none";
        }, 1200);
      }

      if (frame && frame.src) {
        const currentSrc = frame.src;
        frame.src = "";
        frame.src = currentSrc;
      }
    });
  }
});
