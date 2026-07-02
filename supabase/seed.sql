-- Sample data so the app isn't empty on first run. No fake users/passwords —
-- real accounts are created through signup + the admin approval flow.

insert into public.hackathons (
  name, description, theme, rules, eligibility,
  registration_deadline, start_date, end_date,
  prize_details, max_team_size, status
) values (
  'AI Innovation Hackathon 2026',
  'Build an AI-powered product, agentic workflow, or applied ML solution that solves a real problem in under 48 hours.',
  'Artificial Intelligence',
  'Teams of up to 4. All code must be written during the hackathon window. Use of open-source libraries and public APIs is allowed.',
  'Open to all currently enrolled students and recent graduates (within 2 years of passing out).',
  now() + interval '14 days',
  now() + interval '21 days',
  now() + interval '23 days',
  '1st place: ₹50,000 + incubation fast-track. 2nd place: ₹30,000. 3rd place: ₹15,000. All finalists receive mentorship credits.',
  4,
  'published'
);
