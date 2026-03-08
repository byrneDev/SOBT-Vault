const form = document.getElementById('buildForm');
const selectZipBtn = document.getElementById('selectZipBtn');
const selectedZipName = document.getElementById('selectedZipName');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const statusMessage = document.getElementById('statusMessage');
const logOutput = document.getElementById('logOutput');

let selectedZipPath = null;

// Resolve bridge (standalone Electron or hosted in SOBT Vault iframe)
const bridge =
  window.api ||
  window.vault ||
  (window.parent && window.parent.vault) ||
  null;

/* ===============================
   LOGGING
================================ */
function log(message) {
    const timestamp = new Date().toLocaleTimeString();
    logOutput.textContent += `[${timestamp}] ${message}\n`;
    logOutput.scrollTop = logOutput.scrollHeight;
}

/* ===============================
   TOOL ACTION PLACEHOLDER
================================ */

const runBtn = document.getElementById('runToolBtn');

if (runBtn) {
  runBtn.addEventListener('click', () => {
    log('Tool action triggered. Replace this logic when implementing a real tool.');
  });
}

/* ===============================
   ABOUT + VERSION
================================ */
const aboutBtn = document.getElementById('aboutBtn');

// About dialog
if (aboutBtn) {
    aboutBtn.addEventListener('click', () => {
        alert('SOBT Developer Tool Template\n\nUse this template to build new SOBT ICW developer tools.\n\nPart of the SOBT ICW Developer Tools suite.');
    });
}