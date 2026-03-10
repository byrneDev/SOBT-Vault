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
const generateBankBtn = document.getElementById('generateBankBtn');
const generatedBankStatus = document.getElementById('generatedBankStatus');
const generatedBankInfo = document.getElementById('generatedBankInfo');
const examBanksList = document.getElementById('examBanksList');

/* ===============================
   STATE
================================ */

if (importBankBtn && importBankInput) {
  importBankBtn.addEventListener('click', () => importBankInput.click());
}

if (importExcelBtn && importExcelInput) {
  importExcelBtn.addEventListener('click', () => importExcelInput.click());
}

// Legacy working model (kept for compatibility during refactor)
let examBank = createExamBank();

// New workflow state model
let workingQuestions = [];        // questions imported or created manually
let examBanks = [];               // generated exam banks
let activeQuestionBank = null;    // bank currently loaded into the editor

let editingMeta = null; // {tosIndex, questionIndex}

// Gate 11: Track collapsed TOS groups
const collapsedTosGroups = {}; // { 'TOS name': true/false }

// Gate 12: Track collapsed EOS groups
const collapsedEosGroups = {}; // { 'TOS||EOS': true/false }

function resetEditor() {
  editingMeta = null;

  if (addQuestionBtn) {
    addQuestionBtn.textContent = 'Add Question';
  }

  const fields = [
    'questionID','questionText','choiceA','choiceB','choiceC','choiceD','correctAnswer','remediation'
  ];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const typeField = document.getElementById('questionType');
  if (typeField) typeField.value = 'MC';

  const deleteBtn = document.getElementById('deleteQuestionBtn');
  if (deleteBtn) deleteBtn.style.display = 'none';
}

function validateQuestionInput(questionText, answers, correctInput, type) {
  if (!questionText || questionText.trim() === '') {
    return 'Validation failed: Question text is required';
  }

  const providedAnswers = answers.filter(a => a && a.trim() !== '');
  if (providedAnswers.length < 2) {
    return 'Validation failed: At least two answer choices are required';
  }

  const letters = ['A','B','C','D'];
  const validLetters = letters.slice(0, providedAnswers.length);

  if (!correctInput || correctInput.trim() === '') {
    return 'Validation failed: Correct answer is required';
  }

  const selected = correctInput.split(',').map(v => v.trim().toUpperCase());

  for (const s of selected) {
    if (!validLetters.includes(s)) {
      return `Validation failed: Correct answer '${s}' does not match available choices`;
    }
  }

  if (type === 'MA' && selected.length < 2) {
    return 'Validation failed: Multiple Answer questions require at least two correct answers';
  }

  return null;
}

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

  // Group questions by TOS/EOS
  const groups = {};

  flat.forEach(item => {
    const q = item.question;
    const tos = q.tos ?? q.TOS ?? 'Unassigned TOS';
    const eos = q.eos ?? q.EOS ?? 'Unassigned EOS';

    const key = `${tos}||${eos}`;

    if (!groups[key]) {
      groups[key] = {
        tos,
        eos,
        items: []
      };
    }

    groups[key].items.push(item);
  });

  let index = 1;

  Object.values(groups).forEach(group => {
    // Gate 11: TOS header with collapse/expand
    const tosHeader = document.createElement('div');
    tosHeader.className = 'tos-header';

    const isCollapsed = collapsedTosGroups[group.tos] === true;

    const indicator = document.createElement('span');
    indicator.className = 'tos-toggle';
    indicator.textContent = isCollapsed ? '▶ ' : '▼ ';

    const label = document.createElement('span');
    label.textContent = `TOS: ${group.tos}`;

    tosHeader.appendChild(indicator);
    tosHeader.appendChild(label);

    // Toggle collapse on click
    tosHeader.addEventListener('click', () => {
      collapsedTosGroups[group.tos] = !collapsedTosGroups[group.tos];
      renderQuestions();
    });

    questionList.appendChild(tosHeader);

    // EOS header with collapse/expand
    const eosKey = `${group.tos}||${group.eos}`;
    const eosHeader = document.createElement('div');
    eosHeader.className = 'eos-header';

    const eosCollapsed = collapsedEosGroups[eosKey] === true;

    const eosIndicator = document.createElement('span');
    eosIndicator.className = 'eos-toggle';
    eosIndicator.textContent = eosCollapsed ? '▶ ' : '▼ ';

    const eosLabel = document.createElement('span');
    eosLabel.textContent = `EOS: ${group.eos}`;

    eosHeader.appendChild(eosIndicator);
    eosHeader.appendChild(eosLabel);

    // Toggle EOS collapse
    eosHeader.addEventListener('click', () => {
      collapsedEosGroups[eosKey] = !collapsedEosGroups[eosKey];
      renderQuestions();
    });

    questionList.appendChild(eosHeader);

    // Skip rendering questions if TOS or EOS group is collapsed
    if (collapsedTosGroups[group.tos] || collapsedEosGroups[eosKey]) {
      return;
    }

    group.items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'question-row';

      const content = document.createElement('div');
      content.className = 'question-content';

      const badge = document.createElement('span');
      badge.className = 'question-badge';
      badge.textContent = index++;

      const typeTag = document.createElement('span');
      typeTag.className = 'question-type';
      typeTag.textContent = item.question.questionType || 'MC';

      const label = document.createElement('span');
      label.textContent = item.question.question;

      // Allow clicking the question to load it into the editor
      row.addEventListener('click', () => {
        const q = item.question;

        const idField = document.getElementById('questionID');
        const typeField = document.getElementById('questionType');
        const textField = document.getElementById('questionText');

        const tosField = document.getElementById('tos');
        const eosField = document.getElementById('eos');

        const choiceA = document.getElementById('choiceA');
        const choiceB = document.getElementById('choiceB');
        const choiceC = document.getElementById('choiceC');
        const choiceD = document.getElementById('choiceD');

        const correctField = document.getElementById('correctAnswer');
        const remediationField = document.getElementById('remediation');

        const tosValue = q.tos ?? q.TOS ?? item.tos ?? item.TOS ?? '';
        const eosValue = q.eos ?? q.EOS ?? item.eos ?? item.EOS ?? '';

        if (tosField) tosField.value = tosValue;
        if (eosField) eosField.value = eosValue;

        if (idField) idField.value = q.id ?? '';
        if (typeField) typeField.value = q.questionType ?? 'MC';
        if (textField) textField.value = q.question ?? '';

        if (choiceA) choiceA.value = q.choices?.[0]?.choice ?? '';
        if (choiceB) choiceB.value = q.choices?.[1]?.choice ?? '';
        if (choiceC) choiceC.value = q.choices?.[2]?.choice ?? '';
        if (choiceD) choiceD.value = q.choices?.[3]?.choice ?? '';

        const letters = ['A','B','C','D'];
        const correct = (q.choices || [])
          .map((c,i)=> c.correct ? letters[i] : null)
          .filter(Boolean)
          .join(',');

        if (correctField) correctField.value = correct;
        if (remediationField) remediationField.value = q.remediation ?? '';

        log(`Loaded question ${q.id ?? '(no id)'} into editor`);
        editingMeta = { tosIndex: item.tosIndex, questionIndex: item.questionIndex };

        const deleteBtn = document.getElementById('deleteQuestionBtn');
        if (deleteBtn) deleteBtn.style.display = 'inline-block';

        if (addQuestionBtn) {
          addQuestionBtn.textContent = 'Update Question';
        }
      });

      const actions = document.createElement('div');
      actions.className = 'question-actions';

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.innerHTML = '🗑';

      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
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
      syncWorkingQuestionsFromExamBank();

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
      syncWorkingQuestionsFromExamBank();

    } catch (err) {
      log(`Excel import failed: ${err.message}`);
    }

  });
}

/* ===============================
   GENERATE EXAM BANK
================================ */

if (generateBankBtn) {
  generateBankBtn.addEventListener('click', () => {

    const flat = flattenQuestions(examBank);

    if (!flat || flat.length === 0) {
      log('No questions available to generate exam bank');
      return;
    }

    const newBank = {
      id: `bank_${Date.now()}`,
      name: `Exam Bank ${examBanks.length + 1}`,
      questionCount: flat.length,
      questions: flat.map(q => q.question)
    };

    examBanks.push(newBank);

    // Clear the working question pool after bank generation
    if (examBank?.bank?.poolTOS?.[0]?.poolEOS?.questionItem) {
      examBank.bank.poolTOS[0].poolEOS.questionItem = [];
    }

    // Reset workingQuestions state
    workingQuestions = [];

    if (generatedBankStatus) {
      generatedBankStatus.textContent = 'Status: Generated';
    }

    if (generatedBankInfo) {
      generatedBankInfo.textContent = `Questions: ${flat.length}`;
    }

    renderExamBanks();
    renderQuestions();

    log(`Exam bank generated with ${flat.length} questions and removed from working pool`);

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
    const tos = document.getElementById('tos')?.value || '';
    const eos = document.getElementById('eos')?.value || '';

    const answers = [
      document.getElementById('choiceA')?.value,
      document.getElementById('choiceB')?.value,
      document.getElementById('choiceC')?.value,
      document.getElementById('choiceD')?.value
    ];

    const correctInput = document.getElementById('correctAnswer')?.value || '';
    const remediation = document.getElementById('remediation')?.value || '';

    const validationError = validateQuestionInput(questionText, answers, correctInput, type);
    if (validationError) {
      log(validationError);
      return;
    }

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
      tos,
      eos,
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

    if (editingMeta) {
      updateQuestion(examBank, editingMeta.tosIndex, editingMeta.questionIndex, newQuestion);

      // If an exam bank is currently active, keep it synchronized
      if (activeQuestionBank && activeQuestionBank.questions) {
        activeQuestionBank.questions[editingMeta.questionIndex] = newQuestion;
        activeQuestionBank.questionCount = activeQuestionBank.questions.length;
      }

      log(`Question ${id} updated`);
      editingMeta = null;
      addQuestionBtn.textContent = 'Add Question';
    } else {
      addQuestion(examBank, 0, newQuestion);

      // If editing an active bank, append the new question there as well
      if (activeQuestionBank && activeQuestionBank.questions) {
        activeQuestionBank.questions.push(newQuestion);
        activeQuestionBank.questionCount = activeQuestionBank.questions.length;
        renderExamBanks();
      }
    }

    renderQuestions();

    resetEditor();

  });
}

let deleteEditorBtn = document.getElementById('deleteQuestionBtn');

if (!deleteEditorBtn && addQuestionBtn) {
  deleteEditorBtn = document.createElement('button');
  deleteEditorBtn.id = 'deleteQuestionBtn';
  deleteEditorBtn.className = 'secondary-btn';
  deleteEditorBtn.textContent = 'Delete Question';
  deleteEditorBtn.style.display = 'none';

  addQuestionBtn.parentElement.appendChild(deleteEditorBtn);

  deleteEditorBtn.addEventListener('click', () => {
    if (!editingMeta) {
      log('No question selected for deletion');
      return;
    }

    removeQuestion(examBank, editingMeta.tosIndex, editingMeta.questionIndex);

    // Keep active bank synchronized
    if (activeQuestionBank && activeQuestionBank.questions) {
      activeQuestionBank.questions.splice(editingMeta.questionIndex, 1);
      activeQuestionBank.questionCount = activeQuestionBank.questions.length;
      renderExamBanks();
    }

    resetEditor();
    renderQuestions();
    log('Question deleted from editor');
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
/* ===============================
   RENDER EXAM BANKS
================================ */

function renderExamBanks() {
  if (!examBanksList) return;

  examBanksList.innerHTML = '';

  examBanks.forEach(bank => {
    const row = document.createElement('div');
    row.className = 'exam-bank-row';

    const name = document.createElement('span');
    name.className = 'bank-name';
    name.textContent = bank.name;

    const count = document.createElement('span');
    count.className = 'bank-count';
    count.textContent = `(${bank.questionCount})`;

    const actions = document.createElement('div');
    actions.className = 'bank-actions';

    const pullBtn = document.createElement('button');
    pullBtn.className = 'secondary-btn';
    pullBtn.textContent = 'Pull';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'secondary-btn';
    renameBtn.textContent = 'Rename';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'secondary-btn';
    deleteBtn.textContent = 'Delete';

    pullBtn.addEventListener('click', () => {
      activeQuestionBank = bank;

      // Ensure legacy model structure exists
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

      examBank.bank.poolTOS[0].poolEOS.questionItem = [...bank.questions];
      workingQuestions = [...bank.questions];
      examBank.bank.poolTOS[0].poolEOS.display = String(bank.questions.length);

      renderQuestions();
      resetEditor();

      log(`Loaded ${bank.name} into editor (${bank.questions.length} questions)`);
    });

    let renameInput = null;

    function saveBankRename() {
      const newName = renameInput?.value?.trim();

      if (!newName) {
        log('Rename failed: Exam bank name is required');
        return;
      }

      bank.name = newName;
      renderExamBanks();
      log(`Exam bank renamed to "${bank.name}"`);
    }

    renameBtn.addEventListener('click', () => {
      if (!renameInput) {
        renameInput = document.createElement('input');
        renameInput.type = 'text';
        renameInput.value = bank.name;
        renameInput.className = 'form-input';
        renameInput.style.maxWidth = '220px';

        row.replaceChild(renameInput, name);
        renameBtn.textContent = 'Save';

        renameInput.focus();
        renameInput.select();

        renameInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            saveBankRename();
          }
        });
      } else {
        saveBankRename();
      }
    });

    deleteBtn.addEventListener('click', () => {
      const confirmDelete = confirm(`Delete exam bank "${bank.name}"?`);
      if (!confirmDelete) return;

      examBanks = examBanks.filter(b => b.id !== bank.id);

      if (activeQuestionBank && activeQuestionBank.id === bank.id) {
        activeQuestionBank = null;
        if (examBank?.bank?.poolTOS?.[0]?.poolEOS) {
          examBank.bank.poolTOS[0].poolEOS.questionItem = [];
          examBank.bank.poolTOS[0].poolEOS.display = '0';
        }
        renderQuestions();
        resetEditor();
      }

      renderExamBanks();
      log(`Exam bank "${bank.name}" deleted`);
    });

    actions.appendChild(pullBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(name);
    row.appendChild(count);
    row.appendChild(actions);

    examBanksList.appendChild(row);
  });
}