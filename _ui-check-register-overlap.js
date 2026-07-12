const { chromium } = require('C:/Users/atchu asvin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

function overlaps(a, b) {
  if (!a || !b) return false;
  return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^Individual/ }).click();
  await page.waitForTimeout(500);

  // Scroll to the very bottom, where the submit button naturally lands
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);

  const whatsapp = await page.locator('a[aria-label="Chat with HackathonHub support on WhatsApp"]').boundingBox();
  const submitBtn = await page.locator('button:has-text("Register as Student")').boundingBox();
  console.log('WhatsApp box:', whatsapp);
  console.log('Register as Student button box:', submitBtn);
  console.log('Overlaps?', overlaps(whatsapp, submitBtn));

  await page.screenshot({ path: 'C:/Users/ATCHUA~1/AppData/Local/Temp/ui-sweep/register-overlap-check.png' });
  await browser.close();
}
main().catch((err) => { console.error(err); process.exit(1); });
