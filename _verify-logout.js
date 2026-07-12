const { chromium } = require('C:/Users/atchu asvin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };

async function rest(path, method, body) {
  const res = await fetch(SUPABASE_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const TEST_EMAIL = `logout-verify-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
const OUT_DIR = 'C:/Users/ATCHUA~1/AppData/Local/Temp/logout-verify';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const userData = await rest('/auth/v1/admin/users', 'POST', { email: TEST_EMAIL, password: TEST_PASSWORD, email_confirm: true });
  const userId = userData.id;
  console.log('created test user', userId);
  await rest('/rest/v1/users', 'POST', { id: userId, email: TEST_EMAIL, full_name: 'Logout Verify', role: 'participant', status: 'active' });
  await rest('/rest/v1/participant_profiles', 'POST', {
    user_id: userId, college_name: 'Test College', passout_year: 2026, degree: 'B.Tech',
    domain: 'CS', experience_level: 'fresher', contact_number: '9999999999', address: 'Test',
  });

  const browser = await chromium.launch();
  try {
    for (const [label, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 375, height: 800 }]]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();

      await page.goto('https://hackathon.adz4needz.com/login', { waitUntil: 'networkidle' });
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
      console.log(label, '- after login, url:', page.url());

      const cookiesBeforeLogout = await context.cookies();
      const sbCookiesBefore = cookiesBeforeLogout.filter(c => c.name.startsWith('sb-'));
      console.log(label, '- sb cookies before logout:', sbCookiesBefore.length, sbCookiesBefore.map(c => c.name));
      await page.screenshot({ path: OUT_DIR + '/' + label + '-before-logout.png' });

      // Click Logout (desktop: visible in header; mobile: same header, should be visible)
      await page.click('button:has-text("Logout")', { timeout: 8000 });
      await page.waitForTimeout(2000);
      console.log(label, '- after logout click, url:', page.url());
      await page.screenshot({ path: OUT_DIR + '/' + label + '-after-logout.png' });

      const cookiesAfterLogout = await context.cookies();
      const sbCookiesAfter = cookiesAfterLogout.filter(c => c.name.startsWith('sb-') && c.value && c.value !== '');
      console.log(label, '- sb cookies with non-empty value after logout:', sbCookiesAfter.length, sbCookiesAfter.map(c => c.name));

      // Now try to revisit the protected dashboard directly
      await page.goto('https://hackathon.adz4needz.com/participant', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      console.log(label, '- after revisiting /participant directly, url:', page.url());
      await page.screenshot({ path: OUT_DIR + '/' + label + '-revisit-participant.png' });

      await context.close();
    }
  } finally {
    await browser.close();
    await rest(`/rest/v1/users?id=eq.${userId}`, 'DELETE').catch(() => {});
    await rest(`/auth/v1/admin/users/${userId}`, 'DELETE').catch(() => {});
    console.log('cleaned up test user');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
