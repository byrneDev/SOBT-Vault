

/**
 * Excel Importer for SOBT Exam Generator
 *
 * Expected Spreadsheet Columns:
 *
 * TOS | EOS | ID | Type | Question | A | B | C | D | Correct | Remediation
 *
 * Correct column uses letters (A,B,C,D) or multiple letters (A,B for MA).
 */

import { createExamBank, createQuestion } from './examModel.js';

function buildChoiceSet(row) {
  const choices = [];

  const answers = [row.A, row.B, row.C, row.D];

  let correctSet = new Set();

  if (row.Correct) {
    const parts = String(row.Correct)
      .split(',')
      .map(v => v.trim().toUpperCase());

    parts.forEach(p => correctSet.add(p));
  }

  const letters = ['A', 'B', 'C', 'D'];

  answers.forEach((answer, index) => {
    if (!answer) return;

    choices.push({
      correct: correctSet.has(letters[index]),
      choice: String(answer)
    });
  });

  return choices;
}

export function importExcel(arrayBuffer) {

  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet);

  const examBank = createExamBank();

  const tosMap = new Map();

  rows.forEach(row => {

    const tosName = row.TOS || 'Terminal Objective Group 1';
    const eosName = row.EOS || 'TO1: Enabling Objective Group 1';

    if (!tosMap.has(tosName)) {

      const newTOS = {
        category: tosName,
        poolEOS: {
          category: eosName,
          display: '0',
          questionItem: []
        }
      };

      examBank.bank.poolTOS.push(newTOS);
      tosMap.set(tosName, newTOS);
    }

    const tos = tosMap.get(tosName);

    const question = createQuestion({
      id: row.ID,
      questionType: String(row.Type || 'MC').toUpperCase(),
      question: row.Question,
      choices: buildChoiceSet(row),
      remediation: row.Remediation || ''
    });

    tos.poolEOS.questionItem.push(question);

    tos.poolEOS.display = String(tos.poolEOS.questionItem.length);

  });

  return examBank;
}

export function validateExcelStructure(rows) {

  const required = ['ID', 'Question', 'A'];

  if (!rows.length) {
    throw new Error('Spreadsheet is empty');
  }

  const first = rows[0];

  required.forEach(field => {
    if (!(field in first)) {
      throw new Error(`Missing required column: ${field}`);
    }
  });

  return true;
}