/*
 * tests/run-tests.js — checks rules.js against example messages and links.
 *
 * Run it with:   node tests/run-tests.js
 *
 * Each test has:
 *   name    – what it is (for humans)
 *   input   – the text or link we hand to the checker
 *   expect  – "scam" (🔴), "careful" (🟡) or "okay" (🟢)
 *   flags   – (optional) flag ids that MUST show up, e.g. ["lookalike"]
 *
 * To add a test, just add a line to the TESTS list below.
 */

const { checkText } = require("../rules.js");

const TESTS = [
  // ---------- Normal things that should look okay ----------
  { name: "Normal text from a friend",        input: "Hey, dinner at 6?", expect: "okay" },
  { name: "Normal text from family",          input: "Mom, I'll pick you up at 3. Love you!", expect: "okay" },
  { name: "Real 2-factor code (with warning)",input: "Your verification code is 482910. Do not share it with anyone.", expect: "okay" },
  { name: "Real Amazon link",                 input: "https://www.amazon.com/gp/your-account/order-history", expect: "okay" },
  { name: "News article link",                input: "https://www.nytimes.com/2024/05/01/world/news.html", expect: "okay" },
  { name: "Appointment reminder",             input: "Reminder: your dentist appointment is tomorrow at 2pm. Reply C to confirm.", expect: "okay" },
  { name: "Party invite",                     input: "Grandma's birthday party is Saturday. Bring a dish to share!", expect: "okay" },
  { name: "Real Social Security news",        input: "Your Social Security benefits will increase by 2.5% next year.", expect: "okay" },
  { name: "Grandma gift card (no request)",   input: "I bought Grandma a gift card for her birthday", expect: "okay" },
  { name: "Bitcoin in the news",              input: "Bitcoin hit a new high today according to the news.", expect: "okay" },
  { name: "Real Microsoft support link",      input: "Check https://support.microsoft.com/help", expect: "okay" },
  { name: "Real Chase link",                  input: "https://www.chase.com", expect: "okay" },
  { name: "Real shipping notice",             input: "Your order of batteries has shipped and will arrive Friday.", expect: "okay" },
  { name: "Plain google.com mention",         input: "just search on google.com", expect: "okay" },
  { name: "File name is not a website",       input: "I sent you my_photos.zip yesterday", expect: "okay" },

  // ---------- Borderline: 1-2 medium flags -> be careful ----------
  { name: "Real Amazon but http://",          input: "http://www.amazon.com", expect: "careful", flags: ["nothttps"] },
  { name: "Shortened link",                   input: "bit.ly/3xYz", expect: "careful", flags: ["shortener"] },
  { name: "Unusual ending (.xyz)",            input: "https://example.xyz/hello", expect: "careful", flags: ["oddaddress"] },
  { name: "Raw IP address over http",         input: "http://192.168.1.1/login", expect: "careful", flags: ["oddaddress", "nothttps"] },
  { name: "Just a deadline",                  input: "Please respond within 24 hours", expect: "careful", flags: ["urgency"] },
  { name: "Account suspended threat",         input: "Your account has been suspended. Act now.", expect: "careful", flags: ["urgency"] },
  { name: "Delivery fee with short link",     input: "Your package is on hold. Pay a $1.99 fee at tinyurl.com/abc", expect: "careful", flags: ["delivery", "shortener"] },

  // ---------- Look-alike and fake-brand links -> scam ----------
  { name: "amaz0n (zero for o)",              input: "amaz0n.com", expect: "scam", flags: ["lookalike"] },
  { name: "paypa1 (one for l)",               input: "https://paypa1.com/login", expect: "scam", flags: ["lookalike"] },
  { name: "rnicrosoft (rn for m)",            input: "http://rnicrosoft.com", expect: "scam", flags: ["lookalike"] },
  { name: "One-letter typo (paypl)",          input: "https://www.paypl.com", expect: "scam", flags: ["lookalike"] },
  { name: "Brand inside another domain",      input: "https://paypal.secure-help-login.com/verify", expect: "scam", flags: ["fakebrand"] },
  { name: "Brand + hyphen + .net",            input: "https://www.faceb00k-security.net", expect: "scam", flags: ["lookalike"] },
  { name: "Wells Fargo imposter",             input: "wellsfargo-online.com", expect: "scam", flags: ["fakebrand"] },
  { name: "Netflix billing imposter",         input: "Your Netflix account is on hold. Update your payment at netflix-billing.com", expect: "scam", flags: ["fakebrand"] },
  { name: "Fake IRS site",                    input: "irs-refund.com", expect: "scam", flags: ["fakebrand"] },
  { name: "Username trick",                   input: "https://paypal.com@evil.com/login", expect: "scam", flags: ["fakebrand"] },

  // ---------- Message scams -> scam ----------
  { name: "IRS + gift cards",                 input: "Pay the IRS with gift cards or you will be arrested.", expect: "scam", flags: ["payment", "government"] },
  { name: "Fake virus + phone number",        input: "WARNING: Your computer is infected with a virus! Call Microsoft Support now at 1-800-555-0199", expect: "scam", flags: ["techsupport"] },
  { name: "Phone number + virus (short)",     input: "Call 1-888-555-0123 now, your PC has a virus", expect: "scam", flags: ["techsupport"] },
  { name: "Prize scam",                       input: "Congratulations! You've won a $1000 Walmart gift card. Click to claim your prize.", expect: "scam", flags: ["prize"] },
  { name: "Social Security impersonation",    input: "This is the Social Security Administration. Your number has been suspended. Call immediately to verify your SSN.", expect: "scam", flags: ["government"] },
  { name: "Asks for verification code",       input: "Please read me the verification code we just texted you.", expect: "scam", flags: ["sensitive"] },
  { name: "Secrecy",                          input: "Don't tell anyone about this. Keep it between us.", expect: "scam", flags: ["secrecy"] },
  { name: "Remote access request",            input: "Please install AnyDesk so I can fix your computer.", expect: "scam", flags: ["remote"] },
  { name: "Refund scam",                      input: "We refunded you too much by mistake. Please send back the difference.", expect: "scam", flags: ["refund"] },
  { name: "Grandchild-in-jail scam",          input: "Grandma it's me, I'm in jail and need bail money. Send a wire transfer and don't tell mom.", expect: "scam", flags: ["payment", "secrecy"] },
  { name: "Delivery scam with fake USPS link",input: "USPS: Your package could not be delivered. Update your address and pay a $2 fee: http://usps-redelivery.top/x", expect: "scam", flags: ["fakebrand", "delivery"] },
  { name: "Surprise party secret is fine",    input: "Don't tell grandma, we're planning her surprise birthday party on Saturday!", expect: "okay" },
  { name: "Secret plus money is still a scam", input: "Don't tell anyone, just send the money today", expect: "scam", flags: ["secrecy"] },
  { name: "Russian 'a' in apple.com",         input: "https://\u0430pple.com/id/verify", expect: "scam", flags: ["lookalike"] },
  { name: "Russian 'a' in paypal, bare",      input: "Log in at p\u0430ypal.com now", expect: "scam", flags: ["lookalike"] },
  { name: "Real accented address is only odd", input: "m\u00fcnchen.de", expect: "careful", flags: ["oddaddress"] },
  { name: "3 medium flags add up",            input: "Act now! Your package is on hold, click bit.ly/abc or visit http://example.top", expect: "scam" }
];

// ---------- The test runner (no need to change anything below) ----------

let failed = 0;

TESTS.forEach((test, number) => {
  const result = checkText(test.input);
  const ids = result.flags.map((f) => f.id);
  const missing = (test.flags || []).filter((id) => ids.indexOf(id) === -1);

  const levelOk = result.level === test.expect;
  const flagsOk = missing.length === 0;

  if (levelOk && flagsOk) {
    console.log(`PASS  ${String(number + 1).padStart(2)}. ${test.name}`);
  } else {
    failed++;
    console.log(`FAIL  ${String(number + 1).padStart(2)}. ${test.name}`);
    console.log(`      input:    ${test.input}`);
    console.log(`      expected: ${test.expect}   got: ${result.level}`);
    if (missing.length) console.log(`      missing flags: ${missing.join(", ")}`);
    console.log(`      flags found: ${ids.join(", ") || "(none)"}`);
  }
});

// Rules that must hold for EVERY result
const sample = checkText("Hey, dinner at 6?");
if (!sample.footer.endsWith("ask a family member before clicking or paying.")) {
  failed++;
  console.log("FAIL  footer text is missing");
}
const allText = TESTS.map((t) => JSON.stringify(checkText(t.input))).join(" ").toLowerCase();
if (/\bsafe\b/.test(allText)) {
  failed++;
  console.log('FAIL  a result contains the word "safe" (we say "Looks okay")');
}

console.log(`\n${TESTS.length} tests, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
