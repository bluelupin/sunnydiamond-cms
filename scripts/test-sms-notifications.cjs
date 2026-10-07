const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, stubs = {}) {
  const filename = path.resolve(__dirname, '..', file), module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (name === './process-sms-notifications') return { processSmsNotifications: async () => {} };
    if (!name.startsWith('.')) return require(name);
    return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), stubs);
  }, module, module.exports);
  return module.exports;
}
const { sendSms, normalizeSmsPhone } = load('src/utils/sms-service.ts');
const { enqueueSmsNotification: enqueue } = load('src/utils/sms-notification-queue.ts');
const config = { enabled: true, authKey: 'test-key', senderId: 'SNNYDS', templates: { careerApplicationReceived: 'career-flow' } };
const input = { applicationDocumentId: 'application-1', notificationType: 'careerApplicationReceived', recipient: '9876543210' };
const { processSmsNotifications: processQueue } = load('src/utils/process-sms-notifications.ts');
test('a new submission immediately triggers its own notification once and contains worker failure', async () => {
  const h = harness();
  const calls = [];
  const immediateEnqueue = load('src/utils/sms-notification-queue.ts', {
    './process-sms-notifications': { processSmsNotifications: async (_, request, documentId) => {
      assert.equal(request, undefined);
      assert.equal(h.rows.length, 1, 'Persist before processing');
      calls.push(documentId);
      throw new Error('private processing error');
    } },
  }).enqueueSmsNotification;
  assert.equal((await immediateEnqueue(h.strapi, input)).status, 'queued');
  assert.deepEqual(calls, [h.rows[0].documentId]);
  assert.equal(h.errors.length, 1);
  assert.equal((await immediateEnqueue(h.strapi, input)).status, 'existing');
  assert.equal(calls.length, 1);
});

test('immediate processing selects the submitted notification and safely overlaps cron', async () => {
  const h = workerHarness();
  let sends = 0;
  const request = async () => {
    sends++;
    await new Promise(resolve => setImmediate(resolve));
    return new Response(JSON.stringify({ type: 'success', message: 'id' }));
  };
  await processQueue(h.strapi, request, 'another-notification');
  assert.equal(sends, 0);
  await Promise.all([processQueue(h.strapi, request, h.row.documentId), processQueue(h.strapi, request)]);
  assert.equal(sends, 1);
  assert.equal(h.row.status, 'accepted');
});
test('Enquiry SMS uses its own approved flow while general contact keeps Getting in touch', async () => {
  const settings = load('config/sms.ts').default({ env: Object.assign((key, fallback) => fallback, { bool: () => true }) });
  settings.authKey = 'test-key';
  assert.equal(settings.messages.serviceEnquiryReceived, 'Thank you for inquiring about our service. Our team will contact you soon. Sunny Diamonds');
  const h = harness(settings);
  const { queueEnquirySms } = load('src/utils/enquiry-sms.ts');
  await queueEnquirySms(h.strapi, { documentId: 'product-enquiry', phone: '9876543210' }, 'serviceEnquiryReceived');
  assert.equal(h.rows[0].templateId, '6ac4c248225b42a41200a934');
  assert.equal(h.rows[0].notificationType, 'serviceEnquiryReceived');
  await sendSms(h.strapi, { notificationType: 'serviceEnquiryReceived', recipient: '9876543210' }, async (_, options) => {
    assert.equal(JSON.parse(options.body).flow_id, '6ac4c248225b42a41200a934');
    return new Response(JSON.stringify({ type: 'success', message: 'id' }));
  });
  await queueEnquirySms(h.strapi, { documentId: 'contact', phone: '9876543210' });
  assert.equal(h.rows[1].templateId, '6ac4c1f5afe16e84f200f943');
});
test('career acknowledgement queues and sends the supplied approved flow', async () => {
  const settings = load('config/sms.ts').default({ env: Object.assign((key, fallback) => fallback, { bool: () => true }) });
  settings.authKey = 'test-key';
  assert.equal(settings.messages.careerApplicationReceived, 'Your career application has received. Our team will contact you soon');
  const h = harness(settings);
  const { queueCareerApplicationSms } = load('src/utils/career-application-sms.ts');
  await queueCareerApplicationSms(h.strapi, { documentId: 'career-1', phone: '9876543210' });
  assert.equal(h.rows[0].templateId, '6ac4c22cfec5f8794e0b54a4');
  assert.equal(h.rows[0].notificationType, 'careerApplicationReceived');
  const result = await sendSms(h.strapi, input, async (_, options) => {
    assert.equal(JSON.parse(options.body).flow_id, '6ac4c22cfec5f8794e0b54a4');
    return new Response(JSON.stringify({ type: 'success', message: 'id' }));
  });
  assert.equal(result.status, 'accepted');
});
test('enquiries use the Getting in touch flow, deduplicate, and preserve saved submissions on queue failure', async () => {
  const settings = load('config/sms.ts').default({ env: Object.assign((key, fallback) => fallback, { bool: () => true }) });
  settings.authKey = 'test-key';
  assert.equal(settings.messages.enquiryReceived, 'Thank you for inquiring about our service. Our team will contact you soon.');
  const h = harness(settings);
  const { queueEnquirySms } = load('src/utils/enquiry-sms.ts');
  const enquiry = { documentId: 'enquiry-1', phone: '9876543210' };
  await queueEnquirySms(h.strapi, enquiry);
  await queueEnquirySms(h.strapi, enquiry);
  assert.equal(h.rows.length, 1);
  assert.equal(h.rows[0].templateId, '6ac4c1f5afe16e84f200f943');
  await sendSms(h.strapi, { notificationType: 'enquiryReceived', recipient: enquiry.phone }, async (_, options) => {
    assert.equal(JSON.parse(options.body).flow_id, '6ac4c1f5afe16e84f200f943');
    return new Response(JSON.stringify({ type: 'success', message: 'id' }));
  });
  assert.equal((await queueEnquirySms(h.strapi, { documentId: 'no-phone' })).status, 'skipped');
  h.records.create = async () => { throw new Error('database failure'); };
  assert.equal((await queueEnquirySms(h.strapi, { ...enquiry, documentId: 'enquiry-2' })).status, 'failed');
});
test('appointment acknowledgement uses the approved flow and deduplicates grouped bookings', async () => {
  const settings = load('config/sms.ts').default({ env: Object.assign((key, fallback) => fallback, { bool: () => true }) });
  settings.authKey = 'test-key';
  assert.equal(settings.messages.appointmentRequestReceived, 'Your appointment request is under consideration. Our team will contact you soon');
  const h = harness(settings);
  const { queueAppointmentRequestSms } = load('src/utils/appointment-request-sms.ts');
  const booking = { documentId: 'group-1', phone: '9876543210' };
  await queueAppointmentRequestSms(h.strapi, booking);
  await queueAppointmentRequestSms(h.strapi, booking);
  assert.equal(h.rows.length, 1);
  assert.equal(h.rows[0].templateId, '6ac4c1d39d00097de90045b2');
  await sendSms(h.strapi, { notificationType: 'appointmentRequestReceived', recipient: booking.phone }, async (_, options) => {
    assert.equal(JSON.parse(options.body).flow_id, '6ac4c1d39d00097de90045b2');
    return new Response(JSON.stringify({ type: 'success', message: 'id' }));
  });
  h.records.create = async () => { throw new Error('database failure'); };
  assert.equal((await queueAppointmentRequestSms(h.strapi, { ...booking, documentId: 'group-2' })).status, 'failed');
});
function workerHarness(overrides = {}) {
  const row = { id: 1, documentId: 'sms-1', ...input, status: 'pending', attempts: 0, templateId: 'saved-flow', nextAttemptAt: null, ...overrides };
  function matches(record, where) {
    return Object.entries(where).every(([key, value]) => {
      if (key === '$or') return value.some(part => matches(record, part));
      if (value && typeof value === 'object') return Object.entries(value).every(([op, target]) =>
        op === '$null' ? record[key] == null : op === '$lt' ? record[key] < target : record[key] <= target);
      return record[key] === value;
    });
  }
  const errors = [];
  const settings = { ...config, maxAttempts: 3, retryDelaySeconds: 60 };
  const records = {
    findMany: async ({ where }) => matches(row, where) ? [{ ...row }] : [],
    updateMany: async ({ where, data }) => {
      if (!matches(row, where)) return { count: 0 };
      Object.assign(row, data); return { count: 1 };
    },
  };
  return { row, settings, records, strapi: { config: { get: () => settings }, db: { query: () => records }, log: { error: message => errors.push(message) } }, errors };
}
test('worker atomically claims overlapping runs and uses the queued template snapshot', async () => {
  const h = workerHarness(); let sends = 0;
  const request = async (_, options) => {
    sends++;
    assert.equal(JSON.parse(options.body).flow_id, 'saved-flow');
    await new Promise(resolve => setImmediate(resolve));
    return new Response(JSON.stringify({ type: 'success', message: 'message-id' }));
  };
  await Promise.all([processQueue(h.strapi, request), processQueue(h.strapi, request)]);
  assert.equal(sends, 1);
  assert.equal(h.row.status, 'accepted');
  assert.equal(h.row.providerMessageId, 'message-id');
  assert.equal(h.row.attempts, 1);
  assert.ok(h.row.acceptedAt);
  await processQueue(h.strapi, request);
  assert.equal(sends, 1);
});
test('explicit rate-limit rejection backs off and stops at the attempt cap', async () => {
  const h = workerHarness(); let sends = 0;
  const request = async () => { sends++; return new Response(JSON.stringify({ type: 'error' }), { status: 429 }); };
  await processQueue(h.strapi, request);
  assert.equal(h.row.status, 'pending');
  assert.ok(Date.parse(h.row.nextAttemptAt) > Date.now());
  await processQueue(h.strapi, request);
  assert.equal(sends, 1);
  h.row.nextAttemptAt = null;
  await processQueue(h.strapi, request);
  assert.ok(Date.parse(h.row.nextAttemptAt) > Date.now() + 100000);
  h.row.nextAttemptAt = null;
  await processQueue(h.strapi, request);
  assert.equal(h.row.status, 'failed');
  assert.equal(sends, 3);
  assert.equal(h.row.nextAttemptAt, null);
});
test('timeouts, malformed responses and interrupted workers are never automatically resent', async () => {
  for (const request of [async () => { throw new Error('timeout'); }, async () => new Response('bad gateway', { status: 502 })]) {
    const h = workerHarness();
    await processQueue(h.strapi, request);
    assert.equal(h.row.status, 'unknown');
    await processQueue(h.strapi, () => assert.fail('must not resend'));
  }
  const stale = workerHarness({ status: 'processing', attempts: 1, lastAttemptAt: '2000-01-01T00:00:00.000Z' });
  await processQueue(stale.strapi, () => assert.fail('must not resend'));
  assert.equal(stale.row.status, 'unknown');
  assert.equal(stale.row.lastErrorCode, 'worker-interrupted');
});
test('worker respects disabled configuration and terminal rejections', async () => {
  const disabled = workerHarness(); disabled.settings.enabled = false;
  await processQueue(disabled.strapi, () => assert.fail('disabled'));
  assert.equal(disabled.row.attempts, 0);
  const failed = workerHarness();
  await processQueue(failed.strapi, async () => new Response(JSON.stringify({ type: 'error' }), { status: 400 }));
  assert.equal(failed.row.status, 'failed');
  await processQueue(failed.strapi, () => assert.fail('terminal failure'));
});
test('failure to record acceptance preserves claim instead of permitting duplicate delivery', async () => {
  const h = workerHarness();
  const update = h.records.updateMany;
  h.records.updateMany = async args => {
    if (args.data.status === 'accepted') throw new Error('database unavailable');
    return update(args);
  };
  await processQueue(h.strapi, async () => new Response(JSON.stringify({ type: 'success', message: 'id' })));
  assert.equal(h.row.status, 'processing');
  assert.equal(h.errors.length, 1);
  await processQueue(h.strapi, () => assert.fail('must not resend'));
});
function harness(settings = config) {
  const rows = [], events = [], errors = [];
  const records = {
    findOne: async ({ where }) => rows.find(row => row.deduplicationKey === where.deduplicationKey),
    create: async ({ data }) => {
      events.push('queue');
      if (rows.some(row => row.deduplicationKey === data.deduplicationKey)) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
      rows.push(data); return data;
    },
  };
  return { rows, events, errors, records, strapi: { config: { get: () => settings },
    db: { query: () => records }, log: { error: message => errors.push(message) } } };
}
test('phone formatting handles Indian national/international numbers and rejects malformed values', () => {
  for (const phone of ['9876543210', '+91 98765 43210', '919876543210', '09876543210']) assert.equal(normalizeSmsPhone(phone), '919876543210');
  assert.equal(normalizeSmsPhone('+1 (415) 555-2671'), '14155552671');
  for (const phone of ['', '123', '9876543210 ext 1', '+91 12345 67890', '++919876543210']) assert.equal(normalizeSmsPhone(phone), undefined);
});
test('service sends the configured flow and distinguishes acceptance, rejection, and uncertain outcomes', async () => {
  const { strapi } = harness();
  const accepted = await sendSms(strapi, input, async (url, options) => {
    assert.equal(url, 'https://api.msg91.com/api/v5/flow/');
    assert.equal(options.headers.authkey, 'test-key');
    assert.deepEqual(JSON.parse(options.body), { flow_id: 'career-flow', sender: 'SNNYDS', recipients: [{ mobiles: '919876543210' }] });
    return new Response(JSON.stringify({ type: 'success', message: 'provider-id' }));
  });
  assert.deepEqual(accepted, { status: 'accepted', providerMessageId: 'provider-id' });
  assert.equal((await sendSms(strapi, input, async () => new Response(JSON.stringify({ type: 'error', message: 'private details' })))).status, 'rejected');
  assert.equal((await sendSms(strapi, input, async () => new Response('bad gateway', { status: 502 }))).status, 'unknown');
  const timeout = await sendSms(strapi, input, async () => { throw new Error('private timeout details'); });
  assert.deepEqual(timeout, { status: 'unknown', reason: 'transport-error' });
});
test('disabled/missing configuration and invalid numbers never enqueue or call provider', async () => {
  for (const settings of [{ ...config, enabled: false }, { ...config, templates: {} }]) {
    const h = harness(settings);
    assert.equal((await enqueue(h.strapi, input)).status, 'skipped');
    assert.equal((await sendSms(h.strapi, input, () => assert.fail('unexpected network call'))).status, 'skipped');
    assert.equal(h.rows.length, 0);
  }
  const h = harness();
  assert.equal((await enqueue(h.strapi, { ...input, recipient: 'bad' })).reason, 'invalid-recipient');
  assert.equal((await sendSms(h.strapi, { ...input, recipient: 'bad' }, () => assert.fail())).reason, 'invalid-recipient');
});
test('queue deduplicates concurrent requests per application, including changed recipient', async () => {
  const h = harness();
  const results = await Promise.all([enqueue(h.strapi, input), enqueue(h.strapi, input)]);
  assert.deepEqual(results.map(result => result.status).sort(), ['existing', 'queued']);
  assert.equal(h.rows.length, 1);
  assert.equal(h.rows[0].recipient, '919876543210');
  assert.equal(h.rows[0].status, 'pending');
  assert.equal((await enqueue(h.strapi, { ...input, recipient: '9876543211' })).status, 'existing');
  await enqueue(h.strapi, { ...input, applicationDocumentId: 'application-2' });
  assert.equal(h.rows.length, 2);
});
test('career submission queues only after save and upload; queue failure does not fail application', async () => {
  for (const scenario of ['success', 'save-failure', 'upload-failure', 'queue-failure', 'disabled']) {
    const h = harness({ ...config, enabled: scenario !== 'disabled' });
    if (scenario === 'queue-failure') h.records.create = async () => { h.events.push('queue'); throw new Error('private database error'); };
    h.strapi.documents = () => ({
      findFirst: async () => ({ jobID: 'JOB-1', title: 'Designer' }),
      create: async () => {
        h.events.push('save'); if (scenario === 'save-failure') throw new Error(scenario);
        return { id: 1, documentId: 'application-1', jobID: 'JOB-1', workflowStatus: 'new' };
      },
      delete: async () => h.events.push('delete'),
    });
    h.strapi.plugin = () => ({ service: () => ({ upload: async () => {
      h.events.push('upload'); if (scenario === 'upload-failure') throw new Error(scenario);
    } }) });
    const controller = load('src/api/submissions-job-opening/controllers/submissions-job-opening.ts', {
      '@strapi/strapi': { factories: { createCoreController: (_, factory) => factory({ strapi: h.strapi }) } },
      '../../../utils/form-submission-rate-limit': { checkFormSubmissionRateLimit: () => ({ allowed: true }), clientIp: () => '127.0.0.1' },
      '../../../utils/career-application-email': { sendCareerApplicationReceivedEmail: async () => h.events.push('email') },
    }).default;
    const ctx = { ip: '127.0.0.1', badRequest: message => { throw new Error(message); }, request: {
      body: { jobID: 'JOB-1', personalDetails: { Name: 'Candidate', PhoneNo: '9876543210', EmailId: 'candidate@example.com', DOB: '2000-01-01', Gender: 'Female' },
        educationDetails: { Degree: 'BA', AreaOfStudy: 'Design', Year: 2020 },
        workExperience: { RelvWorkExp: '2 years', ExpecCtc: 5 }, addInfo: { relation: false } },
      files: { resume: { originalFilename: 'resume.pdf', mimetype: 'application/pdf', size: 100 } },
    } };
    if (scenario === 'save-failure' || scenario === 'upload-failure') {
      await assert.rejects(controller.submit(ctx), new RegExp(scenario));
      assert.equal(h.rows.length, 0);
      assert.ok(!h.events.includes('queue'));
      if (scenario === 'upload-failure') assert.deepEqual(h.events, ['save', 'upload', 'delete']);
    } else {
      await controller.submit(ctx);
      assert.equal(ctx.status, 201);
      assert.deepEqual(h.events, scenario === 'disabled' ? ['save', 'upload', 'email'] : ['save', 'upload', 'queue', 'email']);
      assert.equal(h.rows.length, scenario === 'success' ? 1 : 0);
      if (scenario === 'queue-failure') {
        assert.equal(h.errors.length, 1);
        assert.ok(!h.errors[0].includes('private database error'));
      }
    }
  }
});
