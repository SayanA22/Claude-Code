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
  { name: "Delivery fee with short link",     input: "Your package is on hold. Pay a $1.99 fee at tinyurl.com/abc", expect: "scam", flags: ["delivery", "shortener"] },   // a pushy message plus a hidden link

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

  // ---------- More scams that target older adults ----------
  { name: "Grandchild emergency (bail)",       input: "Grandpa, it's me. I was arrested and I need bail money right now.", expect: "scam", flags: ["familyemergency"] },
  { name: "Hospital + wire money",             input: "Grandma it's me, I'm in the hospital after a car accident. Please wire money, don't tell mom.", expect: "scam", flags: ["familyemergency", "secrecy"] },
  { name: "Online romance asks for money",     input: "My love, I am deployed overseas and need money for a plane ticket to come see you.", expect: "scam", flags: ["romance"] },
  { name: "Check scam (mystery shopper)",      input: "Mystery shopper job! Deposit this check and send back the difference with gift cards.", expect: "scam", flags: ["checkscam", "payment"] },
  { name: "Move money to a safe account",      input: "This is your bank's fraud department. Move your money to a safe account right now.", expect: "scam", flags: ["safeacct"] },
  { name: "Courier picks up cash",             input: "A courier will come to your home to pick up the cash for bail.", expect: "scam", flags: ["courier"] },
  { name: "Do not hang up (fake officer)",     input: "Do not hang up the phone. The officer needs to verify your account.", expect: "scam", flags: ["stayline"] },
  { name: "Unpaid toll text with link",        input: "FastTrak: You have an unpaid toll balance. Pay now at fastrak-pay.com/ticket", expect: "scam", flags: ["toll"] },
  { name: "Fortune from a stranger",           input: "I am a barrister handling an inheritance of $12,500,000. Reply with your bank details and a small processing fee.", expect: "scam", flags: ["advance"] },
  { name: "Fake Geek Squad invoice",           input: "Geek Squad: Your invoice for $399.99 was processed. To dispute call 1-888-555-0123.", expect: "scam", flags: ["fakeinvoice", "surprisecharge"] },
  { name: "Prepaid cards for a fine",          input: "Pay the fine with prepaid cards or you will be arrested.", expect: "scam", flags: ["payment", "urgency"] },
  { name: "Pushy message + short link",        input: "Act now or your account will be closed: bit.ly/3xYz", expect: "scam", flags: ["urgency", "shortener"] },
  { name: "Brand in the path of a login page", input: "https://sites.example.com/paypal/login", expect: "scam", flags: ["fakebrand"] },
  { name: "Look-alike hidden in a redirect",   input: "https://www.google.com/url?q=https://paypa1.com/login&sa=D", expect: "scam", flags: ["lookalike"] },
  { name: "New brand: Geico imposter",         input: "https://www.geico-claims-update.com", expect: "scam", flags: ["fakebrand"] },
  { name: "Link says one site, goes to another", input: "paypal.com\nhttps://evil-login.example.net/x", opts: { realLink: "https://evil-login.example.net/x" }, expect: "scam", flags: ["linkmismatch"] },
  { name: "Link text matches the real site",   input: "amazon.com\nhttps://www.amazon.com/orders", opts: { realLink: "https://www.amazon.com/orders" }, expect: "okay" },
  // medium-level warnings alone -> be careful
  { name: "Get-rich promise",                  input: "Guaranteed 20% weekly returns with our crypto trading platform", expect: "careful", flags: ["invest"] },
  { name: "Utility shut-off threat",           input: "Your electric service will be shut off today unless you pay your past due bill.", expect: "careful", flags: ["utility"] },
  { name: "Verify your account (click)",       input: "Please verify your account by clicking the link below.", expect: "careful", flags: ["verifyacct"] },
  { name: "QR code to claim a refund",         input: "Scan this QR code to claim your refund", expect: "careful", flags: ["qr"] },
  { name: "Friendly wrong number",             input: "Sorry, wrong number! But you seem nice, nice to meet you. Want to chat on WhatsApp?", expect: "careful", flags: ["wrongnum"] },
  { name: "Surprise charge, call to cancel",   input: "Your subscription renewed for $9.99. To cancel call 1-800-555-0123", expect: "careful", flags: ["surprisecharge"] },
  { name: "Suspended account, call us",        input: "Your account has been suspended. Call us at 1-800-555-0199.", expect: "careful", flags: ["callnumber", "urgency"] },
  { name: "Address stuffed with login words",  input: "https://secure-login-verify-account.xyz/", expect: "careful", flags: ["wordy", "oddaddress"] },

  { name: "New number, send money (Hi Mom)",   input: "Hi Mom, this is my new number. I dropped my phone in the lake. Can you send $500 to my friend's account?", expect: "scam", flags: ["newnumber"] },
  { name: "Fake PayPal charge alert",           input: "Your PayPal account was charged $499.99 for Bitcoin. If this wasn't you, call 1-888-555-0145 to cancel.", expect: "scam", flags: ["fakeinvoice"] },
  { name: "Easy-money job offer",               input: "Work from home and earn $500 a day! No experience needed. Reply YES to start.", expect: "careful", flags: ["jobscam"] },

  { name: "Unclaimed package + fee + odd link", input: "You have 1 unclaimed package. Pay the $1.50 shipping fee here: post-office-track.top/pay", expect: "scam", flags: ["delivery", "oddaddress"] },

  { name: "Sent you money by mistake (Cash App)", input: "I accidentally sent you $300 on Cash App. Please send it back to me.", expect: "scam", flags: ["overpay"] },
  { name: "Pre-approved loan needs a fee",       input: "Congrats! You're pre-approved for a $50,000 loan. Pay a $500 processing fee to release it.", expect: "scam", flags: ["loanfee"] },
  { name: "Fake computer-error alert",           input: "Your computer is sending errors to Microsoft. Call 1-800-555-0100 now.", expect: "scam", flags: ["techsupport"] },
  { name: "Millions to transfer",                input: "Dear friend, I am Dr. Williams from Nigeria. I have $10.5 million to transfer. Reply for details.", expect: "scam", flags: ["advance"] },
  { name: "Grandson in an accident (3rd person)", input: "Your grandson was in an accident. Call this attorney now at 555-0100, he needs $9,000.", expect: "scam", flags: ["familyemergency"] },
  { name: "Medicare number verify call",         input: "Hello, I'm calling from Medicare. We need to verify your Medicare number for your new card.", expect: "scam", flags: ["government"] },
  { name: "Venmo imposter site",                 input: "Venmo: You received $500 by mistake. Send it back to avoid account suspension: venmo-refund-help.com", expect: "scam", flags: ["fakebrand"] },

  // ---------- Normal messages that must NOT be flagged (no crying wolf) ----------
  { name: "Normal: airport pickup",            input: "Grandma, I'm at the airport, can you pick me up at 5?", expect: "okay" },
  { name: "Normal: hospital waiting room",     input: "I'm in the hospital waiting room with Dad. Call me when you can.", expect: "okay" },
  { name: "Normal: love + flight",             input: "I love you! My flight from overseas lands at 6.", expect: "okay" },
  { name: "Normal: 401k news",                 input: "My 401k returned 7% this year.", expect: "okay" },
  { name: "Normal: pay you back for dinner",   input: "I'll deposit the check tomorrow and pay you back for dinner.", expect: "okay" },
  { name: "Normal: QR code at the table",      input: "Scan the QR code at the table to see the menu.", expect: "okay" },
  { name: "Normal: electric bill reminder",    input: "Your electric bill is due on the 15th. Autopay is on.", expect: "okay" },
  { name: "Normal: Verizon bill ready",        input: "Verizon: your bill is ready. Log in at verizon.com to view it.", expect: "okay" },
  { name: "Normal: bank link (real domain)",   input: "Please review your account statement at https://www.chase.com/statements", expect: "okay" },
  { name: "Normal: delivered",                 input: "Your package from Amazon was delivered to the front door.", expect: "okay" },
  { name: "Normal: birthday",                  input: "Happy birthday grandma! We love you so much, see you Sunday.", expect: "okay" },
  { name: "Normal: toll already paid",         input: "The toll on the bridge was $6, I paid already.", expect: "okay" },
  { name: "Normal: doctor reminder",           input: "Doctor's office: your appointment is confirmed for Tuesday at 10.", expect: "okay" },
  { name: "Normal: wrong number, no pitch",    input: "Wrong number? I'm texting Dave about the game.", expect: "okay" },
  { name: "Normal: Netflix renewed (no phone)", input: "Your Netflix subscription renewed for $15.49 today.", expect: "okay" },
  { name: "Normal: call me when you land",     input: "Call me at 555-123-4567 when you land, your flight arrives at 6.", expect: "okay" },
  { name: "Normal: conference call",           input: "Reminder: dial 555-123-4567 for the conference call at 3pm. Do not hang up before the host joins.", expect: "okay" },
  { name: "Normal: need money for lunch",      input: "Can you send me $20 for pizza?", expect: "okay" },
  { name: "Normal: stuck in traffic",          input: "Honey, I'm stuck in traffic, can you send the address again?", expect: "okay" },
  { name: "Normal: legal help",                input: "We inherited a house overseas from my uncle, I need a lawyer to help.", expect: "okay" },
  { name: "Normal: Apple account page",        input: "https://account.apple.com/sign-in", expect: "okay" },
  { name: "Normal: Google redirect to news",   input: "https://www.google.com/url?q=https://www.nytimes.com/article&sa=D", expect: "okay" },
  { name: "Normal: new number, no money",      input: "Hey it's Mike. New number, my old phone broke. Save this one!", expect: "okay" },
  { name: "Normal: wire transfer received",     input: "Wire transfer received: $200 from your daughter. Thanks for your help!", expect: "okay" },
  { name: "Normal: last chance (club trip)",    input: "Last chance to sign up for the senior center trip to the botanical gardens!", expect: "okay" },
  { name: "Normal: Chase purchase alert",       input: "Chase: A $45.20 purchase was made at TARGET with your card ending 4821. Reply STOP to opt out.", expect: "okay" },
  { name: "Normal: I work from home",           input: "I work from home on Fridays, so come by for lunch.", expect: "okay" },
  { name: "Normal: Social Security deposit",   input: "Your Social Security payment of $1,812 will be deposited on the 3rd.", expect: "okay" },
  { name: "Normal: IRS refund timing",          input: "The IRS website says refunds take up to 21 days. Did yours arrive?", expect: "okay" },
  { name: "Normal: bring your SSN to the DMV",  input: "Please bring your Social Security number and photo ID to the DMV appointment.", expect: "okay" },
  { name: "Normal: bank PIN warning",            input: "Your bank will never ask for your PIN by phone or text. Stay safe.", expect: "okay" },
  { name: "Normal: one-time code",               input: "Wells Fargo: Your one-time code is 482931. Never share this code with anyone.", expect: "okay" },
  { name: "Normal: Venmo payment done",          input: "Your Venmo payment of $15 to Jim was completed.", expect: "okay" },
  { name: "Normal: account used at gas station", input: "I got an alert that my account was used at the gas station. It was me, no worries.", expect: "okay" },
  { name: "Normal: news with a brand word",    input: "https://www.bbc.com/news/amazon-layoffs", expect: "okay" },
  { name: "3 medium flags add up",            input: "Act now! Your package is on hold, click bit.ly/abc or visit http://example.top", expect: "scam" }
];

// ---------- The test runner (no need to change anything below) ----------

let failed = 0;

TESTS.forEach((test, number) => {
  const result = checkText(test.input, test.opts);
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

// The highlights: every span must sit inside the message and point at real words
TESTS.forEach((test) => {
  const r = checkText(test.input, test.opts);
  r.evidence.forEach((e) => e.spans.forEach((s) => {
    const piece = r.text.slice(s.start, s.end);
    if (!(s.start >= 0 && s.end <= r.text.length && s.end > s.start && piece.trim())) {
      failed++;
      console.log(`FAIL  bad highlight in "${test.name}": ${JSON.stringify(s)}`);
    }
  }));
});
const msg = "Don\u2019t TELL   anyone,\n pay with gift cards";
const hit = checkText(msg).evidence.map((e) => ({ id: e.id, words: e.spans.map((s) => msg.slice(s.start, s.end)) }));
const want = { secrecy: "Don\u2019t TELL   anyone", payment: "gift cards" };
hit.forEach((h) => {
  if (want[h.id] && h.words[0] !== want[h.id]) { failed++; console.log(`FAIL  highlight for ${h.id}: got ${JSON.stringify(h.words)}`); }
});
console.log(hit.length >= 2 ? "PASS  highlights point at the right words (odd spacing and curly quotes too)" : "FAIL  highlights missing");
if (hit.length < 2) failed++;

// Design rule: nothing in the stylesheet may set text smaller than 20px (1rem).
// (This is checked here so a too-small size can never be committed by accident.)
{
  const css = require("fs").readFileSync(__dirname + "/../styles.css", "utf8");
  const small = [];
  (css.match(/font(?:-size)?\s*:\s*[^;}]+/g) || []).forEach((decl) => {
    const size = decl.match(/(?:^|[\s:])(\d*\.?\d+)(px|rem|em)\b/);
    if (!size) return;
    const n = parseFloat(size[1]);
    const px = size[2] === "px" ? n : n * 20;       // 1rem and 1em both mean 20px here
    if (px < 20) small.push(decl.trim());
  });
  if (small.length) { failed++; console.log("FAIL  text smaller than 20px in styles.css: " + small.join(" | ")); }
  else console.log("PASS  no text in styles.css is smaller than 20px");
}

// Rules that must hold for EVERY result
const sample = checkText("Hey, dinner at 6?");
if (!sample.footer.endsWith("ask a family member before clicking or paying.")) {
  failed++;
  console.log("FAIL  footer text is missing");
}
// Only OUR wording is checked (a scam message may itself say "safe account")
const allText = TESTS.map((t) => { const r = checkText(t.input, t.opts); return [r.title, r.footer].concat(r.reasons).join(" "); }).join(" ").toLowerCase();
if (/\bsafe\b/.test(allText)) {
  failed++;
  console.log('FAIL  a result contains the word "safe" (we say "Looks okay")');
}

console.log(`\n${TESTS.length} tests, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
