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

async function rest(path, method, body, extraHeaders) {
  const res = await fetch(SUPABASE_URL + path, { method, headers: { ...headers, ...extraHeaders }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const HACKATHON_ID = 'c3c67f8e-c67f-45c1-be5b-426b3081cab9';
const PASS = 'TestPassword123!';

async function makeUser(label, role) {
  const email = `ui-${label}-${Date.now()}@example.com`;
  const u = await rest('/auth/v1/admin/users', 'POST', { email, password: PASS, email_confirm: true });
  await rest('/rest/v1/users', 'POST', { id: u.id, email, full_name: `UI ${label}`, role, status: 'active' });
  return { email, userId: u.id };
}

async function main() {
  const ctx = {};

  // Multi-purpose account: switch role for admin/jury/college dashboards
  ctx.multiRole = await makeUser('multirole', 'participant');

  // Rich participant: approved + team created, so we can see team/submit UI states
  ctx.richParticipant = await makeUser('richparticipant', 'participant');
  await rest('/rest/v1/participant_profiles', 'POST', {
    user_id: ctx.richParticipant.userId, college_name: 'Test College', passout_year: 2026, degree: 'B.Tech',
    domain: 'CS', experience_level: 'fresher', contact_number: '9999999999', address: 'Test',
  });
  const reg = await rest('/rest/v1/registrations', 'POST', {
    user_id: ctx.richParticipant.userId, hackathon_id: HACKATHON_ID, status: 'approved',
    payment_method: 'razorpay', payment_amount: 455, payment_reference: 'pay_ui_test_demo',
  }, { Prefer: 'return=representation' });
  ctx.richParticipant.regId = reg[0].id;

  const team = await rest('/rest/v1/teams', 'POST', {
    team_name: 'UI Test Squad', hackathon_id: HACKATHON_ID, team_lead_id: ctx.richParticipant.userId,
  }, { Prefer: 'return=representation' });
  ctx.richParticipant.teamId = team[0].id;
  await rest('/rest/v1/team_members', 'POST', { team_id: team[0].id, user_id: ctx.richParticipant.userId });
  await rest(`/rest/v1/registrations?id=eq.${ctx.richParticipant.regId}`, 'PATCH', { status: 'team_created', team_id: team[0].id });

  ctx.hackathonId = HACKATHON_ID;
  ctx.password = PASS;
  fs.writeFileSync('_ui-test-context.json', JSON.stringify(ctx, null, 2));
  console.log(JSON.stringify(ctx, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
