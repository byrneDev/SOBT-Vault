

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function buildSco(inputZipPath, outputZipPath, title, tempDir) {

  if (!fs.existsSync(inputZipPath)) {
    throw new Error('Input ZIP not found.');
  }

  if (!tempDir) {
    throw new Error('Temp directory not provided.');
  }

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  fs.mkdirSync(tempDir, { recursive: true });

  // Extract PowerPoint image ZIP
  const inputZip = new AdmZip(inputZipPath);
  inputZip.extractAllTo(tempDir, true);

  // Recursive file scan
  function getAllFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);

    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat && stat.isDirectory()) {
        results = results.concat(getAllFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    });

    return results;
  }

  const imageFiles = getAllFiles(tempDir)
    .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .filter(f => !f.includes('__MACOSX'))
    .filter(f => !path.basename(f).startsWith('._'))
    .sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));

  if (imageFiles.length === 0) {
    throw new Error('No slide images found inside ZIP.');
  }

  // SOBT-style structure
  const scoDir = path.join(tempDir, 'sco');
  const scriptDir = path.join(scoDir, 'script');
  const cssDir = path.join(scoDir, 'css');
  const graphicsDir = path.join(scoDir, 'graphics');

  fs.mkdirSync(scriptDir, { recursive: true });
  fs.mkdirSync(cssDir, { recursive: true });
  fs.mkdirSync(graphicsDir, { recursive: true });

  // Copy slides
  const normalized = [];

  imageFiles.forEach((absPath, index) => {
    const ext = (path.extname(absPath) || '.png').toLowerCase();
    const fileName = 'slide-' + String(index + 1).padStart(3, '0') + ext;
    const dest = path.join(graphicsDir, fileName);
    fs.copyFileSync(absPath, dest);

    normalized.push({
      index: index + 1,
      fileName,
      relPath: 'graphics/' + fileName
    });
  });

  // Generate slide pages
  normalized.forEach((s) => {
    const pageName = 'page_1_' + String(s.index) + '.html';

    const pageHtml =
      '<!DOCTYPE html>' +
      '<html><head>' +
      '<meta charset="UTF-8">' +
      '<title>' + title + '</title>' +
      '<link rel="stylesheet" href="css/content.css">' +
      '</head><body>' +
      '<div class="content-wrap">' +
      '<img class="slide-img" src="' + s.relPath + '">' +
      '</div>' +
      '</body></html>';

    fs.writeFileSync(path.join(scoDir, pageName), pageHtml);
  });

  // Interface CSS (bottom navigation layout)
  const interfaceCss =
    'body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,sans-serif;background:#0f1117;color:#e6edf3;display:flex;flex-direction:column;height:100vh;}' +
    '.frame{flex:1;width:100%;border:0;display:block;}' +
    '.bottombar{display:flex;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid #30363d;background:#161b22;}' +
    '.title{font-weight:700;}' +
    '.controls{display:flex;gap:8px;margin-left:auto;}' +
    'button{background:#238636;border:none;color:#fff;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:600;}' +
    'button:disabled{opacity:.5;cursor:not-allowed;}';

  const contentCss =
    'body{margin:0;background:#0f1117;color:#e6edf3;}' +
    '.content-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;}' +
    '.slide-img{max-width:100%;max-height:100vh;}';

  fs.writeFileSync(path.join(cssDir, 'interface.css'), interfaceCss);
  fs.writeFileSync(path.join(cssDir, 'content.css'), contentCss);

  // interface.js (navigation controller)
  const interfaceJs =
    'var SCORM_INTERFACE={' +
      'idx:0,' +
      'pages:(typeof frameData!=="undefined"&&frameData.frameContent)?frameData.frameContent:[],' +
      'loadSCO:function(){this.idx=0;this.render();},' +
      'render:function(){var f=document.getElementById("contentFrame");var p=this.pages[this.idx];if(!f||!p){return;}' +
        'f.src=p.file;' +
        'document.getElementById("pos").textContent=(this.idx+1)+" / "+this.pages.length;' +
        'document.getElementById("prevBtn").disabled=(this.idx<=0);' +
        'document.getElementById("nextBtn").disabled=(this.idx>=this.pages.length-1);' +
      '},' +
      'next:function(){if(this.idx<this.pages.length-1){this.idx++;this.render();}},' +
      'prev:function(){if(this.idx>0){this.idx--;this.render();}}' +
    '};';

  fs.writeFileSync(path.join(scriptDir, 'interface.js'), interfaceJs);

  // data_content.js (required by CourseVault)
  const frameContentEntries = normalized.map(s => ({
    id: String(s.index),
    file: 'page_1_' + String(s.index) + '.html',
    classification: 'UNCLASSIFIED',
    title: 'Slide ' + String(s.index)
  }));

  const dataContentJs =
    'var frameData = {' +
      '"courseClassification":"UNCLASSIFIED",' +
      '"scoClassification":"UNCLASSIFIED",' +
      '"completionPercent":"100",' +
      '"hasExam":false,' +
      '"topicMenu":false,' +
      '"debugMode":false,' +
      '"strictMode":false,' +
      '"useBookmark":false,' +
      '"erPrefix":"' + String(title).replace(/"/g, '\\"') + '",' +
      '"frameContent":' + JSON.stringify(frameContentEntries) +
    '};';

  fs.writeFileSync(path.join(scriptDir, 'data_content.js'), dataContentJs);

  // Required stub files
  fs.writeFileSync(path.join(scriptDir, 'apiwrapper.js'), '/* API wrapper stub */');
  fs.writeFileSync(path.join(scriptDir, 'scofunctions.js'), '/* SCO functions stub */');
  fs.writeFileSync(path.join(scriptDir, 'data_glossary.js'), 'var glossaryData=[];');
  fs.writeFileSync(path.join(scriptDir, 'data_references.js'), 'var referenceData=[];');

  // lms_start.html with bottom navigation
  const lmsStartHtml =
    '<!DOCTYPE html>' +
    '<html><head>' +
    '<meta charset="UTF-8">' +
    '<title>' + title + '</title>' +
    '<link rel="stylesheet" href="css/interface.css">' +
    '<script src="script/data_content.js"></script>' +
    '<script src="script/interface.js"></script>' +
    '</head><body onload="SCORM_INTERFACE.loadSCO();">' +
    '<iframe id="contentFrame" class="frame"></iframe>' +
    '<div class="bottombar">' +
      '<div class="title">' + title + '</div>' +
      '<div id="pos">0 / 0</div>' +
      '<div class="controls">' +
        '<button id="prevBtn" onclick="SCORM_INTERFACE.prev()">Prev</button>' +
        '<button id="nextBtn" onclick="SCORM_INTERFACE.next()">Next</button>' +
      '</div>' +
    '</div>' +
    '</body></html>';

  fs.writeFileSync(path.join(scoDir, 'lms_start.html'), lmsStartHtml);

  // ZIP output with root folder "sco/"
  const finalZip = new AdmZip();
  finalZip.addLocalFolder(scoDir, 'sco');
  finalZip.writeZip(outputZipPath);

  fs.rmSync(tempDir, { recursive: true, force: true });
}

module.exports = { buildSco };