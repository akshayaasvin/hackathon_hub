const { chromium } = require('C:/Users/atchu asvin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs = require('fs');
const ctx = JSON.parse(fs.readFileSync('_ui-test-context.json', 'utf8'));
const OUT = 'C:/Users/ATCHUA~1/AppData/Local/Temp/ui-sweep';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', ctx.richParticipant.email);
  await page.fill('input[type="password"]', ctx.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  await page.goto(`http://localhost:3000/participant/${ctx.hackathonId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  // Scroll to the very bottom (viewport-only screenshot, not fullPage)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/hackathon-detail-scrolled-bottom-375.png` });

  // Check actual bounding boxes for overlap
  const whatsapp = await page.locator('a[aria-label="Chat with HackathonHub support on WhatsApp"]').boundingBox();
  const manageTeamBtn = await page.locator('button:has-text("Manage Team")').boundingBox().catch(() => null);
  const submitBtn = await page.locator('button:has-text("Submit Project")').boundingBox().catch(() => null);
  console.log('WhatsApp button box:', whatsapp);
  console.log('Manage Team button box:', manageTeamBtn);
  console.log('Submit Project button box:', submitBtn);

  function overlaps(a, b) {
    if (!a || !b) return false;
    return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
  }
  console.log('Overlaps Manage Team?', overlaps(whatsapp, manageTeamBtn));
  console.log('Overlaps Submit Project?', overlaps(whatsapp, submitBtn));

  await browser.close();
}
main().catch((err) => { console.error(err); process.exit(1); });
