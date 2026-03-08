

/**
 * Export SOBT exam bank back into the runtime format
 * Required format:
 *
 * var examBank = { ... };
 */

export function exportExamBankJS(examBank) {

  if (!examBank || typeof examBank !== 'object') {
    throw new Error('Invalid exam bank object');
  }

  const json = JSON.stringify(examBank, null, 2);

  return `var examBank = ${json};`;
}


/**
 * Download the exam bank file
 */
export function downloadExamBank(examBank, filename = 'examBank.js') {

  const jsContent = exportExamBankJS(examBank);

  const blob = new Blob([jsContent], { type: 'text/javascript' });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}


/**
 * Export as raw JSON (for debugging or conversion)
 */
export function exportExamBankJSON(examBank) {

  if (!examBank || typeof examBank !== 'object') {
    throw new Error('Invalid exam bank object');
  }

  return JSON.stringify(examBank, null, 2);
}


/**
 * Validate minimal SOBT structure before export
 */
export function validateExamBank(examBank) {

  if (!examBank?.bank) {
    throw new Error('Missing bank structure');
  }

  if (!Array.isArray(examBank.bank.poolTOS)) {
    throw new Error('Missing poolTOS array');
  }

  examBank.bank.poolTOS.forEach((tos, tIndex) => {

    if (!tos.poolEOS) {
      throw new Error(`TOS ${tIndex} missing poolEOS`);
    }

    if (!Array.isArray(tos.poolEOS.questionItem)) {
      throw new Error(`EOS ${tIndex} questionItem not an array`);
    }

    tos.poolEOS.questionItem.forEach((q, qIndex) => {

      if (!q.id) {
        throw new Error(`Question ${qIndex} missing id`);
      }

      if (!q.question) {
        throw new Error(`Question ${qIndex} missing text`);
      }

      if (!Array.isArray(q.choices)) {
        throw new Error(`Question ${qIndex} missing choices`);
      }

    });

  });

  return true;
}