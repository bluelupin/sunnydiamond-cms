// Explicit opt-in only: sends locally extracted fixture text to configured OpenAI.
// The original PDF/DOCX bytes never leave this process machine.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { fork } = require('node:child_process');
const { loadTs, makePdf } = require('./resume-test-helpers.cjs');

async function extract(file) {
  return new Promise((resolve, reject) => {
    const child = fork(path.resolve('scripts/resume-extract.mjs'), [], { silent: true });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Extraction timeout')); }, 60000);
    child.on('message', message => {
      clearTimeout(timer);
      if (message.ok) resolve(message.result); else reject(new Error(message.code));
    });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.send({ path: file, kind: 'pdf' });
  });
}
async function main() {
  assert.ok(process.argv.includes('--live'), 'Use --live to explicitly enable provider calls.');
  const dotenv = require('dotenv');
  try {
    const env = dotenv.parse(await fs.readFile('.env'));
    for (const name of ['OPENAI_API_KEY', 'OPENAI_RESUME_MODEL']) if (!process.env[name] && env[name]) process.env[name] = env[name];
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const { structureResumeText } = loadTs('src/api/submissions-job-opening/controllers/resume-parser.ts');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-live-tests-'));
  const lines = (texts, x = 40, y = 730) => texts.map((text, i) => ({ text, x, y: y - i * 22, size: 10 }));
  const career = ['Alex Morgan', 'Experience', 'Engineer, Acme Systems', 'January 2020 - January 2022',
    'Developed applications for internal teams.', 'Editor, Other Studio', 'February 2022 - February 2023',
    'Edited films and prepared project documentation.', 'Education', 'BA in Film, Example University', 'January 2016 - December 2019'];
  const contact = ['Contact', 'alex@example.com', '2025550123', 'Skills', 'Python', 'Adobe Premiere Pro', 'Languages', 'English'];
  const fixtures = [
    ['single-column', [lines([...career, ...contact])]],
    ['right-sidebar', [[...lines(career), ...lines(contact, 420)]]],
    ['left-sidebar', [[...lines(contact), ...lines(career, 240)]]],
    ['multipage', [lines(career), lines([...contact, 'Other information: available for remote work.'])]],
    ['tracked-dates', [lines([...career.map(text => text === 'January 2020 - January 2022' ? 'J A N U A R Y 2 0 2 0 - J A N U A R Y 2 0 2 2' : text), ...contact])]],
  ];
  let baseline;
  let failures = 0;
  try {
    for (const [name, pages] of fixtures) {
      const file = path.join(dir, `${name}.pdf`);
      await fs.writeFile(file, makePdf(pages));
      const extracted = await extract(file);
      const result = await structureResumeText(extracted.text, new AbortController().signal);
      try {
        assert.equal(result.data.fullName, 'Alex Morgan');
        assert.equal(result.data.emailId, 'alex@example.com');
        assert.equal(result.data.phoneNo, '2025550123');
        assert.equal(result.data.workExperience.relevantWorkExp, '3 years');
        assert.equal(result.data.workExperience.positions.length, 2);
        assert.equal(result.data.educationDetails.length, 1);
        assert.equal(result.data.educationDetails[0].completionYear, 2019);
        assert.deepEqual(result.data.skillsAndLanguages.Skills, [{ SkillName: 'Adobe Premiere Pro' }, { SkillName: 'Python' }]);
        assert.deepEqual(result.data.skillsAndLanguages.Languages, [{ SkillName: 'English' }]);
        if (baseline) assert.deepEqual(result.data, baseline); else baseline = result.data;
        console.log(`PASS ${name}: expected fields and cross-layout equality`);
      } catch (error) { failures++; console.log(`FAIL ${name}: ${error.message}`); }
    }
    const sourceIndex = process.argv.indexOf('--pdf');
    if (sourceIndex >= 0) {
      const extracted = await extract(path.resolve(process.argv[sourceIndex + 1]));
      let previous;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const result = await structureResumeText(extracted.text, new AbortController().signal);
        try {
          assert.equal(result.data.fullName, 'Kristen Connelly');
          assert.equal(result.data.workExperience.positions.length, 2);
          assert.ok(result.data.skillsAndLanguages.Skills.some(skill => skill.SkillName === 'Call Sheets & Sides'));
          assert.equal(result.data.educationDetails.find(entry => entry.institutionName?.includes('Boston University'))?.completionYear, null);
          if (previous) assert.deepEqual(result.data, previous);
          console.log(`PASS Sydney attempt ${attempt}: fields${previous ? ' and repeat equality' : ''}`);
        } catch (error) { failures++; console.log(`FAIL Sydney attempt ${attempt}: ${error.message}`); }
        previous = result.data;
      }
    }
  } finally {
    for (const name of await fs.readdir(dir)) await fs.unlink(path.join(dir, name));
    await fs.rmdir(dir);
  }
  assert.equal(failures, 0, `${failures} live validation failures`);
}
main().catch(error => {
  // Avoid printing SDK request objects, headers, or environment values.
  console.error(error.message); process.exitCode = 1;
});
