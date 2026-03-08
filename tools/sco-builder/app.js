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
   SELECT ZIP (Electron Native)
================================ */
if (selectZipBtn && bridge && bridge.selectZip) {

    selectZipBtn.addEventListener('click', async () => {

        const result = await bridge.selectZip();

        if (!result || result.cancelled) {
            log('No file selected.');
            return;
        }

        selectedZipPath = result.path;

        const fileName = selectedZipPath.split('\\').pop().split('/').pop();
        selectedZipName.textContent = fileName;

        log('Selected ZIP: ' + fileName);
    });
}

/* ===============================
   BUILD PROCESS
================================ */
form.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!selectedZipPath) {
        alert('Please select a ZIP file first.');
        return;
    }

    logOutput.textContent = '';
    log('Starting build process...');

    progressContainer.classList.remove('hidden');
    progressBar.style.width = '10%';
    statusMessage.textContent = 'Preparing build...';

    try {

        const title = document.getElementById('titleInput').value || 'Course';

        log('Running in Electron mode.');

        progressBar.style.width = '40%';
        statusMessage.textContent = 'Building SCO...';

        const result = await bridge.buildSco(selectedZipPath, title);

        if (result && result.success) {

            progressBar.style.width = '100%';
            statusMessage.textContent = 'Build complete.';
            log('SCO successfully generated.');

        } else if (result && result.error) {

            progressBar.style.width = '0%';
            statusMessage.textContent = 'Build failed.';
            log('Electron error: ' + result.error);

        } else if (result && result.canceled) {

            statusMessage.textContent = 'Build canceled.';
            log('User canceled save dialog.');

        }

    } catch (err) {
        statusMessage.textContent = 'Build failed.';
        log('Error: ' + err.message);
    }
});

/* ===============================
   CLEAR UPLOADS
================================ */
const clearBtn = document.getElementById('clearUploadsBtn');

if (clearBtn && bridge && bridge.clearUploads) {
    clearBtn.addEventListener('click', async () => {

        const confirmDelete = confirm('Are you sure you want to clear temporary uploads?');
        if (!confirmDelete) return;

        log('Clearing temporary uploads...');

        try {
            await bridge.clearUploads();
            log('Temporary uploads cleared.');
            statusMessage.textContent = 'Uploads cleared.';
        } catch (err) {
            log('Error clearing uploads: ' + err.message);
            statusMessage.textContent = 'Failed to clear uploads.';
        }

    });
}

/* ===============================
   ABOUT + VERSION
================================ */
const aboutBtn = document.getElementById('aboutBtn');

// About dialog
if (aboutBtn) {
    aboutBtn.addEventListener('click', () => {
        alert('VaultSCO Builder\n\nBuild CourseVault-ready SOBT SCO packages.\n\nPart of the SOBT ICW Developer Tools suite.');
    });
}