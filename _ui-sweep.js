const { chromium } = require('C:/Users/atchu asvin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs = require('fs');

const ctx = JSON.parse(fs.readFileSync('_ui-test-context.json', 'utf8'));
const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const dbHeaders = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };

async function setRole(userId, role) {
  await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, { method: 'PATCH', headers: dbHeaders, body: JSON.stringify({ role }) });
}

const OUT = 'C:/Users/ATCHUA~1/AppData/Local/Temp/ui-sweep';
fs.mkdirSync(OUT, { recursive: true });

async function checkOverflow(page) {
  return page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    return { hasOverflow: docWidth > winWidth + 1, docWidth, winWidth };
  });
}

async function snap(page, url, width, label) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }).catch((e) => console.log('nav error', url, e.message));
  await page.waitForTimeout(700);
  const overflow = await checkOverflow(page);
  const fname = `${label}-${width}.png`;
  await page.screenshot({ path: `${OUT}/${fname}`, fullPage: true });
  console.log(fname, overflow.hasOverflow ? `OVERFLOW! docWidth=${overflow.docWidth} winWidth=${overflow.winWidth}` : 'ok');
  return overflow;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const widths = [375, 768, 1280];

  // Public pages
  for (const w of widths) await snap(page, 'http://localhost:3000/', w, 'landing');
  for (const w of widths) await snap(page, 'http://localhost:3000/login', w, 'login');
  for (const w of widths) await snap(page, 'http://localhost:3000/register', w, 'register-picker');

  // Register forms (click into each)
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^Individual/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/register-individual-375.png`, fullPage: true });
  await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^Institution/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/register-institution-375.png`, fullPage: true });

  // Login as rich participant
  const loginAs = async (email) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', ctx.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
  };

  await loginAs(ctx.richParticipant.email);
  for (const w of widths) await snap(page, 'http://localhost:3000/participant', w, 'participant-dashboard');
  for (const w of widths) await snap(page, `http://localhost:3000/participant/${ctx.hackathonId}`, w, 'participant-hackathon-detail');
  for (const w of widths) await snap(page, 'http://localhost:3000/participant/teams', w, 'participant-teams');
  for (const w of widths) await snap(page, 'http://localhost:3000/participant/submissions', w, 'participant-submissions');
  for (const w of widths) await snap(page, 'http://localhost:3000/results', w, 'results');
  for (const w of widths) await snap(page, 'http://localhost:3000/certificates', w, 'certificates');
  for (const w of widths) await snap(page, 'http://localhost:3000/profile', w, 'profile');

  // Submission modal
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`http://localhost:3000/participant/${ctx.hackathonId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const submitBtn = page.locator('button:has-text("Submit Project")');
  if (await submitBtn.count()) {
    await submitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/submission-modal-375.png`, fullPage: true });
  }

  // Now switch the multiRole account through admin/jury/college
  await loginAs(ctx.multiRole.email);
  for (const [role, path, label] of [['college', '/college', 'college-dashboard'], ['jury', '/jury', 'jury-dashboard'], ['admin', '/admin', 'admin-dashboard']]) {
    await setRole(ctx.multiRole.userId, role);
    for (const w of widths) await snap(page, `http://localhost:3000${path}`, w, label);
  }
  for (const w of widths) await snap(page, 'http://localhost:3000/college/students', w, 'college-students');
  for (const w of widths) await snap(page, 'http://localhost:3000/college/leaderboard', w, 'college-leaderboard');
  for (const w of widths) await snap(page, 'http://localhost:3000/jury/submissions', w, 'jury-submissions');
  for (const w of widths) await snap(page, 'http://localhost:3000/jury/scoring', w, 'jury-scoring');
  for (const w of widths) await snap(page, 'http://localhost:3000/admin/colleges', w, 'admin-colleges');
  for (const w of widths) await snap(page, 'http://localhost:3000/admin/registrations', w, 'admin-registrations');

  await browser.close();
  console.log('\ndone - screenshots in', OUT);
}

main().catch((err) => { console.error(err); process.exit(1); });
