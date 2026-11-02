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
  // The owl. A round, friendly line-drawing in navy with a few warm accents.
  // It always wears its magnifying glass, which makes one eye comically big.
  // Five moods:
  //   idle    – attentive, waiting for you to paste something
  //   scan    – reading the message (its eyes sweep from side to side)
  //   scam    – alarmed: arms flung up, tiny pupils
  //   careful – head tilt, one eyebrow raised
  //   okay    – happy eyes and a wave
  // ---------------------------------------------------------------------
  function owlMarkup(mood) {
    var C = { line: "#0B2A4A", white: "#FFFFFF", tint: "#E3EDF9", scal: "#A9C2E3", beak: "#F5A524", cheek: "#FFC4BA", glass: "#D6E8FF" };
    function L(w) { return ' stroke="' + C.line + '" stroke-width="' + (w || 5) + '" stroke-linejoin="round" stroke-linecap="round"'; }
    var scam = mood === "scam", careful = mood === "careful", okay = mood === "okay";
    var s = '<svg viewBox="-34 -14 268 226" aria-hidden="true">';

    // feet and ear tufts sit behind the body
    s += '<ellipse cx="82" cy="193" rx="13" ry="7" fill="' + C.beak + '"' + L(4) + '/><ellipse cx="118" cy="193" rx="13" ry="7" fill="' + C.beak + '"' + L(4) + '/>';
    s += '<path d="M48 62 L36 24 L80 44 Z" fill="' + C.white + '"' + L() + '/><path d="M152 62 L164 24 L120 44 Z" fill="' + C.white + '"' + L() + '/>';

    // the round body, belly and a few feather scallops
    s += '<path d="M100 26 C154 26 186 66 186 114 C186 162 154 192 100 192 C46 192 14 162 14 114 C14 66 46 26 100 26 Z" fill="' + C.white + '"' + L(5.5) + '/>';
    s += '<ellipse cx="100" cy="152" rx="46" ry="31" fill="' + C.tint + '"/>';
    s += '<path d="M84 150 v10 M100 146 v14 M116 150 v10" fill="none" stroke="' + C.scal + '" stroke-width="4" stroke-linecap="round"/>';

    // stubby wings: down, both flung up (alarm), or the left one waving (okay)
    var wl = scam ? ' transform="rotate(122 26 112)"' : (okay ? ' transform="rotate(138 26 112)"' : "");
    var wr = scam ? ' transform="rotate(-122 174 112)"' : "";
    s += '<ellipse cx="22" cy="140" rx="13" ry="30" fill="' + C.white + '"' + L() + wl + '/>';
    s += '<ellipse cx="178" cy="140" rx="13" ry="30" fill="' + C.white + '"' + L() + wr + '/>';

    // a cheeky curl of feather
    s += '<path d="M100 27 q-4 -17 9 -17 q12 2 4 14" fill="none"' + L(4.5) + '/>';

    // ---- the face (tilts when unsure) ----
    s += '<g transform="rotate(' + (careful ? -7 : 0) + ' 100 100)">';
    if (okay) {
      s += '<path d="M46 98 Q68 74 90 98" fill="none"' + L(6) + '/><path d="M104 94 Q132 60 160 94" fill="none"' + L(6) + '/>';
      s += '<circle cx="42" cy="122" r="9" fill="' + C.cheek + '"/><circle cx="158" cy="122" r="9" fill="' + C.cheek + '"/>';
    } else {
      s += '<circle cx="68" cy="92" r="24" fill="' + C.white + '"' + L() + '/><circle cx="134" cy="90" r="28" fill="' + C.white + '"' + L() + '/>';
      var lx = 70, ly = 90, rx = 138, ry = 92, lr = 10, rr = 14;           // a lazy, slightly cross-eyed stare
      if (scam) { lx = 68; ly = 92; rx = 134; ry = 90; lr = 5.5; rr = 7; }  // tiny shocked pupils
      if (careful) { lx = 78; ly = 96; rx = 146; ry = 98; }                 // side-eye
      s += '<g class="pupils"><circle cx="' + lx + '" cy="' + ly + '" r="' + lr + '" fill="' + C.line + '"/><circle cx="' + rx + '" cy="' + ry + '" r="' + rr + '" fill="' + C.line + '"/>';
      s += '<circle cx="' + (lx - 3) + '" cy="' + (ly - 4) + '" r="3" fill="#fff"/><circle cx="' + (rx - 5) + '" cy="' + (ry - 6) + '" r="4.5" fill="#fff"/></g>';
      if (scam) s += '<path d="M42 66 L88 80" fill="none"' + L(7) + '/><path d="M178 52 L124 66" fill="none"' + L(7) + '/>';
      if (careful) s += '<path d="M44 66 Q68 48 94 64" fill="none"' + L(6) + '/>';
    }

    // the magnifying glass
    s += '<path d="M162 118 L188 146" fill="none" stroke="' + C.line + '" stroke-width="13" stroke-linecap="round"/>';
    s += '<circle cx="134" cy="90" r="38" fill="' + C.glass + '" fill-opacity=".28" stroke="' + C.line + '" stroke-width="7"/>';
    s += '<path d="M110 70 q7 -10 18 -12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".95"/>';
    // beak and mouth (drawn after the glass so it is never hidden)
    if (scam) {
      s += '<path d="M84 110 L112 110 L98 144 Z" fill="' + C.line + '"' + L(4) + '/><path d="M89 111 L107 111 L98 124 Z" fill="' + C.beak + '"/>';
    } else if (okay) {
      s += '<path d="M88 112 Q98 107 108 112 L98 130 Z" fill="' + C.beak + '"' + L(4) + '/><path d="M78 136 Q98 158 118 136" fill="none"' + L(5) + '/>';
    } else if (careful) {
      s += '<path d="M89 112 Q99 107 109 112 L101 130 Z" fill="' + C.beak + '"' + L(4) + '/><path d="M76 146 q7 -7 14 0 t14 0 t14 0" fill="none"' + L(4.5) + '/>';
    } else {
      s += '<path d="M88 112 Q98 107 108 112 L98 132 Z" fill="' + C.beak + '"' + L(4) + '/>';
    }

    s += '</g>';
    if (!scam) s += '<ellipse cx="192" cy="152" rx="15" ry="12" fill="' + C.white + '"' + L() + ' transform="rotate(42 192 152)"/>';   // the wing gripping the handle

    // marks that show the mood
    var bang = function (x) { return '<rect x="' + (x - 6) + '" y="2" width="12" height="28" rx="6" fill="' + C.line + '"/><circle cx="' + x + '" cy="42" r="6.5" fill="' + C.line + '"/>'; };
    if (scam) {
      s += bang(-18) + bang(218);
      s += '<path d="M22 44 L8 32 M36 22 L28 6 M178 22 L186 6 M192 44 L206 32" fill="none"' + L(5) + '/>';
    }
    if (careful) {
      s += '<g transform="translate(204 -6)"><path d="M0 16 Q0 -4 16 -4 Q32 -4 32 12 Q32 24 18 30 Q16 32 16 42" fill="none" stroke="' + C.line + '" stroke-width="9" stroke-linecap="round"/><circle cx="16" cy="60" r="6.5" fill="' + C.line + '"/></g>';
    }
    if (okay) {
      var star = function (x, y, r) { return '<path d="M' + x + ' ' + (y - r) + ' Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y + r) + ' Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + ' Z" fill="' + C.beak + '"/>'; };
      s += star(-16, 36, 18) + star(214, 8, 14) + star(226, 80, 9);
    }
    return s + '</svg>';
  }

  function owl(mood) {
    var s = el("span", "owl owl-" + mood);
    s.innerHTML = owlMarkup(mood);
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
