const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./resume-test-helpers.cjs');
const { normalizeResumeAutofill, structureResumeText, default: controller } = loadTs('src/api/submissions-job-opening/controllers/resume-parser.ts');
const { resumeDate, normalizeWorkDates, supportedDate } = loadTs('src/utils/resume-normalization.ts');
const NOW = new Date('2026-09-28T12:00:00Z');
const position = (startDate, endDate, company = 'Acme', jobTitle = 'Engineer') => ({ company, jobTitle, startDate, endDate });
const raw = positions => ({ fullName: 'Alex Morgan', emailId: 'alex@example.com', phoneNo: '+1 (202) 555-0123',
  educationDetails: [], workExperience: { relevantWorkExp: '99 years', currentCompany: 'Wrong', positions }, skillsAndLanguages: { Skills: [], Languages: [] } });

for (const [input, expected] of [['Jan 2020', 'January 2020'], ['Sept. 2020', 'September 2020'], ['2020-02', 'February 2020'], ['02/2020', 'February 2020'], ['2020', '2020'], ['Current', 'Present']]) {
  test(`canonical date: ${input}`, () => assert.equal(resumeDate(input).label, expected));
}
for (const value of ['Foo 2020', '2020-13', '00/2020', '1899', '2101', '2020-01-17', null]) {
  test(`reject ambiguous/invalid date: ${value}`, () => assert.equal(resumeDate(value), null));
}
test('overlapping, adjacent and duplicate jobs are not double-counted', () => {
  const result = normalizeWorkDates([position('Jan 2019', 'Feb 2021'), position('Feb 2021', 'Present'), position('Jan 2020', 'Jan 2022', 'Other'), position('January 2019', 'February 2021')], NOW);
  assert.equal(result.duration, '7 years 8 months');
  assert.equal(result.positions.length, 3);
  assert.equal(result.positions[0].endDate, 'Present');
});
test('gaps are excluded', () => assert.equal(normalizeWorkDates([position('Jan 2020', 'Jan 2021'), position('Jan 2023', 'Jan 2024')], NOW).duration, '2 years'));
test('future months excluded; scheduled roles retained', () => {
  const result = normalizeWorkDates([position('Jan 2026', 'Jan 2028'), position('Jan 2027', 'Jan 2029', 'Future')], NOW);
  assert.equal(result.duration, '8 months'); assert.equal(result.future, true);
});
test('year-only intervals explicitly approximate', () => {
  const result = normalizeWorkDates([position('2020', '2022')], NOW);
  assert.equal(result.duration, '2 years'); assert.equal(result.approximate, true);
});
test('missing or reversed dates return null instead of AI duration or partial total', () => {
  for (const bad of [position(null, 'Present'), position('2023', '2020'), position('nonsense', null)]) {
    const result = normalizeResumeAutofill(raw([position('2020', '2021'), bad]), '', NOW);
    assert.equal(result.data.workExperience.relevantWorkExp, null);
    assert.ok(result.warnings.some(value => value.includes('missing or invalid')));
  }
});
test('same-month job has zero elapsed months', () => assert.equal(normalizeWorkDates([position('January 2020', 'January 2020')], NOW).duration, '0 months'));
test('date evidence allows month abbreviations and rejects invented dates', () => {
  assert.equal(supportedDate('January 2020', 'Jan 2020 - Present'), 'January 2020');
  assert.equal(supportedDate('January 2021', 'Jan 2020 - Present'), null);
});
test('Sydney-style standalone date lines recover omitted jobs', () => {
  const source = 'Alex Morgan\nEmployment History\nEngineer, Acme, Boston\nFebruary 2021 — Present\nEditor, Other, Albany\nJanuary 2019 — February 2021\nSkills\nEditing';
  const result = normalizeResumeAutofill(raw([]), source, NOW);
  assert.equal(result.data.workExperience.positions.length, 2);
  assert.equal(result.data.workExperience.currentCompany, 'Acme, Boston');
  assert.equal(result.data.workExperience.relevantWorkExp, '7 years 8 months');
});
test('partial local recovery preserves additional model jobs', () => {
  const source = 'Employment History\nAcme | 2020 - 2022\nEngineer\nOther\nEditor\nJanuary 2018 - January 2019';
  const result = normalizeResumeAutofill(raw([position('January 2018', 'January 2019', 'Other', 'Editor')]), source, NOW);
  assert.equal(result.data.workExperience.positions.length, 2);
  assert.equal(result.data.workExperience.relevantWorkExp, '3 years');
});
test('same title/dates at different employers must not hide missing employer', () => {
  const source = 'Experience\nAcme | 2020 - 2022\nEngineer\nOther | 2020 - 2022\nEngineer';
  const result = normalizeResumeAutofill(raw([position('2020', '2022')]), source, NOW);
  assert.deepEqual(result.data.workExperience.positions.map(p => p.company).sort(), ['Acme', 'Other']);
});
test('local job evidence stabilizes optional location suffixes', () => {
  const source = 'Experience\nEngineer, Acme, Boston\nJanuary 2020 - Present';
  const first = normalizeResumeAutofill(raw([position('Jan 2020', 'Present', 'Acme')]), source, NOW);
  const second = normalizeResumeAutofill(raw([position('January 2020', 'Present', 'Acme, Boston')]), source, NOW);
  assert.deepEqual(first.data, second.data);
});
test('contact normalization, source evidence and stable skill ordering', () => {
  const input = raw([]);
  input.fullName = 'Invented Person';
  input.skillsAndLanguages = { Skills: [{ SkillName: 'python' }, { SkillName: 'Python' }, { SkillName: 'Adobe Premiere Pro' }, { SkillName: 'Invented' }], Languages: [{ SkillName: 'English' }, { SkillName: 'English' }] };
  const result = normalizeResumeAutofill(input, 'Alex Morgan\nalex@example.com\n+1 (202) 555-0123\nSkills\nPython\nAdobe Premiere Pro\nLanguages\nEnglish', NOW);
  assert.equal(result.data.fullName, null);
  assert.equal(result.data.phoneNo, '+12025550123');
  assert.deepEqual(result.data.skillsAndLanguages.Skills, [{ SkillName: 'Adobe Premiere Pro' }, { SkillName: 'Python' }]);
  assert.deepEqual(result.data.skillsAndLanguages.Languages, [{ SkillName: 'English' }]);
});
test('partial local education parsing does not drop courses', () => {
  const input = raw([]);
  input.educationDetails = [{ institutionName: 'Academy', degree: 'Editing Course', areaOfStudy: null, completionYear: 2023 }];
  const result = normalizeResumeAutofill(input, 'Education\nUniversity | 2018 - 2022\nBA in Film\nCourses\nEditing Course, Academy 2023', NOW);
  assert.equal(result.data.educationDetails.length, 2);
  assert.equal(result.data.educationDetails.find(e => e.institutionName === 'University').areaOfStudy, 'Film');
});
test('normalization stable across repeated calls and reordered positions/skills', () => {
  const input = raw([position('2020', '2021'), position('2022', 'Present', 'Other')]);
  const expected = normalizeResumeAutofill(input, '', NOW);
  for (let i = 0; i < 10; i++) {
    input.workExperience.positions.reverse();
    assert.deepEqual(normalizeResumeAutofill(input, '', NOW), expected);
  }
});
test('full printed qualification overrides shortened model degree consistently', () => {
  const input = raw([]);
  const source = 'Education\nBA in Film and Television, Boston University, Boston\nFebruary 2021 — Present\nCourses\nAdvanced Course in Digital Video Editing, ADMEC Multimedia Institute,\nOnline\nJanuary 2018 — July 2018';
  const results = ['BA', 'BA in Film and Television'].map(degree => {
    input.educationDetails = [{ institutionName: 'Boston University', degree, areaOfStudy: 'Film and Television', completionYear: null }];
    return normalizeResumeAutofill(input, source, NOW).data.educationDetails;
  });
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[0].length, 2);
  assert.equal(results[0][1].degree, 'BA in Film and Television');
  assert.equal(results[0][0].institutionName, 'ADMEC Multimedia Institute, Online');
});

const client = responses => ({ responses: { create: async (...args) => {
  const next = responses.shift();
  if (next instanceof Error) throw next;
  if (typeof next === 'function') return next(...args);
  return next;
} } });
const completed = value => ({ status: 'completed', output_text: JSON.stringify(value) });
test('fresh request has strict schema, no stored response, supported zero temperature', async () => {
  const previous = process.env.OPENAI_RESUME_MODEL;
  delete process.env.OPENAI_RESUME_MODEL;
  try {
    await structureResumeText('Alex Morgan', new AbortController().signal, client([request => {
      assert.equal(request.model, 'gpt-4.1-mini-2025-04-14');
      assert.equal(request.temperature, 0); assert.equal(request.store, false);
      assert.equal(request.text.format.strict, true);
      assert.equal(request.input[1].content, 'Alex Morgan');
      return completed(raw([]));
    }]));
  } finally { if (previous === undefined) delete process.env.OPENAI_RESUME_MODEL; else process.env.OPENAI_RESUME_MODEL = previous; }
});
test('model override without temperature support is not sent temperature', async () => {
  const previous = process.env.OPENAI_RESUME_MODEL;
  process.env.OPENAI_RESUME_MODEL = 'gpt-5-mini';
  try {
    await structureResumeText('Alex Morgan', new AbortController().signal, client([request => {
      assert.equal(Object.hasOwn(request, 'temperature'), false); return completed(raw([]));
    }]));
  } finally { if (previous === undefined) delete process.env.OPENAI_RESUME_MODEL; else process.env.OPENAI_RESUME_MODEL = previous; }
});
test('retry failure retains locally recoverable jobs', async () => {
  const result = await structureResumeText('Experience\nAcme | 2020 - 2022\nEngineer', new AbortController().signal,
    client([completed(raw([])), new Error('provider unavailable')]));
  assert.equal(result.data.workExperience.positions[0].company, 'Acme');
});
test('successful review recovers omitted positions', async () => {
  const result = await structureResumeText('Experience\nAcme | 2020 - 2022\nEngineer', new AbortController().signal,
    client([completed(raw([])), completed({ positions: [position('2020', '2022')] })]));
  assert.equal(result.data.workExperience.positions.length, 1);
});
test('client disconnect during review is propagated, not returned as successful recovery', async () => {
  const abort = new AbortController();
  await assert.rejects(structureResumeText('Experience\nAcme | 2020 - 2022\nEngineer', abort.signal,
    client([completed(raw([])), () => { abort.abort(); throw new Error('aborted'); }])), error => error.status === 499);
});
for (const response of [{ status: 'incomplete', output_text: '{}' }, { status: 'completed', output_text: 'invalid JSON' }, completed(null)]) {
  test(`invalid provider response rejected: ${response.output_text}`, async () => {
    await assert.rejects(structureResumeText('Alex Morgan', new AbortController().signal, client([response])), error => error.status === 502);
  });
}
test('request validation rejects missing/multiple/oversized resumes before provider call', async () => {
  const ctx = files => ({ request: { files, body: {} }, badRequest: message => ({ status: 400, message }), payloadTooLarge: message => ({ status: 413, message }) });
  assert.equal((await controller.parse(ctx({}))).status, 400);
  assert.equal((await controller.parse(ctx({ resume: [{ filepath: 'x' }] }))).status, 400);
  assert.equal((await controller.parse(ctx({ resume: { filepath: 'x', size: 6 * 1024 * 1024 } }))).status, 413);
});
