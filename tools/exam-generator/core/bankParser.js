

/**
 * Parses a SOBT exam bank file that is wrapped like:
 *
 * var examBank = { ... };
 */

import { createExamBank } from './examModel.js';

export function parseBankFile(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Invalid exam bank file.');
  }

  // Remove "var examBank =" wrapper if present
  let cleaned = rawText.trim();

  cleaned = cleaned.replace(/^var\s+examBank\s*=\s*/i, '');
  cleaned = cleaned.replace(/;\s*$/, '');

  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error('Failed to parse exam bank JSON structure.');
  }

  return createExamBank(parsed);
}

/**
 * Extract all questions from the bank as a flat list
 * Useful for UI editing
 */
export function flattenQuestions(examBank) {
  const results = [];

  if (!examBank?.bank?.poolTOS) {
    return results;
  }

  examBank.bank.poolTOS.forEach((tos, tosIndex) => {
    const eos = tos.poolEOS;

    if (!eos || !Array.isArray(eos.questionItem)) return;

    eos.questionItem.forEach((q, questionIndex) => {
      results.push({
        tosIndex,
        questionIndex,
        question: q
      });
    });
  });

  return results;
}

/**
 * Replace a question inside the bank
 */
export function updateQuestion(examBank, tosIndex, questionIndex, newQuestion) {
  const tos = examBank?.bank?.poolTOS?.[tosIndex];

  if (!tos || !tos.poolEOS) {
    throw new Error('Invalid TOS index');
  }

  if (!Array.isArray(tos.poolEOS.questionItem)) {
    throw new Error('Invalid EOS question list');
  }

  tos.poolEOS.questionItem[questionIndex] = newQuestion;

  return examBank;
}

/**
 * Remove a question from the bank
 */
export function removeQuestion(examBank, tosIndex, questionIndex) {
  const tos = examBank?.bank?.poolTOS?.[tosIndex];

  if (!tos || !tos.poolEOS) {
    throw new Error('Invalid TOS index');
  }

  tos.poolEOS.questionItem.splice(questionIndex, 1);

  tos.poolEOS.display = String(tos.poolEOS.questionItem.length);

  return examBank;
}

/**
 * Add a question to a specific TOS
 */
export function addQuestion(examBank, tosIndex, question) {
  const tos = examBank?.bank?.poolTOS?.[tosIndex];

  if (!tos || !tos.poolEOS) {
    throw new Error('Invalid TOS index');
  }

  tos.poolEOS.questionItem.push(question);

  tos.poolEOS.display = String(tos.poolEOS.questionItem.length);

  return examBank;
}