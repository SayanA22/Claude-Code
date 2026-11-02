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
    { name: "AARP",            words: ["aarp"],           domains: ["aarp.org"] },

    // insurance and health
    { name: "Geico",           words: ["geico"],          domains: ["geico.com"] },
    { name: "State Farm",      words: ["statefarm"],      domains: ["statefarm.com"] },
    { name: "Allstate",        words: ["allstate"],       domains: ["allstate.com"] },
    { name: "Humana",          words: ["humana"],         domains: ["humana.com"] },
    { name: "UnitedHealthcare",words: ["unitedhealthcare"], domains: ["unitedhealthcare.com", "uhc.com"] },
    { name: "Aetna",           words: ["aetna"],          domains: ["aetna.com"] },
    { name: "Cigna",           words: ["cigna"],          domains: ["cigna.com"] },
    { name: "Blue Cross",      words: ["bluecross"],      domains: ["bcbs.com", "bluecross.com"] },
    { name: "Kaiser Permanente", words: ["kaiserpermanente"], domains: ["kaiserpermanente.org", "kp.org"] },
    { name: "Veterans Affairs",words: ["veteransaffairs"], domains: ["va.gov"] },
    { name: "the FTC",         words: ["ftc"],            domains: ["ftc.gov"] },
    // more banks and money apps
    { name: "PNC",             words: ["pnc"],            domains: ["pnc.com"] },
    { name: "U.S. Bank",       words: ["usbank"],         domains: ["usbank.com"] },
    { name: "Truist",          words: ["truist"],         domains: ["truist.com"] },
    { name: "Navy Federal",    words: ["navyfederal"],    domains: ["navyfederal.org"] },
    { name: "Charles Schwab",  words: ["schwab"],         domains: ["schwab.com"] },
    { name: "Robinhood",       words: ["robinhood"],      domains: ["robinhood.com"] },
    { name: "Binance",         words: ["binance"],        domains: ["binance.com"] },
    { name: "MetaMask",        words: ["metamask"],       domains: ["metamask.io"] },
    { name: "Trust Wallet",    words: ["trustwallet"],    domains: ["trustwallet.com"] },
    // phone, shopping, and tech companies
    { name: "T-Mobile",        words: ["tmobile"],        domains: ["t-mobile.com"] },
    { name: "Lowe's",          words: ["lowes"],          domains: ["lowes.com"] },
    { name: "Kohl's",          words: ["kohls"],          domains: ["kohls.com"] },
    { name: "Macy's",          words: ["macys"],          domains: ["macys.com"] },
    { name: "Etsy",            words: ["etsy"],           domains: ["etsy.com"] },
    { name: "Adobe",           words: ["adobe"],          domains: ["adobe.com"] },
    { name: "Dropbox",         words: ["dropbox"],        domains: ["dropbox.com"] },
    { name: "DocuSign",        words: ["docusign"],       domains: ["docusign.com", "docusign.net"] },
    { name: "LinkedIn",        words: ["linkedin"],       domains: ["linkedin.com", "lnkd.in"] },
    { name: "TurboTax",        words: ["turbotax", "intuit"], domains: ["turbotax.com", "intuit.com"] },
    { name: "Geek Squad",      words: ["geeksquad"],      domains: ["geeksquad.com"] },
    { name: "LifeLock",        words: ["lifelock"],       domains: ["lifelock.com"] },
    { name: "Roku",            words: ["roku"],           domains: ["roku.com"] },
    { name: "Hulu",            words: ["hulu"],           domains: ["hulu.com"] },
    { name: "Spotify",         words: ["spotify"],        domains: ["spotify.com"] },
    { name: "Uber",            words: ["uber"],           domains: ["uber.com"] },
    { name: "TikTok",          words: ["tiktok"],         domains: ["tiktok.com"] },
    { name: "Telegram",        words: ["telegram"],       domains: ["telegram.org", "t.me"] }
  ];

  // Scammers often glue these onto a short brand name: "apple-support.com"
  var SCAM_WORDS = ["support", "secure", "security", "login", "signin", "verify",
    "verification", "help", "billing", "service", "services", "account", "id",
    "alert", "update", "care", "online", "bank", "pay", "wallet", "refund",
    "tracking", "delivery", "claim"];

  // Link shorteners (the real destination is hidden)
  var SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd",
    "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "tiny.cc", "t.ly",
    "rb.gy", "bl.ink", "lnkd.in", "s.id", "v.gd", "bit.do", "adf.ly", "clck.ru",
    "tr.ee", "short.io", "shorte.st", "qrco.de", "1url.com", "bitly.com", "tiny.one",
    "x.co", "u.to", "soo.gd"];

  // Endings (".xyz") that are cheap and popular with scammers
  var UNUSUAL_TLDS = ["xyz", "top", "click", "zip", "mov", "work", "loan", "icu",
    "buzz", "gq", "cf", "tk", "ml", "ga", "monster", "rest", "country", "kim",
    "cyou", "sbs", "vip", "cam", "men", "date", "review", "download", "racing",
    "stream", "bid", "win", "party", "support", "link", "cfd", "bond", "quest", "fun",
    "pw", "cc", "ws", "su"];

  // Words fake login pages stuff into their addresses: "secure-login-verify.com"
  var WORDY = ["login", "signin", "secure", "security", "verify", "verification",
    "account", "update", "billing", "refund", "claim", "tracking", "alert", "confirm",
    "wallet", "recovery", "unlock", "helpdesk", "payment", "invoice", "suspended",
    "restore", "validate"];
  // Words in the PATH of an address that say "this is a login page"
  var LOGINISH = ["login", "signin", "verify", "account", "password", "secure", "billing", "update", "confirm"];

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
    "|(?<![a-z0-9\\u0080-\\uffff-])(?:[a-z0-9\\u0080-\\uffff-]+\\.)+(?:" + BARE_TLDS.join("|") + ")\\b(?:[\\/?#][^\\s<>\"']*)?",
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
      userInfo: decodeURIComponent(url.username || "").toLowerCase(),
      // The words after the address: "/amazon/signin" -> amazon, signin
      pathWords: (url.pathname + " " + url.search).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
      // Redirect links hide another address inside: google.com/url?q=https://evil.com
      embedded: (function () {
        var found = [];
        url.searchParams.forEach(function (v) { if (/^https?:\/\//i.test(v)) found.push(v); });
        return found;
      })()
    };
  }

  // Letters from other alphabets that look just like English letters (the Russian
  // "а" looks like our "a"). Scammers use them to fake brand names: "аpple.com".
  var CONFUSABLES = { "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y",
    "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "ԛ": "q", "ԝ": "w", "һ": "h", "ӏ": "l",
    "ο": "o", "α": "a", "ν": "v", "ρ": "p", "ι": "i", "ı": "i", "ɡ": "g" };

  function foldConfusables(s) {
    return s.replace(/[^\x00-\x7f]/g, function (ch) { return CONFUSABLES[ch] || ch; });
  }

  var TWO_PART_ENDINGS = ["co.uk", "org.uk", "com.au", "co.nz", "co.jp", "com.br", "co.in", "com.mx"];
  function baseDomain(host) {
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;
    var p = host.split(".");
    if (p.length >= 3 && TWO_PART_ENDINGS.indexOf(p.slice(-2).join(".")) !== -1) return p.slice(-3).join(".");
    return p.slice(-2).join(".");
  }

  // The address exactly as it was typed, before the browser turns accents and
  // foreign letters into "xn--" codes.
  function typedHost(raw) {
    var s = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split(/[\/?#]/)[0];
    return s.replace(/^.*@/, "").replace(/:\d+$/, "").toLowerCase().replace(/^www\./, "");
  }

  // ---------------------------------------------------------------------
  // 5. LINK flags (rules 1-5). Returns a list of {id, level, text}.
  // ---------------------------------------------------------------------

  function checkLink(raw, nested) {
    var flags = [];
    var link = parseLink(raw);
    if (!link) return flags;
    var host = link.host;

    // Everything we should examine: the address itself, plus the fake
    // "username" part if there is one.
    var words = wordsInHost(host);
    if (link.userInfo) words = words.concat(wordsInHost(link.userInfo + ".x"));

    // The same address with look-alike foreign letters turned back into English
    // ones. If that spells a brand, it is a fake.
    var typed = typedHost(raw), foldedWords = [];
    if (/[^\x00-\x7f]/.test(typed)) foldedWords = wordsInHost(foldConfusables(typed));

    var flagged = {};   // brands we already warned about for this link
    BRANDS.forEach(function (brand) {
      if (isOfficial(host, brand)) return; // the real site, nothing to flag

      var lookalike = false;
      var mentioned = false;
      brand.words.forEach(function (bw) {
        foldedWords.forEach(function (w) { if (containsBrandWord(w, bw)) lookalike = true; });
        words.forEach(function (w) {
          if (isLookalike(w, bw)) lookalike = true;
          else if (containsBrandWord(w, bw)) mentioned = true;
        });
      });

      // Rule 1 (HIGH): look-alike spelling, e.g. amaz0n.com
      if (lookalike) {
        flagged[brand.name] = true;
        flags.push({ id: "lookalike", level: "high",
          text: "This website is pretending to be a real company." });
      }
      // Rule 2 (HIGH): real brand name inside a different address
      else if (mentioned) {
        flagged[brand.name] = true;
        flags.push({ id: "fakebrand", level: "high",
          text: "This is not the real " + brand.name + " website." });
      }
    });

    // Rule 2b (HIGH): a brand name in the PATH of a login-looking page on some other
    // site, e.g. https://example.com/amazon/signin
    var loginPath = link.pathWords.some(function (w) { return LOGINISH.indexOf(w) !== -1; });
    if (loginPath) {
      BRANDS.forEach(function (brand) {
        if (flagged[brand.name] || isOfficial(host, brand)) return;
        var inPath = brand.words.some(function (bw) {
          return link.pathWords.some(function (w) { return containsBrandWord(w, bw); });
        });
        if (inPath) {
          flagged[brand.name] = true;
          flags.push({ id: "fakebrand", level: "high", text: "This is not the real " + brand.name + " website." });
        }
      });
    }

    // Rule 2c (MEDIUM): an address stuffed with "secure", "login", "verify"... words
    var isOfficialAnywhere = BRANDS.some(function (b) { return isOfficial(host, b); });
    var wordyHits = words.filter(function (w, i) { return WORDY.indexOf(w) !== -1 && words.indexOf(w) === i; });
    if (!isOfficialAnywhere && wordyHits.length >= 2) {
      flags.push({ id: "wordy", level: "medium",
        text: "This address is stuffed with \u201Csecure\u201D and \u201Clogin\u201D words. Real websites keep it simple." });
    }

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

    // Redirect links hide another address inside. Check that one too.
    if (!nested) {
      link.embedded.forEach(function (inner) { flags = flags.concat(checkLink(inner, true)); });
    }

    return flags;
  }

  // ---------------------------------------------------------------------
  // 6. MESSAGE flags (rules 6-15, and more below)
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

  // The phrases each rule looks for. They live here (not inside the rules) so the
  // same phrase can be used for BOTH deciding and highlighting.
  var R = {
    payOdd: /gift ?cards?|itunes card|google play card|steam card|bitcoin|crypto(currency)?\b|\bbtc\b|ethereum|wire (transfer|the money|money|funds)|western union|moneygram|prepaid (?:debit |visa )?cards?|money order|cashier'?s check/,
    payAsk: /\b(pay|paying|payment|send|buy|purchase|purchasing|deposit|transfer|scratch|owe|fee|fine|bail|codes?|numbers?|pin|photo|picture|atm)\b/,
    virus: /\b(virus(es)?|malware|trojan|spyware|ransomware|hacked|infected|compromised)\b/,
    alarm: /detected|warning|alert|your (computer|pc|laptop|device|phone|ip address)|call (us|now|immediately|this number|microsoft|apple|support|tech)|toll[- ]free|helpline|do not (restart|shut|turn off|close)/,
    support: /(tech(nical)? support|microsoft support|apple support|windows (security|defender|support)).{0,80}(call|phone|dial)|(call|dial).{0,60}(tech(nical)? support|microsoft|apple support)/,
    prize: /you(?:'ve| have)? (?:been selected|won\b|are a winner)|you(?:'re| are) (?:a|the) (?:lucky )?winner|congratulations[^.!?]{0,60}(won|winner|prize|selected)|lottery (winner|prize|winning|commission|draw)|sweepstakes|claim your (prize|reward|gift|winnings)|free (iphone|gift|prize)|grand prize/,
    gov: /\b(irs|internal revenue service|social security( administration)?|ssa|medicare|medicaid|treasury|fbi|department of (justice|treasury|homeland security)|u\.?s\.? marshals?)\b/,
    govAsk: /\b(owe|owed|pay (?:now|today|immediately|the|your|a|this)|fine|penalty|penalties|arrest|warrant|suspend\w*|verify|confirm|ssn|social security number|back taxes|unpaid|lawsuit|legal action|call (us|now|immediately|this number)|wire|gift cards?)\b/,
    sensThing: /\b(password|passcode|pin( number)?|verification code|security code|confirmation code|one[- ]time (code|password|passcode)|otp|6[- ]digit code|social security number|ssn|bank account( number| details| info\w*)?|routing number|card number|credit card( number| details| info\w*)?|debit card|cvv|login details|account details)\b/,
    sensAsk: /\b(send|share|give|tell|read|provide|enter|confirm|verify|reply|submit|update|forward|supply|type)\b/,
    sensSafe: /\b(?:do not|don't|dont|never)\s+(?:share|give|tell|send|reveal|disclose|provide)\b[^.!?\n]*/g,
    secrecy: /(don't|do not|dont) (tell|mention|say anything to) (anyone|anybody|your|mom|dad|grandma|grandpa|family|the bank)|keep (this|it) (a )?(secret|between us|confidential|private|quiet)|between (us|you and me)|tell no one|tell nobody|our little secret/,
    remote: /anydesk|teamviewer|ultraviewer|supremo|logmein|splashtop|rustdesk|screenconnect|connectwise|quick ?support|remote (access|desktop|session|support|control)|chrome remote|(give|grant|allow) (me|us) (access|control)/,
    refund: /refund|reimburs|overpa|over-?paid|overcharg|deposited (too much|extra)/,
    mistake: /too much|extra|excess|difference|accident|mistake|in error|error/,
    sendBack: /\b(send|return|pay|wire|transfer|give)\b[^.!?]{0,40}\b(back|difference|rest|extra|excess|balance)\b/,
    urgency: /within (the next )?\d+ ?(hours?|hrs?|minutes?|mins?)|within (a|one) (day|hour)|account (has been |is |was |will be )?(suspended|locked|closed|disabled|limited|frozen|compromised|terminated|deactivated)|arrest|warrant|act now|act immediately|(respond|reply|call|pay|act) (immediately|right away|now)|immediate (action|payment|response)|final (notice|warning)|expires? (today|tonight|soon)|legal action|before it's too late/,
    delivery: /package|parcel|delivery|shipment|shipping|courier|usps|ups|fedex|dhl|tracking number/,
    problem: /(could not|couldn't|can't|cannot|unable to|failed to|not) (be )?deliver|undeliverable|unclaimed|shipping fee|redelivery fee|clearance fee|customs fee|postage due|pending delivery|missed (delivery|your)|on hold|held|address (is )?(incorrect|incomplete|invalid|missing)|incomplete address|reschedule|redelivery|customs/,
    deliveryAsk: /fee|pay|charge|click|tap|link|https?:|www\.|\$\d|update your|confirm|verify/,
    money: /\$\d[\d.,]*/,
    moneyWords: /\b(pay|money|bank|gift ?cards?|wire|send|account|password|codes?|ssn|irs|cash|crypto|bitcoin)\b|\$\d/,
    innocent: /\b(surprise|birthday|anniversary|party)\b/,

    // "Grandma, it's me, I'm in trouble": family emergency + money
    famEmergency: /\b(?:i'm|i am|im) (?:in )?(?:jail|trouble|custody)\b|\b(?:i'm|i am|im) (?:in )?(?:the|a) hospital\b|\b(?:i was|i got|i've been|i have been|i just got) (?:arrested|in an accident|in a car accident|in a crash|in a wreck)\b|\bneed (?:bail|a lawyer)\b|\bbail (?:money|me)\b|\bpublic defender\b/,
    famMoney: /\b(?:bail|wire|money|cash|gift ?cards?|western union|venmo|zelle|cash ?app|bitcoin|funds|retainer)\b|\bsend (?:me |us )?(?:\$\d|money|cash)/,
    // a "friend" or "love" you have only met online, who needs money
    romWords: /\b(?:i love you|my love|sweetheart|darling|my dear|my darling|soulmate|my queen|my king)\b/,
    romStory: /\b(?:overseas|deployed|oil rig|stranded|abroad|inheritance|customs|military|widow(?:er)?|peacekeeping|on a ship|offshore)\b/,
    romAsk: /\b(?:money|funds|cash|gift ?cards?|wire|bitcoin|crypto|western union|invest\w*|bank (?:account|details)|plane ticket|visa fee)\b/,
    // get-rich promises
    invest: /\b(?:guaranteed (?:returns?|profits?|income)|risk[- ]free|double your money|(?:daily|weekly|monthly) (?:profits?|returns?|income)|investment opportunity|crypto (?:trading|investment|mining)|trading (?:platform|bot|signals)|\d+% (?:daily|weekly|monthly)|financial freedom|forex)\b/,
    // "deposit this check and send some back"
    depositCheck: /\b(?:deposit|cash|cashing)\b[^.!?]{0,30}\b(?:check|cheque|money order|cashier'?s check)\b/,
    checkSendBack: /\b(?:send|wire|transfer|buy|purchase|zelle)\b[^.!?]{0,70}\b(?:back|difference|rest|remaining|balance|vendor|supplies|equipment|gift ?cards?|bitcoin)\b/,
    jobBait: /\b(?:mystery shopper|secret shopper|work from home|payment processor|package (?:reshipping|forwarding|re-?shipping)|re-?shipping)\b/,
    // "move your money to a safe account"
    safeAcct1: /\b(?:move|transfer|wire) (?:your )?(?:money|funds|savings)[^.!?]{0,40}\b(?:safe|secure|protected|government|federal|treasury) account\b/,
    safeAcct2: /\bsafe account\b|\bprotect(?:ed)? (?:account|your (?:money|funds|savings))\b/,
    safeAcct3: /\b(?:fbi|police|treasury|fraud (?:department|team|unit)|security (?:department|team))\b[^.!?]{0,60}\b(?:move|transfer|withdraw)\b/,
    // someone coming to your door for cash
    courier: /\b(?:courier|driver|agent|representative|messenger|runner|officer)\b[^.!?]{0,50}\b(?:pick ?up|collect|come to (?:your )?(?:home|house|door|address))\b[^.!?]{0,40}\b(?:cash|money|envelope|funds|bail)\b|\b(?:cash|money|envelope|funds)\b[^.!?]{0,40}\b(?:pick ?up|picked up|collect(?:ed)?)\b[^.!?]{0,30}\b(?:courier|driver|agent|messenger|runner)\b/,
    stayLine: /\b(?:don't|do not|dont) (?:hang up|end the call|disconnect)\b/,
    stayCtx: /\b(?:officer|agent|irs|bank|police|social security|warrant|arrest|account|fraud|microsoft|apple|support|government|investigation)\b/,
    // unpaid toll / DMV texts with a link
    tollWord: /\b(?:toll|e-?zpass|ezdrive|fastrak|sunpass|ipass|dmv|motor vehicles?|parking (?:ticket|violation|fine)|traffic (?:ticket|violation|fine)|license (?:suspension|suspended))\b/,
    tollPay: /\b(?:unpaid|outstanding|overdue|past due|balance|fine|penalty|late fee|pay|payment|fee)\b/,
    hasLinkish: /https?:|www\.|\b[a-z0-9-]+\.(?:com|net|org|top|xyz|info|co|us|click|link|vip|help|cc|site|online|app)\b/,
    // "your power will be shut off today"
    utility: /\b(?:electric(?:ity)?|power|gas|water|utility|utilities|internet|cable)\b[^.!?]{0,50}\b(?:shut ?off|disconnect(?:ed|ion)?|cut off|terminated|turned off|suspended)\b/,
    utilityUrgent: /\b(?:today|within|immediately|right now|hours|minutes|call|pay|payment)\b/,
    utilityPay: /\b(?:pay|payment|bill|past due|overdue|unpaid|balance|account)\b|\$\d/,
    // "verify your account" + a link
    verifyAcct: /\b(?:verify|confirm|update|restore|reactivate|unlock|validate|review|secure)\b[^.!?]{0,25}\b(?:your )?(?:account|identity|log-?in|password|payment (?:method|details|info\w*)|billing (?:info\w*|details)|profile|card)\b/,
    clickAsk: /\b(?:click(?:ing)?|tap(?:ping)?|follow(?:ing)?|visit(?:ing)?|open(?:ing)?)\b[^.!?]{0,30}\b(?:link|here|below|button)\b/,
    // QR codes that ask for money or logins
    qr: /\bscan (?:this|the|our|my|attached) (?:qr|code|barcode)\b|\bqr code\b[^.!?]{0,40}\b(?:pay|scan|verify|claim|log ?in|refund)\b/,
    qrCtx: /\b(?:pay|payment|refund|claim|verify|account|log ?in|package|delivery|prize|reward|bank|crypto)\b/,
    // a "wrong number" that turns friendly
    wrongNum: /\b(?:wrong number|sorry,? (?:i )?(?:think )?(?:i )?(?:have|got) the wrong|did i (?:text|reach|message) the right)\b/,
    friendly: /\b(?:nice to meet|make friends|get to know|you seem (?:nice|sweet|kind|lovely)|whatsapp|telegram|lonely|new friend|chat (?:with|sometime|more))\b/,
    // surprise charges and fake invoices with a number to call
    charge: /\b(?:you(?:'ve| have| were)? (?:been )?charged|has been charged|(?:was|were|been|got) charged|if (?:this|that) (?:wasn't|was not|isn't) you|charge of \$[\d,.]+|payment of \$[\d,.]+ (?:was|has been)|your (?:subscription|membership|plan|order|invoice|payment)[^!?]{0,40}(?:renew\w*|\$\d|activated|confirmed|processed)|invoice (?:no|number|#)|auto-?renew\w*|receipt for)/,
    callWord: /\b(?:call|dispute|cancel|contact|reach)\b/,
    bigBrand: /\b(?:geek squad|norton|mcafee|lifelock|paypal|best buy|amazon|apple|microsoft|webroot|avast|geico|coinbase|binance|cash app|venmo|zelle|walmart|costco)\b/,
    amount: /\$\d{2,}/,
    callCta: /\b(?:call|dial|phone|contact) (?:us|our|this|the|now|immediately|support|customer|billing|fraud|security|at)\b/,
    acctCtx: /\byour (?:account|card|order|payment|subscription|computer|device|social security|bank|package|refund|benefits)\b|\b(?:suspended|locked|frozen|compromised|fraudulent|unauthorized|unusual activity|suspicious activity)\b/,
    // "Hi Mom, this is my new number" + a request for money
    newNum: /\b(?:this is my new number|my new number|new number|lost my phone|dropped my phone|broke my phone|phone (?:broke|died|fell in|got (?:stolen|broken))|old phone (?:broke|died))\b/,
    newNumMoney: /\b(?:gift ?cards?|western union|zelle|venmo|cash ?app|bitcoin|wire|bail)\b|\bsend (?:me |us )?(?:\$\d|money|cash)|\bfriend'?s (?:account|card)\b|\b(?:pay|cover) (?:a|an|my|this|the) (?:bill|invoice|fee|payment)\b/,
    // easy-money job offers
    earn: /\b(?:earn|make) \$?\d[\d,]*(?:\.\d+)? ?(?:a|per|\/) ?(?:day|week|hour)\b|\bno experience (?:needed|required|necessary)\b|\bwork from home\b[^.!?]{0,40}\b(?:earn|make|income|\$)/,
    // "you have inherited millions" (a stranger offering a fortune)
    advance: /\b(?:unclaimed (?:funds|assets|inheritance|money)|dormant account|lottery commission|barrister|diplomat|next of kin|beneficiary of)\b|\b(?:inheritance|fortune|funds)\b[^.!?]{0,40}(?:million|\$\d{1,3}(?:,\d{3}){2,})/,
    advAsk: /\b(?:fee|processing|transfer fee|tax|release|claim|reply|contact|provide|bank (?:details|account))\b/
  };

  // Each rule has:
  //   id     – a short name (used for counting and in the tests)
  //   level  – "high" or "medium"
  //   text   – the warning shown to the user
  //   test   – gets the lowercase message, returns true if the red flag is present
  //   marks  – the phrases (from R above) to HIGHLIGHT in the message when it fires
  var MESSAGE_FLAGS = [
    { // Rule 6: gift cards / crypto / wire transfers, being asked for as payment
      id: "payment", level: "high",
      text: "Real companies never ask for gift cards or crypto. This is a scam.",
      test: function (t) { return R.payOdd.test(t) && R.payAsk.test(t.replace(new RegExp(R.payOdd.source, "g"), " ")); },   // someone must ALSO ask you to pay/send/buy
      marks: [R.payOdd]
    },
    { // Rule 7: fake virus / tech-support warnings
      id: "techsupport", level: "high",
      text: "Your computer is fine. Do NOT call this number.",
      test: function (t) { return (R.virus.test(t) && (R.alarm.test(t) || PHONE.test(t))) || R.support.test(t); },
      marks: [R.virus, PHONE, R.support]
    },
    { // Rule 8: prizes and lotteries
      id: "prize", level: "high",
      text: "You can't win a contest you never entered.",
      test: function (t) { return R.prize.test(t); },
      marks: [R.prize]
    },
    { // Rule 9: government impersonation asking for money / info
      id: "government", level: "high",
      text: "Government agencies don't contact you this way.",
      test: function (t) { return R.gov.test(t) && R.govAsk.test(t); },
      marks: [R.gov, R.govAsk]
    },
    { // Rule 10: asking for passwords, codes, SSN, bank info
      id: "sensitive", level: "high",
      text: "Never share passwords or codes with anyone.",
      test: function (t) {
        // Safe advice like "never share your code" shouldn't count as a request.
        var cleaned = t.replace(R.sensSafe, " ");
        return R.sensThing.test(cleaned) && R.sensAsk.test(cleaned);
      },
      marks: [R.sensThing]
    },
    { // Rule 11: secrecy
      id: "secrecy", level: "high",
      text: "Scammers want you to keep secrets. Talk to family first.",
      test: function (t) {
        // A surprise party or birthday is not a scam, unless money or accounts come up too.
        if (R.innocent.test(t) && !R.moneyWords.test(t)) return false;
        return R.secrecy.test(t);
      },
      marks: [R.secrecy]
    },
    { // Rule 12: remote-access software
      id: "remote", level: "high",
      text: "Never let strangers control your computer.",
      test: function (t) { return R.remote.test(t); },
      marks: [R.remote]
    },
    { // Rule 13: "we refunded too much, send back the difference"
      id: "refund", level: "high",
      text: "This is a common refund scam.",
      test: function (t) { return R.refund.test(t) && R.mistake.test(t) && R.sendBack.test(t); },
      marks: [R.refund, R.sendBack]
    },
    { // Rule 14: urgency and threats
      id: "urgency", level: "medium",
      text: "They're rushing you on purpose. Slow down.",
      test: function (t) { return R.urgency.test(t); },
      marks: [R.urgency]
    },
    { // Rule 15: delivery problem asking for a fee or link click
      id: "delivery", level: "medium",
      text: "Delivery companies don't text you for fees.",
      test: function (t) { return R.delivery.test(t) && R.problem.test(t) && R.deliveryAsk.test(t); },
      marks: [R.problem, R.money]
    },

    // ----- More scams that often target older adults -----
    { // "Grandma, it's me. I'm in trouble and need money."
      id: "familyemergency", level: "high",
      text: "Check with your family member on a number you already know before sending anything.",
      test: function (t) { return R.famEmergency.test(t) && R.famMoney.test(t); },
      marks: [R.famEmergency, R.famMoney]
    },
    { // Someone you only know online asking for money
      id: "romance", level: "high",
      text: "Be very careful with someone you only know online who asks for money.",
      test: function (t) { return R.romWords.test(t) && R.romStory.test(t) && R.romAsk.test(t); },
      marks: [R.romWords, R.romStory, R.romAsk]
    },
    { // Deposit a check, then send some money back
      id: "checkscam", level: "high",
      text: "Real employers and buyers never ask you to deposit a check and send money back.",
      test: function (t) { return (R.depositCheck.test(t) && R.checkSendBack.test(t)) || (R.jobBait.test(t) && R.depositCheck.test(t)); },
      marks: [R.depositCheck, R.jobBait, R.checkSendBack]
    },
    { // "Move your money to a safe account"
      id: "safeacct", level: "high",
      text: "Your bank will never ask you to move your money to keep it protected.",
      test: function (t) { return R.safeAcct1.test(t) || R.safeAcct2.test(t) || R.safeAcct3.test(t); },
      marks: [R.safeAcct1, R.safeAcct2, R.safeAcct3]
    },
    { // A courier coming to your door to pick up cash
      id: "courier", level: "high",
      text: "No real company or agency sends someone to your door to collect cash.",
      test: function (t) { return R.courier.test(t); },
      marks: [R.courier]
    },
    { // "Don't hang up"
      id: "stayline", level: "high",
      text: "Scammers keep you on the phone so you can't think. Hang up and call back on a number you trust.",
      test: function (t) { return R.stayLine.test(t) && R.stayCtx.test(t); },
      marks: [R.stayLine]
    },
    { // Unpaid toll / DMV text with a link
      id: "toll", level: "high",
      text: "Toll and motor-vehicle offices don't text you links to pay.",
      test: function (t) { return R.tollWord.test(t) && R.tollPay.test(t) && R.hasLinkish.test(t); },
      marks: [R.tollWord, R.tollPay]
    },
    { // A stranger offering you a fortune
      id: "advance", level: "high",
      text: "A stranger offering you a fortune is a scam.",
      test: function (t) { return R.advance.test(t) && R.advAsk.test(t); },
      marks: [R.advance]
    },
    { // "Hi Mom, this is my new number" and then a request for money
      id: "newnumber", level: "high",
      text: "Call the person on the number you already have before sending any money.",
      test: function (t) { return R.newNum.test(t) && R.newNumMoney.test(t); },
      marks: [R.newNum, R.newNumMoney]
    },
    { // A fake bill from a big company with a number to call
      id: "fakeinvoice", level: "high",
      text: "That bill is fake. Don't call the number on it.",
      test: function (t) { return R.charge.test(t) && PHONE.test(t) && R.callWord.test(t) && R.bigBrand.test(t) && R.amount.test(t); },
      marks: [R.charge, PHONE, R.bigBrand]
    },
    { // Get-rich promises
      id: "invest", level: "medium",
      text: "Real investments never promise guaranteed profits.",
      test: function (t) { return R.invest.test(t); },
      marks: [R.invest]
    },
    { // Easy-money job offers
      id: "jobscam", level: "medium",
      text: "Easy-money job offers by text are almost always scams.",
      test: function (t) { return R.earn.test(t); },
      marks: [R.earn]
    },
    { // "Your power will be shut off today"
      id: "utility", level: "medium",
      text: "Utility companies don't threaten to cut you off by text.",
      test: function (t) { return R.utility.test(t) && R.utilityUrgent.test(t) && R.utilityPay.test(t); },
      marks: [R.utility]
    },
    { // "Confirm your account" through a link
      id: "verifyacct", level: "medium",
      text: "Real companies don't ask you to confirm your account through a link in a message.",
      test: function (t) { return R.verifyAcct.test(t) && R.clickAsk.test(t); },
      marks: [R.verifyAcct]
    },
    { // QR codes that ask for money or logins
      id: "qr", level: "medium",
      text: "Be careful with QR codes in messages. You can't see where they lead.",
      test: function (t) { return R.qr.test(t) && R.qrCtx.test(t); },
      marks: [R.qr]
    },
    { // A "wrong number" that turns friendly
      id: "wrongnum", level: "medium",
      text: "A \u201Cwrong number\u201D text that turns friendly is how many scams begin.",
      test: function (t) { return R.wrongNum.test(t) && R.friendly.test(t); },
      marks: [R.wrongNum, R.friendly]
    },
    { // A surprise charge with a number to call
      id: "surprisecharge", level: "medium",
      text: "A surprise charge with a number to call is a common scam. Look up the real number yourself.",
      test: function (t) { return R.charge.test(t) && PHONE.test(t) && R.callWord.test(t); },
      marks: [R.charge, PHONE]
    },
    { // "Call this number" about your account
      id: "callnumber", level: "medium",
      text: "Scammers want you to call a number they picked. Look up the real number yourself.",
      test: function (t) { return R.callCta.test(t) && PHONE.test(t) && R.acctCtx.test(t); },
      marks: [R.callCta, PHONE]
    }
  ];

  // ---------------------------------------------------------------------
  // 7. Putting it all together
  // ---------------------------------------------------------------------

  // Make the text easier to search: lowercase, straight quotes, tidy spaces.
  // We also remember where each character came from, so a match in the tidy
  // text can be pointed back at the exact words in the original message.
  function normalizeWithMap(text) {
    var out = [], map = [], prevSpace = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (/\s/.test(ch)) {
        if (!prevSpace) { out.push(" "); map.push(i); prevSpace = true; }
        continue;
      }
      prevSpace = false;
      if (ch === "‘" || ch === "’") ch = "'";
      else if (ch === "“" || ch === "”") ch = '"';
      var low = ch.toLowerCase();
      for (var j = 0; j < low.length; j++) { out.push(low[j]); map.push(i); }
    }
    return { str: out.join(""), map: map };
  }

  // Join overlapping or touching spans: [{start,end}, ...]
  function mergeSpans(spans) {
    var sorted = spans.slice().sort(function (a, b) { return a.start - b.start; });
    var out = [];
    sorted.forEach(function (s) {
      var last = out[out.length - 1];
      if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
      else out.push({ start: s.start, end: s.end });
    });
    return out;
  }

  // Where (in the ORIGINAL text) do these phrases appear?
  function findSpans(regexes, norm) {
    var out = [];
    regexes.forEach(function (r) {
      var g = new RegExp(r.source, "g"), m;
      while ((m = g.exec(norm.str)) !== null) {
        if (m[0].length === 0) { g.lastIndex++; continue; }
        out.push({ start: norm.map[m.index], end: norm.map[m.index + m[0].length - 1] + 1 });
      }
    });
    return mergeSpans(out);
  }

  // options.realLink: when the right-click menu knows the REAL address of a link,
  // we can warn if the words next to it name a different website.
  function checkText(input, options) {
    var text = String(input || "").slice(0, MAX_LENGTH);
    var flags = [];

    // Link rules: for every link found in the text
    findLinks(text).forEach(function (link) {
      var at = text.indexOf(link);
      var spans = at >= 0 ? [{ start: at, end: at + link.length }] : [];
      checkLink(link).forEach(function (f) { f.spans = spans; flags.push(f); });
    });

    // The link says one website but really goes to another (a classic trick)
    if (options && options.realLink) {
      var real = parseLink(options.realLink);
      if (real) {
        findLinks(text).forEach(function (link) {
          var shown = parseLink(link);
          if (!shown || baseDomain(shown.host) === baseDomain(real.host)) return;
          var at = text.indexOf(link);
          flags.push({ id: "linkmismatch", level: "high",
            text: "The link says one website but really goes to another.",
            spans: at >= 0 ? [{ start: at, end: at + link.length }] : [] });
        });
      }
    }

    // Message rules: for the text itself
    var norm = normalizeWithMap(text);
    MESSAGE_FLAGS.forEach(function (rule) {
      if (rule.test(norm.str)) {
        flags.push({ id: rule.id, level: rule.level, text: rule.text, spans: findSpans(rule.marks, norm) });
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

    // A pushy message AND a suspicious link together is a scam, even with only two
    // medium signs (e.g. "act now" plus a shortened link).
    var LINK_KINDS = { shortener: 1, oddaddress: 1, nothttps: 1, wordy: 1 };
    var mediumIds = Object.keys(mediumKinds);
    var linkAndMessage = mediumIds.some(function (id) { return LINK_KINDS[id]; }) &&
                         mediumIds.some(function (id) { return !LINK_KINDS[id]; });

    // Scoring
    var level;
    if (highCount >= 1 || mediumCount >= 3 || linkAndMessage) level = "scam";
    else if (mediumCount >= 1) level = "careful";
    else level = "okay";

    // The evidence: one entry per plain-English warning (serious ones first, no
    // repeats), each with the places in the message it points at.
    var evidence = [], byText = {};
    ["high", "medium"].forEach(function (lvl) {
      flags.forEach(function (f) {
        if (f.level !== lvl) return;
        var e = byText[f.text];
        if (!e) { e = byText[f.text] = { id: f.id, level: f.level, text: f.text, spans: [] }; evidence.push(e); }
        e.spans = e.spans.concat(f.spans || []);
      });
    });
    evidence.forEach(function (e) { e.spans = mergeSpans(e.spans); });

    var reasons = evidence.map(function (e) { return e.text; });
    if (reasons.length === 0) {
      reasons.push("We didn't spot any common warning signs.");
    }

    return {
      level: level,
      emoji: LEVELS[level].emoji,
      title: LEVELS[level].title,
      reasons: reasons,
      flags: flags,
      evidence: evidence,   // [{id, level, text, spans:[{start,end}]}] for highlighting
      text: text,           // the message as checked (spans point into this)
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
