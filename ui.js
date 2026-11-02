/*
 * ui.js — the "pieces" of the screen: the owl mascot, the highlighted message,
 * the verdict, the meter, the reasons list, and the advice box.
 *
 * It only draws things. All the thinking is in rules.js, and the flow (what
 * happens when you press Check) is in app.js.
 *
 * Safety note: messages are always put on the page with textContent (never
 * innerHTML), so nothing inside a scammer's message can ever run as code.
 * The only innerHTML below is our OWN drawings (the owl and a few icons).
 *
 * To rename the app, change APP_NAME here (and "name" in manifest.json).
 */
const ScamUI = (function () {
  "use strict";

  var APP_NAME = "Scam Spotter";

  // One friendly line under each verdict. (We never say "safe": the best answer
  // is "Looks okay", and the okay line says plainly that it is not a promise.)
  var VERDICT_LINE = {
    scam: "Please don't click, call, or pay.",
    careful: "Slow down and double-check before you do anything.",
    okay: "Nothing stood out to us. That isn't a promise, so stay alert."
  };

  var LEVEL_WORD = { high: "Serious", medium: "Heads up" };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------------------------------------------------------------------
  // Little drawn icons (no emoji anywhere)
  // ---------------------------------------------------------------------
  var ICONS = {
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="3" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    people: '<svg viewBox="0 0 32 24" aria-hidden="true"><circle cx="11" cy="7" r="4.5" fill="currentColor"/><path d="M2.5 21c0-5 3.6-8 8.5-8s8.5 3 8.5 8z" fill="currentColor"/><circle cx="23" cy="9" r="3.6" fill="currentColor" opacity=".7"/><path d="M19 14.2c4.8-1.2 10 1 10 6.8h-7.6c0-2.9-.9-5-2.4-6.8z" fill="currentColor" opacity=".7"/></svg>',
    tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M6.8 12.4l3.6 3.6 7-7.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6.5L18.5 12 13 17.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function icon(name, cls) {
    var s = el("span", "ico " + (cls || ""));
    s.innerHTML = ICONS[name];
    return s;
  }

  // ---------------------------------------------------------------------
  // The owl. One owl, five moods:
  //   idle    – attentive, waiting for you to paste something
  //   scan    – reading the message (its eyes move side to side)
  //   scam    – alarmed, wings up
  //   careful – head tilt, one eyebrow raised
  //   okay    – happy eyes and a wave
  // ---------------------------------------------------------------------
  function owlMarkup(mood) {
    // Black outline on white, like the cartoon scammers: a chubby round owl with one
    // giant eye (magnified by its glass), tiny feet, and a face for every mood.
    var K = "#111111", W = "#ffffff";
    function ln(w) { return ' stroke="' + K + '" stroke-width="' + (w || 8) + '" stroke-linejoin="round" stroke-linecap="round"'; }
    var scam = mood === "scam", careful = mood === "careful", okay = mood === "okay", scan = mood === "scan";
    var s = '<svg viewBox="-70 -40 440 400" aria-hidden="true">';

    // tiny stubby feet and ear tufts (behind the body)
    s += '<ellipse cx="108" cy="338" rx="26" ry="12" fill="' + W + '"' + ln(7) + '/><ellipse cx="192" cy="338" rx="26" ry="12" fill="' + W + '"' + ln(7) + '/>';
    s += '<path d="M92 341 v9 M108 343 v9 M124 341 v9 M176 341 v9 M192 343 v9 M208 341 v9" fill="none"' + ln(6) + '/>';
    s += '<path d="M90 90 L66 30 L136 66 Z" fill="' + W + '"' + ln() + '/><path d="M210 90 L234 30 L164 66 Z" fill="' + W + '"' + ln() + '/>';

    // the big round body, with a belly and a few feather scallops
    s += '<path d="M150 52 C240 52 298 122 298 208 C298 290 246 332 150 332 C54 332 2 290 2 208 C2 122 60 52 150 52 Z" fill="' + W + '"' + ln(9) + '/>';
    s += '<path d="M84 254 Q150 314 216 254" fill="none"' + ln(7) + '/><path d="M124 272 q9 11 18 0 M158 272 q9 11 18 0 M141 292 q9 11 18 0" fill="none"' + ln(6) + '/>';

    // stubby wings: down, both raised (alarm), or one waving (okay)
    var wl = scam ? ' transform="rotate(118 40 190)"' : (okay ? ' transform="rotate(135 40 190)"' : "");
    var wr = scam ? ' transform="rotate(-118 260 190)"' : "";
    s += '<ellipse cx="34" cy="244" rx="28" ry="56" fill="' + W + '"' + ln() + wl + '/>';
    s += '<ellipse cx="266" cy="244" rx="28" ry="56" fill="' + W + '"' + ln() + wr + '/>';

    // a stray curl of feather
    s += '<path d="M150 52 Q146 24 168 26 Q188 30 178 46 Q172 56 160 48" fill="none"' + ln(7) + '/>';

    // ---- the face (tilts when unsure) ----
    s += '<g transform="rotate(' + (careful ? -8 : 0) + ' 150 170)">';
    if (okay) {
      // happy closed eyes
      s += '<path d="M72 138 Q104 98 136 138" fill="none"' + ln(10) + '/><path d="M158 132 Q200 80 242 132" fill="none"' + ln(10) + '/>';
      s += '<circle cx="62" cy="176" r="13" fill="none"' + ln(6) + '/><circle cx="238" cy="176" r="13" fill="none"' + ln(6) + '/>';
    } else {
      s += '<circle cx="104" cy="132" r="32" fill="' + W + '"' + ln(7) + '/><circle cx="200" cy="126" r="48" fill="' + W + '"' + ln(7) + '/>';
      var lx = 108, ly = 128, rx = 206, ry = 132, lr = 13, rr = 22;        // a lazy, slightly cross-eyed stare
      if (scam) { lx = 104; ly = 132; rx = 200; ry = 126; lr = 7; rr = 9; }  // tiny shocked pupils
      if (careful) { lx = 118; ly = 138; rx = 218; ry = 138; }              // side-eye
      s += '<g class="pupils"><circle cx="' + lx + '" cy="' + ly + '" r="' + lr + '" fill="' + K + '"/><circle cx="' + rx + '" cy="' + ry + '" r="' + rr + '" fill="' + K + '"/>';
      s += '<circle cx="' + (lx - 4) + '" cy="' + (ly - 5) + '" r="4" fill="' + W + '"/><circle cx="' + (rx - 7) + '" cy="' + (ry - 8) + '" r="6" fill="' + W + '"/></g>';
      if (scam) s += '<path d="M64 88 L128 108" fill="none"' + ln(10) + '/><path d="M268 58 L192 78" fill="none"' + ln(10) + '/>';
      if (careful) s += '<path d="M66 86 Q104 58 142 82" fill="none"' + ln(9) + '/>';
    }

    // beak and mouth
    if (scam) {
      s += '<path d="M130 164 L170 164 L150 212 Z" fill="' + K + '"' + ln(7) + '/><path d="M138 166 L162 166 L150 184 Z" fill="' + W + '"/>';
    } else if (okay) {
      s += '<path d="M138 166 L162 166 L150 190 Z" fill="' + W + '"' + ln(7) + '/><path d="M108 198 Q150 244 192 198" fill="none"' + ln(8) + '/>';
    } else if (careful) {
      s += '<path d="M140 168 L162 168 L154 190 Z" fill="' + W + '"' + ln(7) + '/><path d="M112 210 q10 -9 20 0 t20 0 t20 0 t20 0" fill="none"' + ln(6) + '/>';
    } else {
      s += '<path d="M138 166 L162 166 L150 192 Z" fill="' + W + '"' + ln(7) + '/>';
    }

    // the magnifying glass over the giant eye
    s += '<path d="M240 168 L278 208" fill="none" stroke="' + K + '" stroke-width="20" stroke-linecap="round"/><path d="M240 168 L278 208" fill="none" stroke="' + W + '" stroke-width="8" stroke-linecap="round"/>';
    s += '<circle cx="200" cy="126" r="58" fill="' + W + '" fill-opacity=".2" stroke="' + K + '" stroke-width="11"/>';
    s += '<path d="M158 96 q8 -12 22 -14 M150 112 q2 -6 6 -10" fill="none"' + ln(6) + '/>';
    s += '</g>';
    if (!scam && !okay) s += '<ellipse cx="284" cy="214" rx="22" ry="17" fill="' + W + '"' + ln(7) + ' transform="rotate(40 284 214)"/>';   // the wing gripping the handle

    // marks that show the mood
    var drop = function (x, y) { return '<path d="M' + x + ' ' + y + ' Q' + (x + 18) + ' ' + (y + 30) + ' ' + x + ' ' + (y + 46) + ' Q' + (x - 18) + ' ' + (y + 30) + ' ' + x + ' ' + y + ' Z" fill="' + W + '"' + ln(6) + '/>'; };
    var bang = function (x) { return '<rect x="' + (x - 10) + '" y="-30" width="20" height="38" rx="9" fill="' + K + '"/><circle cx="' + x + '" cy="30" r="10" fill="' + K + '"/>'; };
    if (scam) {
      s += bang(-34) + bang(334);
      s += '<path d="M36 52 L14 34 M54 28 L42 4 M264 28 L276 4 M284 52 L306 34" fill="none"' + ln(7) + '/>';
    }
    if (careful) {
      s += drop(318, 120);
      s += '<g transform="translate(306 -14)"><path d="M0 24 Q0 -6 26 -6 Q52 -6 52 18 Q52 36 30 44 Q26 48 26 62" fill="none"' + ln(14) + '/><circle cx="26" cy="86" r="11" fill="' + K + '"/></g>';
    }
    if (okay) {
      var star = function (x, y, r) { return '<path d="M' + x + ' ' + (y - r) + ' Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y + r) + ' Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + ' Z" fill="' + K + '"/>'; };
      s += star(-22, 40, 26) + star(322, 4, 20) + star(342, 96, 13);
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
  // Each reason gets a number; the number sits right after its first
  // highlighted phrase, so the list below can say "this is what number 2 means".
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
        var evLevel = evidence[n - 1].level;
        var badge = el("span", "num " + evLevel, String(n));
        badge.setAttribute("aria-hidden", "true");
        badge.dataset.late = "1";           // numbers appear together with the highlights
        marks.push(badge);
        box.appendChild(badge);
      });
    }
    return { node: box, marks: marks };
  }

  // ---------------------------------------------------------------------
  // The answer: verdict + 3-step meter + reasons + advice
  // ---------------------------------------------------------------------
  function verdict(result) {
    var v = el("section", "verdict v-" + result.level);
    v.setAttribute("role", "status");
    v.tabIndex = -1;

    var avatar = el("div", "v-owl");
    avatar.appendChild(owl(result.level));
    v.appendChild(avatar);

    var words = el("div", "v-words");
    words.appendChild(el("p", "v-kicker", "Our take"));
    words.appendChild(el("h2", "v-title", result.title));
    words.appendChild(el("p", "v-line", VERDICT_LINE[result.level]));
    v.appendChild(words);
    return v;
  }

  function meter(level) {
    var m = el("div", "meter");
    m.setAttribute("role", "img");
    m.setAttribute("aria-label", "Meter: " + { okay: "Looks okay", careful: "Be careful", scam: "Likely scam" }[level]);
    [["okay", "Okay"], ["careful", "Careful"], ["scam", "Scam"]].forEach(function (s) {
      m.appendChild(el("span", "seg seg-" + s[0] + (s[0] === level ? " on" : ""), s[1]));
    });
    return m;
  }

  function reasons(result) {
    var sec = el("section", "reasons");
    if (result.evidence.length === 0) {
      sec.appendChild(el("h3", "sec", "What we found"));
      var none = el("div", "ev none");
      none.appendChild(icon("tick", "ev-ico"));
      none.appendChild(el("p", "ev-text", result.reasons[0]));
      sec.appendChild(none);
      return sec;
    }
    var n = result.evidence.length;
    sec.appendChild(el("h3", "sec", n === 1 ? "What caught our eye" : "What caught our eye (" + n + ")"));
    var list = el("ol", "evidence");
    result.evidence.forEach(function (e, i) {
      var li = el("li", "ev " + e.level);
      li.appendChild(el("span", "num " + e.level, String(i + 1)));
      var body = el("div", "ev-body");
      body.appendChild(el("p", "ev-text", e.text));
      body.appendChild(el("span", "chip " + e.level, LEVEL_WORD[e.level]));
      li.appendChild(body);
      list.appendChild(li);
    });
    sec.appendChild(list);
    return sec;
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
    annotate: annotate, verdict: verdict, meter: meter, reasons: reasons, advice: advice
  };
})();
