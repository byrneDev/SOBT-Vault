

export function createChoice(choice = '', correct = false) {
  return {
    correct: Boolean(correct),
    choice: String(choice ?? '')
  };
}

export function createQuestion(overrides = {}) {
  const incomingChoices = Array.isArray(overrides.choices) ? overrides.choices : [];

  return {
    id: String(overrides.id ?? ''),
    shuffleChoices: overrides.shuffleChoices !== undefined ? Boolean(overrides.shuffleChoices) : true,
    questionType: String(overrides.questionType ?? 'MC'),
    weight: String(overrides.weight ?? '1.0'),
    imageName: String(overrides.imageName ?? '0'),
    altText: String(overrides.altText ?? 'None'),
    question: String(overrides.question ?? ''),
    choices: incomingChoices.map((item) => createChoice(item.choice, item.correct)),
    remediation: String(overrides.remediation ?? ''),
    remediationType: String(overrides.remediationType ?? 'TextBox'),
    remediationLink: String(overrides.remediationLink ?? 'None')
  };
}

export function createEOS(overrides = {}) {
  const incomingQuestions = Array.isArray(overrides.questionItem) ? overrides.questionItem : [];

  return {
    category: String(overrides.category ?? 'TO1: Enabling Objective Group 1'),
    display: String(overrides.display ?? '0'),
    questionItem: incomingQuestions.map((item) => createQuestion(item))
  };
}

export function createTOS(overrides = {}) {
  return {
    category: String(overrides.category ?? 'Terminal Objective Group 1'),
    poolEOS: createEOS(overrides.poolEOS ?? {})
  };
}

export function createExamBank(overrides = {}) {
  const bankOverrides = overrides.bank ?? overrides;
  const incomingPools = Array.isArray(bankOverrides.poolTOS) ? bankOverrides.poolTOS : [];

  return {
    bank: {
      passingScore: String(bankOverrides.passingScore ?? '80'),
      randomQuestions: bankOverrides.randomQuestions !== undefined ? Boolean(bankOverrides.randomQuestions) : false,
      randomChoices: bankOverrides.randomChoices !== undefined ? Boolean(bankOverrides.randomChoices) : false,
      debugMode: bankOverrides.debugMode !== undefined ? Boolean(bankOverrides.debugMode) : false,
      displayALL: bankOverrides.displayALL !== undefined ? Boolean(bankOverrides.displayALL) : true,
      examInstructions: String(
        bankOverrides.examInstructions ??
          'In this examination, you will be asked a series of questions designed to evaluate your comprehension of the material presented.'
      ),
      poolTOS: incomingPools.map((item) => createTOS(item))
    }
  };
}

export function cloneExamBank(examBank) {
  return createExamBank(JSON.parse(JSON.stringify(examBank ?? {})));
}

export function normalizeQuestionType(value) {
  const normalized = String(value ?? '').trim().toUpperCase();

  if (normalized === 'MA') {
    return 'MA';
  }

  return 'MC';
}

export function ensureQuestionHasValidChoices(question) {
  const normalizedQuestion = createQuestion(question);

  if (!Array.isArray(normalizedQuestion.choices)) {
    normalizedQuestion.choices = [];
  }

  return normalizedQuestion;
}

export function addTOS(examBank, tosOverrides = {}) {
  examBank.bank.poolTOS.push(createTOS(tosOverrides));
  return examBank;
}

export function addQuestionToEOS(examBank, tosIndex, questionOverrides = {}) {
  const tos = examBank?.bank?.poolTOS?.[tosIndex];

  if (!tos || !tos.poolEOS) {
    throw new Error('Invalid TOS index.');
  }

  tos.poolEOS.questionItem.push(createQuestion(questionOverrides));
  tos.poolEOS.display = String(tos.poolEOS.questionItem.length);

  return examBank;
}

export function setEOSDisplayFromQuestionCount(examBank, tosIndex) {
  const tos = examBank?.bank?.poolTOS?.[tosIndex];

  if (!tos || !tos.poolEOS) {
    throw new Error('Invalid TOS index.');
  }

  tos.poolEOS.display = String(tos.poolEOS.questionItem.length);
  return examBank;
}