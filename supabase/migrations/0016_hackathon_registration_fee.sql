-- Replaces the hosted Razorpay "Payment Button" model (one pre-made button
-- ID per hackathon, no order tracking, no verified amount) with a real
-- Razorpay Orders API + Checkout.js flow driven by a plain admin-set fee.

alter table public.hackathons add column if not exists registration_fee numeric;
alter table public.hackathons drop column if exists razorpay_button_id;
