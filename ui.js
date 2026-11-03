/*
 * ui.js — the "pieces" of the screen: the owl mascot, line icons, the highlighted
 * message, the verdict card, the risk bar, the reasons list, and the advice callout.
 *
 * It only draws things. All the thinking is in rules.js, and the flow (what happens
 * when you press Check) is in app.js.
 *
 * Safety note: messages are always put on the page with textContent (never innerHTML),
 * so nothing inside a scammer's message can ever run as code. The only innerHTML below
 * is our OWN drawings (the owl and the icons).
 *
 * To rename the app, change APP_NAME here (and "name" in manifest.json).
 */
const ScamUI = (function () {
  "use strict";

  var APP_NAME = "Scam Spotter";

  // One calm line under each verdict. (We never say "safe": the best answer is
  // "Looks okay", and that line says plainly it is not a promise.)
  var VERDICT_LINE = {
    scam: "Please don't click, call, or pay.",
    careful: "Slow down and double-check before you do anything.",
    okay: "Nothing stood out to us. That isn't a promise, so stay alert."
  };
  var RISK_LABEL = { okay: "Low risk", careful: "Medium risk", scam: "High risk" };
  var SEVERITY = { high: "Serious", medium: "Worth a look" };

  // What to do next. Plain, calm, and the same few steps every time.
  var STEPS = {
    scam: [
      "Don\u2019t click any links, call any numbers, or reply.",
      "Delete the message, or block the sender.",
      "If you already paid or shared a password or code, call your bank or card company right away, using the number on the back of your card.",
      "In the U.S., you can report it: forward scam texts to 7726 (SPAM), or go to reportfraud.ftc.gov."
    ],
    careful: [
      "Don\u2019t click or reply yet.",
      "Contact the company using a phone number or website you already know, not the one in the message.",
      "Ask a family member to take a look with you."
    ]
  };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------------------------------------------------------------------
  // One consistent set of line icons (24x24, 2px rounded strokes)
  // ---------------------------------------------------------------------
  var P = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var ICONS = {
    arrow:   P + '<path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    chevron: P + '<path d="M9 6l6 6-6 6"/></svg>',
    down:    P + '<path d="M6 9l6 6 6-6"/></svg>',
    up:      P + '<path d="M6 15l6-6 6 6"/></svg>',
    lock:    P + '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    people:  P + '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17.2" cy="9" r="2.8"/><path d="M16.6 14.3c2.9.3 4.8 2.3 4.8 5.2"/></svg>',
    box:     P + '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>',
    link:    P + '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    chat:    P + '<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/></svg>',
    check:   P + '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/></svg>',
    copy:    P + '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>',
    steps:   P + '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6.5l1 1 2-2M4 12.5l1 1 2-2M4 18.5l1 1 2-2"/></svg>'
  };

  function icon(name, cls) {
    var s = el("span", "ico " + (cls || ""));
    s.innerHTML = ICONS[name];
    return s;
  }

  // ---------------------------------------------------------------------
  // The owl mascot: one picture (img/owl.png) plus a small badge that shows
  // how it feels about the message:
  //   idle    – no badge, just waiting for you to paste something
  //   scan    – a magnifying glass, bobbing while it reads
  //   scam    – red "!" badge, and the owl gives a little shake
  //   careful – amber "!" badge
  //   okay    – green check badge
  // ---------------------------------------------------------------------
  function owlSrc() { return (document.body && document.body.dataset.root || "") + "img/owl.png"; }

  function badgeMarkup(mood) {
    var fill = { scam: "#D92D20", careful: "#E8A200", okay: "#12A150", scan: "#0A3F73" }[mood];
    if (!fill) return "";
    var s = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="' + fill + '" stroke="#fff" stroke-width="3"/>';
    var w = ' fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"';
    if (mood === "okay") s += '<path d="M11 21 L18 28 L30 13"' + w + '/>';
    else if (mood === "scan") s += '<circle cx="18" cy="18" r="7"' + w + '/><path d="M23.5 23.5 L30 30"' + w + '/>';
    else s += '<path d="M20 10 L20 22"' + w + '/><circle cx="20" cy="29.5" r="2.6" fill="#fff"/>';
    return s + '</svg>';
  }

  function owl(mood) {
    var s = el("span", "owl owl-" + mood);
    var img = el("img", "owl-img"); img.src = owlSrc(); img.alt = "";
    s.appendChild(img);
    var b = badgeMarkup(mood);
    if (b) { var badge = el("span", "owl-badge"); badge.innerHTML = b; s.appendChild(badge); }
    return s;
  }

  // ---------------------------------------------------------------------
  // The message, with the warning signs highlighted INSIDE it.
  // evidence = [{level, spans:[{start,end}]}, ...] (from rules.js).
  // Each reason gets a number; the number sits right after its first highlighted
  // phrase, so the list can say "this is what number 2 means".
  // ---------------------------------------------------------------------
  function annotate(text, evidence) {
    var box = el("div", "msg-text");
    var marks = [];

    var cuts = { 0: true };
    cuts[text.length] = true;
    evidence.forEach(function (e) {
      e.spans.forEach(function (s) { cuts[s.start] = true; cuts[s.end] = true; });
    });
    var points = Object.keys(cuts).map(Number).sort(function (a, b) { return a - b; });

    // which numbers get their badge after the segment that ends at position p
    var badgeAt = {};
    evidence.forEach(function (e, i) {
      if (e.spans.length) {
        var p = e.spans[0].end;
        (badgeAt[p] = badgeAt[p] || []).push(i + 1);
      }
    });

    for (var k = 0; k < points.length - 1; k++) {
      var a = points[k], b = points[k + 1];
      if (a === b) continue;
      var covering = [];
      evidence.forEach(function (e, i) {
        if (e.spans.some(function (s) { return s.start <= a && b <= s.end; })) covering.push(i);
      });
      var piece = text.slice(a, b);
      if (covering.length === 0) {
        box.appendChild(document.createTextNode(piece));
      } else {
        var worst = covering.some(function (i) { return evidence[i].level === "high"; }) ? "high" : "medium";
        var m = el("mark", "hl " + worst, piece);
        marks.push(m);
        box.appendChild(m);
      }
      (badgeAt[b] || []).forEach(function (n) {
        var badge = el("span", "num " + evidence[n - 1].level, String(n));
        badge.setAttribute("aria-hidden", "true");
        marks.push(badge);          // numbers appear together with the highlights
        box.appendChild(badge);
      });
    }
    return { node: box, marks: marks };
  }

  // ---------------------------------------------------------------------
  // The answer: verdict card (owl + big word + risk bar), reasons, advice
  // ---------------------------------------------------------------------
  function risk(level) {
    var on = { okay: 1, careful: 2, scam: 3 }[level];
    var r = el("div", "risk");
    r.setAttribute("role", "img");
    r.setAttribute("aria-label", RISK_LABEL[level]);
    var bar = el("div", "risk-bar");
    for (var i = 1; i <= 3; i++) bar.appendChild(el("i", i <= on ? "on" : ""));
    r.appendChild(bar);
    r.appendChild(el("p", "risk-label", RISK_LABEL[level]));
    return r;
  }

  function verdict(result) {
    var v = el("section", "verdict-card v-" + result.level);
    v.setAttribute("role", "status");
    v.tabIndex = -1;

    var top = el("div", "verdict");
    var avatar = el("div", "v-owl");
    avatar.appendChild(owl(result.level));
    top.appendChild(avatar);
    var words = el("div", "v-words");
    words.appendChild(el("h2", "v-title", result.title));
    words.appendChild(el("p", "v-line", VERDICT_LINE[result.level]));
    top.appendChild(words);
    v.appendChild(top);
    v.appendChild(risk(result.level));
    return v;
  }

  function reasons(result) {
    var sec = el("section", "reasons");
    if (result.evidence.length === 0) {
      sec.appendChild(el("h3", "sec", "What we found"));
      var none = el("ul", "group");
      var li = el("li", "row-static");
      li.appendChild(icon("check", "ok-ico"));
      li.appendChild(el("p", "row-text", result.reasons[0]));
      none.appendChild(li);
      sec.appendChild(none);
      return sec;
    }
    var n = result.evidence.length;
    sec.appendChild(el("h3", "sec", n === 1 ? "What caught our eye" : "What caught our eye (" + n + ")"));
    var list = el("ol", "group");
    result.evidence.forEach(function (e, i) {
      var li = el("li", "row-static " + e.level);
      li.appendChild(el("span", "num " + e.level, String(i + 1)));
      var p = el("p", "row-text");
      var sr = el("span", "sr", SEVERITY[e.level] + ". ");
      p.appendChild(sr);
      p.appendChild(document.createTextNode(e.text));
      li.appendChild(p);
      list.appendChild(li);
    });
    sec.appendChild(list);
    return sec;
  }

  // "What should I do now?" -- a closed-by-default list, only for scam / careful
  function steps(result) {
    var list = STEPS[result.level];
    if (!list) return null;
    var d = el("details", "steps");
    var sum = el("summary");
    var ico = el("span", "steps-ico"); ico.appendChild(icon("steps"));
    sum.appendChild(ico);
    sum.appendChild(el("span", "steps-label", "What should I do now?"));
    sum.appendChild(icon("down", "steps-chev"));
    d.appendChild(sum);
    var ul = el("ul", "steps-list");
    list.forEach(function (t) { ul.appendChild(el("li", null, t)); });
    d.appendChild(ul);
    return d;
  }

  // A short note a person can paste into a text or email to a family member
  function familyNote(result) {
    var lines = ["I checked a message with " + APP_NAME + " and it says: " + result.title + ".", ""];
    if (result.evidence.length) {
      lines.push("Why:");
      result.evidence.forEach(function (e, i) { lines.push((i + 1) + ". " + e.text); });
      lines.push("");
    }
    var msg = result.text.length > 400 ? result.text.slice(0, 400) + "\u2026" : result.text;
    lines.push("The message:", "\u201C" + msg + "\u201D", "", "Can you take a look with me before I click or pay anything?");
    return lines.join("\n");
  }

  function advice(result) {
    var a = el("div", "advice");
    a.appendChild(icon("people", "advice-ico"));
    a.appendChild(el("p", "advice-text", result.footer));
    return a;
  }

  return {
    APP_NAME: APP_NAME,
    el: el, icon: icon, owl: owl,
    annotate: annotate, verdict: verdict, reasons: reasons, advice: advice, steps: steps, familyNote: familyNote
  };
})();
