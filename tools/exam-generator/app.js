import { parseBankFile, flattenQuestions, addQuestion, updateQuestion, removeQuestion } from './core/bankParser.js';
import { importExcel } from './core/excelImporter.js';
import { exportExamBankJS, validateExamBank } from './core/exportEngine.js';
import { createExamBank, createQuestion } from './core/examModel.js';

/* ===============================
   DOM REFERENCES
================================ */

const importBankInput = document.getElementById('importBankFile');
const importExcelInput = document.getElementById('importExcelFile');
const exportBtn = document.getElementById('exportExamBtn');
const addQuestionBtn = document.getElementById('addQuestionBtn');
const questionList = document.getElementById('questionList');
const logOutput = document.getElementById('logOutput');

const importBankBtn = document.getElementById('importBankBtn');
const importExcelBtn = document.getElementById('importExcelBtn');
const importBankName = document.getElementById('importBankName');
const importExcelName = document.getElementById('importExcelName');
const aboutBtn = document.getElementById('aboutBtn');

/* ===============================
   STATE
================================ */

if (importBankBtn && importBankInput) {
  importBankBtn.addEventListener('click', () => importBankInput.click());
}

if (importExcelBtn && importExcelInput) {
  importExcelBtn.addEventListener('click', () => importExcelInput.click());
}

let examBank = createExamBank();

/* ===============================
   BRIDGE RESOLUTION
================================ */

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
  if (logOutput) {
    logOutput.textContent += `[${timestamp}] ${message}\n`;
    logOutput.scrollTop = logOutput.scrollHeight;
  }
}

/* ===============================
   RENDER QUESTION LIST
================================ */

function renderQuestions() {
  if (!questionList) return;

  questionList.innerHTML = '';

  const flat = flattenQuestions(examBank);

  flat.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'question-row';

    const content = document.createElement('div');
    content.className = 'question-content';

    const badge = document.createElement('span');
    badge.className = 'question-badge';
    badge.textContent = index + 1;

    const typeTag = document.createElement('span');
    typeTag.className = 'question-type';
    typeTag.textContent = item.question.questionType || 'MC';

    const label = document.createElement('span');
    label.textContent = item.question.question;

    const actions = document.createElement('div');
    actions.className = 'question-actions';

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.innerHTML = '🗑';

    delBtn.addEventListener('click', () => {
      try {
        removeQuestion(examBank, item.tosIndex, item.questionIndex);
        log(`Question ${item.question.id} removed`);
        renderQuestions();
      } catch (err) {
        log(`Delete failed: ${err.message}`);
      }
    });

    content.appendChild(badge);
    content.appendChild(typeTag);
    content.appendChild(label);

    actions.appendChild(delBtn);

    row.appendChild(content);
    row.appendChild(actions);

    questionList.appendChild(row);
  });
}

/* ===============================
   IMPORT EXISTING BANK
================================ */

if (importBankInput) {
  importBankInput.addEventListener('change', async (e) => {

    const file = e.target.files[0];

    if (importBankName && file) {
      importBankName.textContent = file.name;
    }

    if (!file) return;

    const text = await file.text();

    try {
      examBank = parseBankFile(text);

      log('Exam bank loaded successfully');

      renderQuestions();

    } catch (err) {
      log(`Bank load failed: ${err.message}`);
    }

  });
}

/* ===============================
   IMPORT EXCEL
================================ */

if (importExcelInput) {
  importExcelInput.addEventListener('change', async (e) => {

    const file = e.target.files[0];

    if (importExcelName && file) {
      importExcelName.textContent = file.name;
    }

    if (!file) return;

    const buffer = await file.arrayBuffer();

    try {
      examBank = importExcel(buffer);

      log('Excel imported successfully');

      renderQuestions();

    } catch (err) {
      log(`Excel import failed: ${err.message}`);
    }

  });
}

/* ===============================
   ADD QUESTION
================================ */

if (addQuestionBtn) {
  addQuestionBtn.addEventListener('click', () => {

    const id = document.getElementById('questionID')?.value || Date.now().toString();
    const type = (document.getElementById('questionType')?.value || 'MC').toUpperCase();
    const questionText = document.getElementById('questionText')?.value || '';

    const answers = [
      document.getElementById('choiceA')?.value,
      document.getElementById('choiceB')?.value,
      document.getElementById('choiceC')?.value,
      document.getElementById('choiceD')?.value
    ];

    const correctInput = document.getElementById('correctAnswer')?.value || '';
    const remediation = document.getElementById('remediation')?.value || '';

    const correctLetters = new Set(
      correctInput.split(',').map(v => v.trim().toUpperCase())
    );

    const letters = ['A','B','C','D'];

    const choices = answers
      .map((answer, index) => {
        if (!answer) return null;

        return {
          correct: correctLetters.has(letters[index]),
          choice: answer
        };
      })
      .filter(Boolean);

    const newQuestion = createQuestion({
      id,
      questionType: type,
      question: questionText,
      choices,
      remediation
    });

    if (!examBank.bank.poolTOS || examBank.bank.poolTOS.length === 0) {
      examBank.bank.poolTOS = [
        {
          category: 'Terminal Objective Group 1',
          poolEOS: {
            category: 'TO1: Enabling Objective Group 1',
            display: '0',
            questionItem: []
          }
        }
      ];
    }

    addQuestion(examBank, 0, newQuestion);

    log(`Question ${id} added`);

    renderQuestions();

    const fields = [
      'questionID','questionText','choiceA','choiceB','choiceC','choiceD','correctAnswer','remediation'
    ];

    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const typeField = document.getElementById('questionType');
    if (typeField) typeField.value = 'MC';

  });
}

/* ===============================
   EXPORT EXAM
================================ */

if (exportBtn) {

  exportBtn.addEventListener('click', () => {

    try {

      validateExamBank(examBank);

      const js = exportExamBankJS(examBank);

      const blob = new Blob([js], { type: 'text/javascript' });

      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');

      a.href = url;
      a.download = 'examBank.js';

      document.body.appendChild(a);

      a.click();

      document.body.removeChild(a);

      URL.revokeObjectURL(url);

      log('Exam exported successfully');

    } catch (err) {

      log(`Export failed: ${err.message}`);

    }

  });
}

/* ===============================
   INITIAL RENDER
================================ */

renderQuestions();

/* ===============================
   ABOUT BUTTON
================================ */

if (aboutBtn) {
  aboutBtn.addEventListener('click', () => {
    const message = `SOBT Exam Generator

Version 1.0

This tool creates SOBT‑compliant exam banks.

Features:
• Manual question authoring
• Excel question import
• Question bank editor
• Export to SOBT examBank.js format

Part of the SOBT Vault tool suite.`;

    alert(message);
  });
}