const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, stubs = {}) {
  const filename = path.resolve(__dirname, '..', file), module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (!name.startsWith('.')) return require(name);
    return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), stubs);
  }, module, module.exports);
  return module.exports;
}

class ValidationError extends Error {}
const { registerCareerSubmissionProtection } = load('src/utils/protect-career-submissions.ts', {
  '@strapi/utils': { errors: { ValidationError } },
});
const row = { documentId: 'application-1', jobID: 'JOB-1', jobTitle: 'Designer', workflowStatus: 'new',
  internalNotes: null, personalDetails: { id: 2, Name: 'Candidate', EmailId: 'candidate@example.com' },
  resume: { id: 3, documentId: 'resume-1' } };

function harness(data) {
  let middleware, nextCalls = 0;
  const strapi = { documents: { use: fn => { middleware = fn; } }, db: { query: () => ({ findOne: async () => row }) } };
  registerCareerSubmissionProtection(strapi);
  return { run: () => middleware({ uid: 'api::submissions-job-opening.submissions-job-opening', action: 'update',
    params: { documentId: row.documentId, data } }, async () => { nextCalls += 1; return {}; }), calls: () => nextCalls };
}

test('workflow status and internal notes remain editable', async () => {
  const testCase = harness({ workflowStatus: 'reviewing', internalNotes: 'Reviewed' });
  await assert.doesNotReject(testCase.run());
  assert.equal(testCase.calls(), 1);
});

test('submitted top-level and nested career fields cannot be changed', async () => {
  for (const data of [{ jobID: 'JOB-2' }, { personalDetails: { id: 2, Name: 'Changed', EmailId: 'candidate@example.com' } },
    { resume: { connect: [{ documentId: 'resume-2' }] } }]) {
    const testCase = harness(data);
    await assert.rejects(testCase.run(), /career application details are read-only/);
    assert.equal(testCase.calls(), 0);
  }
});

test('unchanged values and empty media operations do not block an operational save', async () => {
  const testCase = harness({ jobID: 'JOB-1', personalDetails: { Name: 'Candidate', EmailId: 'candidate@example.com' },
    resume: { connect: [], disconnect: [] }, workflowStatus: 'reviewing' });
  await assert.doesNotReject(testCase.run());
  assert.equal(testCase.calls(), 1);
});
