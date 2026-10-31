/*
 * rules.js — ALL of the scam-detection logic lives in this one file.
 *
 * It has NO links to the browser, the page, or the network. You give it a
 * string of text, it gives you back a result object. That makes it easy to
 * test with Node (see tests/run-tests.js) and easy to update.
 *
 *   const result = ScamRules.checkText("Pay with gift cards or be arrested!");
 *   result.level   -> "scam" | "careful" | "okay"
 *   result.title   -> "Likely scam" | "Be careful" | "Looks okay"
 *   result.emoji   -> "🔴" | "🟡" | "🟢"
 *   result.reasons -> ["Real companies never ask...", ...]  (plain English)
 *   result.footer  -> "When in doubt, ask a family member..."
 *
 * HOW TO ADD A NEW RED FLAG: see the README, or search this file for
 * "MESSAGE_FLAGS" (text rules) and "checkLink" (web address rules).
 */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------------
  // 1. Words shown to the user
  // ---------------------------------------------------------------------

  var FOOTER = "When in doubt, ask a family member before clicking or paying.";

  // We never say "safe". The best answer is "Looks okay".
  var LEVELS = {
    scam:    { emoji: "🔴", title: "Likely scam" },
    careful: { emoji: "🟡", title: "Be careful" },
    okay:    { emoji: "🟢", title: "Looks okay" }
  };

  var MAX_LENGTH = 5000; // ignore anything after this many characters

  // ---------------------------------------------------------------------
  // 2. Brands that scammers like to pretend to be
  //
  //   name    – how we show it to the user
  //   words   – the lowercase word(s) that appear in the real web address
  //   domains – the REAL web addresses (subdomains like "smile.amazon.com"
  //             are accepted automatically)
  // ---------------------------------------------------------------------

  var BRANDS = [
    { name: "Amazon",          words: ["amazon"],         domains: ["amazon.com", "amazon.co.uk", "amazon.ca", "amazon.de", "amazonaws.com", "amzn.to", "a.co"] },
    { name: "PayPal",          words: ["paypal"],         domains: ["paypal.com", "paypal.me"] },
    { name: "Apple",           words: ["apple", "icloud"],domains: ["apple.com", "icloud.com"] },
    { name: "Microsoft",       words: ["microsoft"],      domains: ["microsoft.com", "microsoftonline.com", "live.com", "office.com", "outlook.com", "windows.com", "xbox.com"] },
    { name: "Google",          words: ["google", "gmail"],domains: ["google.com", "google.co.uk", "google.ca", "gmail.com", "googleapis.com", "googleusercontent.com", "goo.gl"] },
    { name: "Netflix",         words: ["netflix"],        domains: ["netflix.com"] },
    { name: "Chase",           words: ["chase"],          domains: ["chase.com"] },
    { name: "Bank of America", words: ["bankofamerica"],  domains: ["bankofamerica.com"] },
    { name: "Wells Fargo",     words: ["wellsfargo"],     domains: ["wellsfargo.com"] },
    { name: "Citibank",        words: ["citibank"],       domains: ["citi.com", "citibank.com"] },
    { name: "Capital One",     words: ["capitalone"],     domains: ["capitalone.com"] },
    { name: "American Express",words: ["americanexpress", "amex"], domains: ["americanexpress.com"] },
    { name: "USPS",            words: ["usps"],           domains: ["usps.com"] },
    { name: "UPS",             words: ["ups"],            domains: ["ups.com"] },
    { name: "FedEx",           words: ["fedex"],          domains: ["fedex.com"] },
    { name: "DHL",             words: ["dhl"],            domains: ["dhl.com"] },
    { name: "the IRS",         words: ["irs"],            domains: ["irs.gov"] },
    { name: "Social Security", words: ["socialsecurity", "ssa"], domains: ["ssa.gov", "socialsecurity.gov"] },
    { name: "Medicare",        words: ["medicare"],       domains: ["medicare.gov", "cms.gov"] },
    { name: "Walmart",         words: ["walmart"],        domains: ["walmart.com"] },
    { name: "Costco",          words: ["costco"],         domains: ["costco.com"] },
    { name: "Target",          words: ["target"],         domains: ["target.com"] },
    { name: "Best Buy",        words: ["bestbuy"],        domains: ["bestbuy.com"] },
    { name: "Home Depot",      words: ["homedepot"],      domains: ["homedepot.com"] },
    { name: "eBay",            words: ["ebay"],           domains: ["ebay.com"] },
    { name: "Facebook",        words: ["facebook"],       domains: ["facebook.com", "fb.com", "fb.me"] },
    { name: "Instagram",       words: ["instagram"],      domains: ["instagram.com"] },
    { name: "WhatsApp",        words: ["whatsapp"],       domains: ["whatsapp.com"] },
    { name: "Venmo",           words: ["venmo"],          domains: ["venmo.com"] },
    { name: "Zelle",           words: ["zelle"],          domains: ["zellepay.com"] },
    { name: "Cash App",        words: ["cashapp"],        domains: ["cash.app", "cashapp.com"] },
    { name: "Coinbase",        words: ["coinbase"],       domains: ["coinbase.com"] },
    { name: "Walgreens",       words: ["walgreens"],      domains: ["walgreens.com"] },
    { name: "CVS",             words: ["cvs"],            domains: ["cvs.com"] },
    { name: "Verizon",         words: ["verizon"],        domains: ["verizon.com"] },
    { name: "AT&T",            words: ["att"],            domains: ["att.com"] },
    { name: "Comcast Xfinity", words: ["comcast", "xfinity"], domains: ["comcast.com", "xfinity.com"] },
    { name: "Norton",          words: ["norton"],         domains: ["norton.com"] },
    { name: "McAfee",          words: ["mcafee"],         domains: ["mcafee.com"] },
    { name: "AARP",            words: ["aarp"],           domains: ["aarp.org"] }
  ];

  // Scammers often glue these onto a short brand name: "apple-support.com"
  var SCAM_WORDS = ["support", "secure", "security", "login", "signin", "verify",
    "verification", "help", "billing", "service", "services", "account", "id",
    "alert", "update", "care", "online", "bank", "pay", "wallet", "refund",
    "tracking", "delivery", "claim"];

  // Link shorteners (the real destination is hidden)
  var SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd",
    "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "tiny.cc", "t.ly",
    "rb.gy", "bl.ink", "lnkd.in", "s.id", "v.gd"];

  // Endings (".xyz") that are cheap and popular with scammers
  var UNUSUAL_TLDS = ["xyz", "top", "click", "zip", "mov", "work", "loan", "icu",
    "buzz", "gq", "cf", "tk", "ml", "ga", "monster", "rest", "country", "kim",
    "cyou", "sbs", "vip", "cam", "men", "date", "review", "download", "racing",
    "stream", "bid", "win", "party", "support", "link"];

  // ---------------------------------------------------------------------
  // 3. Small helper functions
  // ---------------------------------------------------------------------

  // True if one word can become the other with exactly ONE typo
  // (a swapped, missing, extra, or changed letter).
  function oneEditAway(a, b) {
    if (a === b) return false;
    if (Math.abs(a.length - b.length) > 1) return false;

    if (a.length === b.length) {
      var diffs = [];
      for (var i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) diffs.push(i);
      }
      if (diffs.length === 1) return true; // one letter changed
      // two neighbouring letters swapped, e.g. "paypla" vs "paypal"
      return diffs.length === 2 &&
        diffs[1] === diffs[0] + 1 &&
        a[diffs[0]] === b[diffs[1]] &&
        a[diffs[1]] === b[diffs[0]];
    }

    // lengths differ by one: one letter missing or extra
    var shorter = a.length < b.length ? a : b;
    var longer  = a.length < b.length ? b : a;
    var j = 0;
    while (j < shorter.length && shorter[j] === longer[j]) j++;
    return shorter.slice(j) === longer.slice(j + 1);
  }

  // Undo common letter tricks: 0→o, 1→l (or i), 3→e, 5→s, rn→m, vv→w ...
  // Returns a list of possible "real" spellings.
  function undoTricks(word) {
    var base = word
      .replace(/0/g, "o")
      .replace(/3/g, "e")
      .replace(/5/g, "s")
      .replace(/@/g, "a")
      .replace(/\$/g, "s")
      .replace(/vv/g, "w")
      .replace(/rn/g, "m");
    return [base.replace(/1/g, "l"), base.replace(/1/g, "i")];
  }

  // Does this address belong to the real brand?  ("smile.amazon.com" does)
  function isOfficial(host, brand) {
    return brand.domains.some(function (d) {
      return host === d || host.endsWith("." + d);
    });
  }

  // Break a web address into the little words we should examine.
  // "paypal.secure-help-login.com" -> paypal, secure-help-login, secure, help, login, ...
  // We drop the last piece (".com") because it is the ending, not a name.
  function wordsInHost(host) {
    var labels = host.split(".");
    labels.pop();
    var out = [];
    labels.forEach(function (label) {
      out.push(label);
      out.push(label.replace(/-/g, "")); // "bank-of-america" -> "bankofamerica"
      label.split("-").forEach(function (piece) { out.push(piece); });
    });
    return out.filter(function (w, i) { return w && out.indexOf(w) === i; });
  }

  // Does a word from the address contain the brand name?
  // Long names (6+ letters) can appear anywhere ("securepaypal").
  // Short names (apple, irs, ups) must stand alone or sit next to a
  // scam-word ("apple-support"), otherwise "pineapple.com" would match.
  function containsBrandWord(word, brandWord) {
    if (brandWord.length >= 6) return word.indexOf(brandWord) !== -1;
    if (word === brandWord) return true;
    return SCAM_WORDS.some(function (extra) {
      return word === brandWord + extra || word === extra + brandWord;
    });
  }

  // Is this word a sneaky copy of the brand word? (amaz0n, paypa1, rnicrosoft)
  function isLookalike(word, brandWord) {
    if (word === brandWord) return false;
    if (undoTricks(word).indexOf(brandWord) !== -1) return true;
    // One-letter typos, only for longer names so we don't flag real words.
    return brandWord.length >= 6 && word.length >= 5 && oneEditAway(word, brandWord);
  }

  // ---------------------------------------------------------------------
  // 4. Finding links inside text
  // ---------------------------------------------------------------------

  function escapeForRegex(s) { return s.replace(/\./g, "\\."); }

  // Endings we recognise for addresses typed WITHOUT "http://" or "www."
  // (zip and mov are left out here because "photos.zip" is just a file name)
  var BARE_TLDS = ["com", "net", "org", "edu", "gov", "info", "biz", "us", "co",
    "uk", "io", "me", "app", "online", "site", "shop", "store", "live", "help",
    "ca", "de"]
    .concat(UNUSUAL_TLDS.filter(function (t) { return t !== "zip" && t !== "mov"; }));

  // One big pattern, tried in this order at each spot in the text:
  //   1) http:// or https:// addresses
  //   2) www. addresses
  //   3) known link shorteners  (bit.ly/abc)
  //   4) plain addresses        (paypa1.com/login)
  var LINK_PATTERN = new RegExp(
    "https?:\\/\\/[^\\s<>\"']+" +
    "|www\\.[^\\s<>\"']+" +
    "|\\b(?:" + SHORTENERS.map(escapeForRegex).join("|") + ")(?:\\/[^\\s<>\"']*)?" +
    "|\\b(?:[a-z0-9-]+\\.)+(?:" + BARE_TLDS.join("|") + ")\\b(?:[\\/?#][^\\s<>\"']*)?",
    "gi"
  );

  function trimPunctuation(s) {
    return s.replace(/[.,;:!?)\]}'"]+$/, "");
  }

  function findLinks(text) {
    var found = (text.match(LINK_PATTERN) || []).map(trimPunctuation);
    // If the whole input is one word with a dot, treat it as a link
    // (so "paypa1.org" or "evil.example" still gets checked).
    var whole = text.trim();
    if (whole && !/\s/.test(whole) && whole.indexOf(".") !== -1) {
      found.push(trimPunctuation(whole));
    }
    return found.filter(function (l, i) { return l && found.indexOf(l) === i; });
  }

  // Turn "https://Www.Example.com/x" into pieces we can examine.
  // Returns null if it isn't a normal web address.
  function parseLink(raw) {
    var hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    var url;
    try {
      url = new URL(hasScheme ? raw : "http://" + raw);
    } catch (e) {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return {
      host: url.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, ""),
      // Only call it "http" if the person actually typed http://
      isHttp: hasScheme && url.protocol === "http:",
      // Trick: https://paypal.com@evil.com  (the real site is evil.com)
      userInfo: decodeURIComponent(url.username || "").toLowerCase()
    };
  }

  // ---------------------------------------------------------------------
  // 5. LINK flags (rules 1-5). Returns a list of {id, level, text}.
  // ---------------------------------------------------------------------

  function checkLink(raw) {
    var flags = [];
    var link = parseLink(raw);
    if (!link) return flags;
    var host = link.host;

    // Everything we should examine: the address itself, plus the fake
    // "username" part if there is one.
    var words = wordsInHost(host);
    if (link.userInfo) words = words.concat(wordsInHost(link.userInfo + ".x"));

    BRANDS.forEach(function (brand) {
      if (isOfficial(host, brand)) return; // the real site, nothing to flag

      var lookalike = false;
      var mentioned = false;
      brand.words.forEach(function (bw) {
        words.forEach(function (w) {
          if (isLookalike(w, bw)) lookalike = true;
          else if (containsBrandWord(w, bw)) mentioned = true;
        });
      });

      // Rule 1 (HIGH): look-alike spelling, e.g. amaz0n.com
      if (lookalike) {
        flags.push({ id: "lookalike", level: "high",
          text: "This website is pretending to be a real company." });
      }
      // Rule 2 (HIGH): real brand name inside a different address
      else if (mentioned) {
        flags.push({ id: "fakebrand", level: "high",
          text: "This is not the real " + brand.name + " website." });
      }
    });

    // Rule 3 (MEDIUM): shortened link
    var isShort = SHORTENERS.some(function (s) { return host === s || host.endsWith("." + s); });
    if (isShort) {
      flags.push({ id: "shortener", level: "medium",
        text: "You can't see where this link really goes." });
    }

    // Rule 4 (MEDIUM): odd ending, raw IP address, hidden characters, or username trick
    var ending = host.split(".").pop();
    var isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    if (isIp || UNUSUAL_TLDS.indexOf(ending) !== -1 ||
        host.indexOf("xn--") !== -1 || link.userInfo) {
      flags.push({ id: "oddaddress", level: "medium",
        text: "This website address looks unusual." });
    }

    // Rule 5 (MEDIUM): http:// instead of https://
    if (link.isHttp) {
      flags.push({ id: "nothttps", level: "medium",
        text: "This page isn't secure. Don't type passwords or card numbers." });
    }

    return flags;
  }

  // ---------------------------------------------------------------------
  // 6. MESSAGE flags (rules 6-15)
  //
  // Each rule has:
  //   id     – a short name (used for counting and in the tests)
  //   level  – "high" or "medium"
  //   text   – the warning shown to the user
  //   test   – a function that gets the lowercase message and returns
  //            true if the red flag is present
  // ---------------------------------------------------------------------

  // A US-style phone number: 1-800-555-0199, (555) 123-4567, 555.123.4567
  var PHONE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

  var MESSAGE_FLAGS = [
    {
      // Rule 6: gift cards / crypto / wire transfers, being asked for as payment
      id: "payment", level: "high",
      text: "Real companies never ask for gift cards or crypto. This is a scam.",
      test: function (t) {
        var odd = /gift ?cards?|itunes card|google play card|steam card|bitcoin|crypto(currency)?\b|\bbtc\b|ethereum|wire (transfer|the money|money|funds)|western union|moneygram/;
        // Only flag when someone is also asking you to pay/send/buy
        var ask = /\b(pay|paying|payment|send|buy|purchase|purchasing|deposit|transfer|scratch|owe|fee|fine|bail|codes?|numbers?|pin|photo|picture|atm)\b/;
        return odd.test(t) && ask.test(t);
      }
    },
    {
      // Rule 7: fake virus / tech-support warnings
      id: "techsupport", level: "high",
      text: "Your computer is fine. Do NOT call this number.",
      test: function (t) {
        var virus = /\b(virus(es)?|malware|trojan|spyware|ransomware|hacked|infected|compromised)\b/;
        var alarm = /detected|warning|alert|your (computer|pc|laptop|device|phone|ip address)|call (us|now|immediately|this number|microsoft|apple|support|tech)|toll[- ]free|helpline|do not (restart|shut|turn off|close)/;
        var support = /(tech(nical)? support|microsoft support|apple support|windows (security|defender|support)).{0,80}(call|phone|dial)|(call|dial).{0,60}(tech(nical)? support|microsoft|apple support)/;
        return (virus.test(t) && (alarm.test(t) || PHONE.test(t))) || support.test(t);
      }
    },
    {
      // Rule 8: prizes and lotteries
      id: "prize", level: "high",
      text: "You can't win a contest you never entered.",
      test: function (t) {
        return /you(?:'ve| have)? (?:been selected|won\b|are a winner)|you(?:'re| are) (?:a|the) (?:lucky )?winner|congratulations[^.!?]{0,60}(won|winner|prize|selected)|lottery (winner|prize|winning|commission|draw)|sweepstakes|claim your (prize|reward|gift|winnings)|free (iphone|gift|prize)|grand prize/.test(t);
      }
    },
    {
      // Rule 9: government impersonation asking for money / info
      id: "government", level: "high",
      text: "Government agencies don't contact you this way.",
      test: function (t) {
        var gov = /\b(irs|internal revenue service|social security( administration)?|ssa|medicare|medicaid|treasury|fbi|department of (justice|treasury|homeland security)|u\.?s\.? marshals?)\b/;
        var ask = /\b(owe|owed|pay|payment|fine|penalty|penalties|arrest|warrant|suspend\w*|verify|confirm|ssn|social security number|bank|account number|back taxes|unpaid|lawsuit|legal action|call (us|now|immediately|this number)|deposit|wire|gift cards?)\b/;
        return gov.test(t) && ask.test(t);
      }
    },
    {
      // Rule 10: asking for passwords, codes, SSN, bank info
      id: "sensitive", level: "high",
      text: "Never share passwords or codes with anyone.",
      test: function (t) {
        // Safe advice like "never share your code" shouldn't count as a request.
        var cleaned = t.replace(/\b(?:do not|don't|dont|never)\s+(?:share|give|tell|send|reveal|disclose|provide)\b[^.!?\n]*/g, " ");
        var thing = /\b(password|passcode|pin( number)?|verification code|security code|confirmation code|one[- ]time (code|password|passcode)|otp|6[- ]digit code|social security number|ssn|bank account( number| details| info\w*)?|routing number|card number|credit card( number| details| info\w*)?|debit card|cvv|login details|account details)\b/;
        var ask = /\b(send|share|give|tell|read|provide|enter|confirm|verify|reply|submit|update|forward|supply|type)\b/;
        return thing.test(cleaned) && ask.test(cleaned);
      }
    },
    {
      // Rule 11: secrecy
      id: "secrecy", level: "high",
      text: "Scammers want you to keep secrets. Talk to family first.",
      test: function (t) {
        return /(don't|do not|dont) (tell|mention|say anything to) (anyone|anybody|your|mom|dad|grandma|grandpa|family|the bank)|keep (this|it) (a )?(secret|between us|confidential|private|quiet)|between (us|you and me)|tell no one|tell nobody|our little secret/.test(t);
      }
    },
    {
      // Rule 12: remote-access software
      id: "remote", level: "high",
      text: "Never let strangers control your computer.",
      test: function (t) {
        return /anydesk|teamviewer|ultraviewer|supremo|logmein|splashtop|rustdesk|screenconnect|connectwise|quick ?support|remote (access|desktop|session|support|control)|chrome remote|(give|grant|allow) (me|us) (access|control)/.test(t);
      }
    },
    {
      // Rule 13: "we refunded too much, send back the difference"
      id: "refund", level: "high",
      text: "This is a common refund scam.",
      test: function (t) {
        var refund = /refund|reimburs|overpa|over-?paid|overcharg|deposited (too much|extra)/;
        var mistake = /too much|extra|excess|difference|accident|mistake|in error|error/;
        var sendBack = /\b(send|return|pay|wire|transfer|give)\b[^.!?]{0,40}\b(back|difference|rest|extra|excess|balance)\b/;
        return refund.test(t) && mistake.test(t) && sendBack.test(t);
      }
    },
    {
      // Rule 14: urgency and threats
      id: "urgency", level: "medium",
      text: "They're rushing you on purpose. Slow down.",
      test: function (t) {
        return /within (the next )?\d+ ?(hours?|hrs?|minutes?|mins?)|within (a|one) (day|hour)|account (has been |is |was |will be )?(suspended|locked|closed|disabled|limited|frozen|compromised|terminated|deactivated)|arrest|warrant|act now|act immediately|(respond|reply|call|pay|act) (immediately|right away|now)|immediate (action|payment|response)|final (notice|warning)|last chance|expires? (today|tonight|soon)|legal action|before it's too late/.test(t);
      }
    },
    {
      // Rule 15: delivery problem asking for a fee or link click
      id: "delivery", level: "medium",
      text: "Delivery companies don't text you for fees.",
      test: function (t) {
        var delivery = /package|parcel|delivery|shipment|shipping|courier|usps|ups|fedex|dhl|tracking number/;
        var problem = /(could not|couldn't|can't|cannot|unable to|failed to|not) (be )?deliver|undeliverable|missed (delivery|your)|on hold|held|address (is )?(incorrect|incomplete|invalid|missing)|incomplete address|reschedule|redelivery|customs/;
        var ask = /fee|pay|charge|click|tap|link|https?:|www\.|\$\d|update your|confirm|verify/;
        return delivery.test(t) && problem.test(t) && ask.test(t);
      }
    }
  ];

  // ---------------------------------------------------------------------
  // 7. Putting it all together
  // ---------------------------------------------------------------------

  // Make the text easier to search: lowercase, straight quotes, tidy spaces.
  function normalize(text) {
    return text
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\s+/g, " ");
  }

  function checkText(input) {
    var text = String(input || "").slice(0, MAX_LENGTH);
    var flags = [];

    // Link rules: for every link found in the text
    findLinks(text).forEach(function (link) {
      flags = flags.concat(checkLink(link));
    });

    // Message rules: for the text itself
    var lowered = normalize(text);
    MESSAGE_FLAGS.forEach(function (rule) {
      if (rule.test(lowered)) {
        flags.push({ id: rule.id, level: rule.level, text: rule.text });
      }
    });

    // Count each KIND of flag once (ten bad links still count as one "lookalike")
    var highKinds = {};
    var mediumKinds = {};
    flags.forEach(function (f) {
      (f.level === "high" ? highKinds : mediumKinds)[f.id] = true;
    });
    var highCount = Object.keys(highKinds).length;
    var mediumCount = Object.keys(mediumKinds).length;

    // Scoring
    var level;
    if (highCount >= 1 || mediumCount >= 3) level = "scam";
    else if (mediumCount >= 1) level = "careful";
    else level = "okay";

    // Build the plain-English list: serious ones first, no repeats.
    var reasons = [];
    ["high", "medium"].forEach(function (lvl) {
      flags.forEach(function (f) {
        if (f.level === lvl && reasons.indexOf(f.text) === -1) reasons.push(f.text);
      });
    });
    if (reasons.length === 0) {
      reasons.push("We didn't spot any common warning signs.");
    }

    return {
      level: level,
      emoji: LEVELS[level].emoji,
      title: LEVELS[level].title,
      reasons: reasons,
      flags: flags,
      footer: FOOTER
    };
  }

  // ---------------------------------------------------------------------
  // 8. Share it with the rest of the extension (and with Node for tests)
  // ---------------------------------------------------------------------

  var api = { checkText: checkText, FOOTER: FOOTER };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;       // Node (tests)
  } else {
    root.ScamRules = api;       // Browser pages
  }
})(typeof self !== "undefined" ? self : this);
