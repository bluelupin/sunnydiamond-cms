const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file) {
  const filename = path.resolve(__dirname, '..', file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (!name.startsWith('.')) return require(name);
    return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')));
  }, module, module.exports);
  return module.exports;
}

const template = load('src/emails/career-application-received.ts').careerApplicationReceivedTemplate;
const { sendCareerApplicationReceivedEmail: send } = load('src/utils/career-application-email.ts');

function mailMock(fail = false) {
  const sent = [], errors = [];
  return { sent, errors, log: { info() {}, error: message => errors.push(message) },
    plugin: () => ({ service: () => ({ send: async message => {
      if (fail) throw new Error('secret-provider-details');
      sent.push(message);
    } }) }),
  };
}

test('career acknowledgement follows supplied copy and escapes the candidate name', () => {
  const message = template({ candidateName: '<Candidate & Co>' });
  assert.equal(message.subject, 'Thank You for Your Interest in Sunny Diamonds');
  assert.match(message.text, /successfully received your application and resume/);
  assert.match(message.html, /Dear &lt;Candidate &amp; Co&gt;/);
  assert.ok(!message.html.includes('<Candidate'));
});

test('career acknowledgement is delivered only to a valid candidate email', async () => {
  const strapi = mailMock();
  const data = { documentId: 'application-1', candidateName: 'Candidate', candidateEmail: 'candidate@example.com' };
  await send(strapi, data);
  assert.equal(strapi.sent.length, 1);
  assert.equal(strapi.sent[0].to, data.candidateEmail);
  for (const candidateEmail of [undefined, '', 'a@example.com,b@example.com', 'bad\r\nBcc:x@example.com']) {
    await send(strapi, { ...data, candidateEmail });
  }
  assert.equal(strapi.sent.length, 1);
});

test('provider failure does not fail the saved career application or expose provider details', async () => {
  const strapi = mailMock(true);
  await assert.doesNotReject(send(strapi, {
    documentId: 'application-1', candidateName: 'Candidate', candidateEmail: 'candidate@example.com',
  }));
  assert.equal(strapi.errors.length, 1);
  assert.ok(!strapi.errors[0].includes('secret-provider-details'));
});
