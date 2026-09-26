#!/usr/bin/env node
/**
 * CR-C3 appointment checks against a running CMS (AP-3 limit, AP-4 pieces, AP-5 customer-only).
 *
 * Env:
 *   CMS_URL         e.g. https://sunnydiamonds-cms-dev.on-forge.com
 *   CMS_API_TOKEN   the website server's CMS API token (never commit it)
 *   QA_EMAIL        optional customer inbox, default sd-c3-qa@yopmail.com
 *
 * Leaves behind: cancelled appointments for a synthetic customer id (printed), and the
 * booking / reschedule / piece-added emails in QA_EMAIL and the Kochi showroom inbox.
 * The CMS allows 5 bookings per form per 6 minutes per IP, so wait 6 minutes between runs.
 */
const base = process.env.CMS_URL?.replace(/\/$/, '');
const token = process.env.CMS_API_TOKEN;
const email = process.env.QA_EMAIL || 'sd-c3-qa@yopmail.com';
if (!base || !token) { console.error('Set CMS_URL and CMS_API_TOKEN.'); process.exit(2); }

const customerId = 1_900_000_000 + (Math.floor(Date.now() / 1000) % 1_000_000);
const results = [];
const check = (id, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` - ${detail}` : ''}`); };

async function call(method, path, body) {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify({ data: body }) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json, message: json?.error?.message ?? '' };
}
const asCustomer = (id = customerId) => ({ magentoCustomerId: id });
const list = async () => (await call('GET', `/customer/appointments?magentoCustomerId=${customerId}&pageSize=50`)).json.data ?? [];
const find = (rows, documentId) => rows.find(row => row.documentId === documentId || row.products?.some(p => p.documentId === documentId));

const istDay = offset => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
  .format(new Date(Date.now() + offset * 86_400_000));

async function form(formTag) {
  const query = `filters[formTag][$eq]=${formTag}&populate[availableTimeSlots]=true&populate[showroomOptions]=true`;
  return (await call('GET', `/product-forms?${query}`)).json.data?.[0];
}

const contact = { customerName: 'C3 QA', customerPhone: '9876543210', customerEmail: email, consentAccepted: true };
async function book(formTag, date, slot, extra = {}) {
  const res = await call('POST', '/product-submissions/submit', {
    ...asCustomer(), ...contact, formTag, requestedDate: date, selectedTimeSlot: slot,
    productName: 'C3 QA ring', productId: 'C3-QA-RING', sourcePage: '/jewellery', ...extra,
  });
  if (res.status !== 200) throw new Error(`booking ${formTag} failed: ${res.status} ${res.message}`);
  return res.json.data;
}
const reschedule = (documentId, date, slot, extra = {}) => call('POST', `/customer/appointments/${documentId}/reschedule`,
  { ...asCustomer(), requestedDate: date, selectedTimeSlot: slot, ...extra });
const addPiece = (documentId, productId, id = customerId, productPath = `/jewellery/${productId.toLowerCase()}`) =>
  call('POST', `/customer/appointments/${documentId}/pieces`, { ...asCustomer(id), productId, productName: `QA piece ${productId}`, productPath });
const cancel = documentId => call('POST', `/customer/appointments/${documentId}/cancel`, asCustomer());

const LIMIT = 'You have already rescheduled this appointment twice. Please contact us.';
console.log(`CMS ${base} · synthetic customer ${customerId} · inbox ${email}`);

const visitForm = await form('product-store-visit');
const videoForm = await form('product-video-call');
const homeForm = (await form('try-at-home-form')) ?? (await form('try-at-home'));
const slot = f => f.availableTimeSlots[0].timeString;
const kochi = visitForm.showroomOptions?.find(s => /kochi/i.test(s.city))?.documentId ??
  (await call('GET', '/showrooms?filters[city][$eq]=Kochi')).json.data?.[0]?.documentId;

// AP-3: single booking
const a = await book('product-store-visit', istDay(10), slot(visitForm), { preferredShowroom: kochi });
check('AP-3 reschedule 1', (await reschedule(a.documentId, istDay(11), slot(visitForm))).status === 200);
check('AP-3 reschedule 2', (await reschedule(a.documentId, istDay(12), slot(visitForm))).status === 200);
const third = await reschedule(a.documentId, istDay(13), slot(visitForm));
check('AP-3 third reschedule refused', third.status === 400 && third.message === LIMIT, `${third.status} ${third.message}`);
const contactEdit = await reschedule(a.documentId, istDay(12), slot(visitForm), { customerName: 'C3 QA edited' });
check('AP-3 contact edit still allowed at the limit', contactEdit.status === 200 && contactEdit.json.meta?.changed === true);
check('AP-3 list shows no reschedules left', find(await list(), a.documentId)?.reschedulesLeft === 0);

// AP-3: try-at-home group
const home = await book(homeForm.formTag, istDay(10), slot(homeForm), {
  addressLine1: '1 QA Street', city: 'Kochi', pincode: '682001', stateName: 'Kerala' });
check('AP-3 group reschedule 1', (await reschedule(home.documentId, istDay(11), slot(homeForm))).status === 200);
check('AP-3 group reschedule 2', (await reschedule(home.documentId, istDay(12), slot(homeForm))).status === 200);
const groupThird = await reschedule(home.documentId, istDay(13), slot(homeForm));
check('AP-3 group third reschedule refused', groupThird.status === 400 && groupThird.message === LIMIT, `${groupThird.status} ${groupThird.message}`);
check('AP-3 group list shows no reschedules left', find(await list(), home.documentId)?.reschedulesLeft === 0);

// AP-4: pieces
const b = await book('product-store-visit', istDay(10), slot(visitForm), { preferredShowroom: kochi });
const open = (await call('GET', `/customer/appointments/open?magentoCustomerId=${customerId}`)).json.data ?? [];
check('AP-4 open list offers the booking', open.some(row => row.documentId === b.documentId && row.productIds.includes('C3-QA-RING') && row.showroomCity));
const added = await addPiece(b.documentId, 'C3-QA-PENDANT');
check('AP-4 piece added', added.status === 200 && added.json.meta?.changed === true &&
  added.json.data?.productIds?.join() === 'C3-QA-RING,C3-QA-PENDANT', `${added.status} ${added.message}`);
const again = await addPiece(b.documentId, 'C3-QA-PENDANT');
check('AP-4 same piece again changes nothing', again.status === 200 && again.json.meta?.changed === false);
const listed = find(await list(), b.documentId);
check('AP-4 My Account lists both pieces', listed?.products?.map(p => p.productId).join() === 'C3-QA-RING,C3-QA-PENDANT');
await reschedule(b.documentId, istDay(11), slot(visitForm));
check('AP-4 reschedule keeps the pieces', find(await list(), b.documentId)?.products?.length === 2);
const stranger = await addPiece(b.documentId, 'C3-QA-EARRING', customerId + 1);
check('AP-4 another customer cannot add', stranger.status === 404, String(stranger.status));
const badPath = await addPiece(b.documentId, 'C3-QA-EARRING', customerId, 'https://example.com/x');
check('AP-4 outside link refused', badPath.status === 400, String(badPath.status));
const v = await book('product-video-call', istDay(10), slot(videoForm));
const videoPiece = await addPiece(v.documentId, 'C3-QA-BANGLE');
check('AP-4 piece added to a video call', videoPiece.status === 200 && videoPiece.json.meta?.changed === true, `${videoPiece.status} ${videoPiece.message}`);
await cancel(b.documentId);
const afterCancel = await addPiece(b.documentId, 'C3-QA-EARRING');
check('AP-4 cancelled appointment refused', afterCancel.status === 400, `${afterCancel.status} ${afterCancel.message}`);
const earliest = slot(videoForm);
const startedAt = new Date(Date.parse(`${istDay(0)}T00:00:00+05:30`) + (() => {
  const m = earliest.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i); return m ? ((+m[1] % 12) + (/pm/i.test(m[3]) ? 12 : 0)) * 3_600_000 + m[2] * 60_000 : 0;
})());
if (startedAt < new Date()) {
  const today = await book('product-video-call', istDay(0), earliest);
  const late = await addPiece(today.documentId, 'C3-QA-EARRING');
  check('AP-4 started appointment refused', late.status === 400 && /started/.test(late.message), `${late.status} ${late.message}`);
  await cancel(today.documentId);
} else console.log(`SKIP AP-4 started appointment refused - today's ${earliest} slot has not started yet`);

// AP-5: every customer route needs a customer id from the website server
for (const [label, method, path] of [
  ['list', 'GET', '/customer/appointments?formTag=product-store-visit&documentId=' + a.documentId],
  ['open', 'GET', '/customer/appointments/open'],
  ['cancel', 'POST', `/customer/appointments/${a.documentId}/cancel`],
  ['reschedule', 'POST', `/customer/appointments/${a.documentId}/reschedule`],
  ['pieces', 'POST', `/customer/appointments/${a.documentId}/pieces`],
]) {
  const res = await call(method, path, method === 'POST' ? { requestedDate: istDay(14), selectedTimeSlot: slot(visitForm) } : undefined);
  check(`AP-5 guest ${label} refused`, res.status === 400, String(res.status));
}

for (const doc of [a.documentId, home.documentId, v.documentId]) await cancel(doc);
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed · customer ${customerId} rows left cancelled`);
process.exit(passed === results.length ? 0 : 1);
