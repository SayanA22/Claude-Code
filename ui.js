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
    var O = { ink: "#0b1b33", navy: "#0a3f73", body: "#dbe6f3", wing: "#b9cde4", belly: "#f6f9fc", beak: "#ffb300" };
    function o(w) { return ' stroke="' + O.ink + '" stroke-width="' + (w || 7) + '" stroke-linejoin="round" stroke-linecap="round"'; }
    var tilt = mood === "careful" ? -9 : 0;
    var s = '<svg viewBox="-70 -40 440 400" aria-hidden="true">';

    // feet, body, belly feathers
    s += '<g stroke="' + O.beak + '" stroke-width="9" stroke-linecap="round" fill="none"><path d="M118 306 l-12 16 M118 306 v18 M118 306 l12 16"/><path d="M182 306 l-12 16 M182 306 v18 M182 306 l12 16"/></g>';
    s += '<ellipse cx="150" cy="208" rx="96" ry="108" fill="' + O.body + '"' + o(8) + '/><ellipse cx="150" cy="232" rx="62" ry="74" fill="' + O.belly + '"/>';
    s += '<g fill="none" stroke="' + O.navy + '" stroke-width="5" stroke-linecap="round" opacity=".55"><path d="M118 214 q16 14 32 0 q16 14 32 0"/><path d="M112 244 q19 16 38 0 q19 16 38 0"/><path d="M122 274 q14 12 28 0 q14 12 28 0"/></g>';

    // wings: down, raised (alarm), or waving (okay)
    var la = mood === "scam" ? 100 : 0;
    var ra = mood === "scam" ? -100 : (mood === "okay" ? -125 : 0);
    s += '<path d="M70 186 Q16 236 54 304 Q90 272 98 224 Z" fill="' + O.wing + '"' + o() + ' transform="rotate(' + la + ' 74 196)"/>';
    s += '<path d="M230 186 Q284 236 246 304 Q210 272 202 224 Z" fill="' + O.wing + '"' + o() + ' transform="rotate(' + ra + ' 226 196)"/>';

    // head (tilts when unsure)
    s += '<g transform="rotate(' + tilt + ' 150 130)">';
    s += '<path d="M66 112 L84 42 L130 84 Z" fill="' + O.body + '"' + o() + '/><path d="M234 112 L216 42 L170 84 Z" fill="' + O.body + '"' + o() + '/>';
    s += '<circle cx="150" cy="122" r="90" fill="' + O.body + '"' + o(8) + '/><ellipse cx="150" cy="128" rx="76" ry="62" fill="' + O.belly + '"/>';

    if (mood === "okay") {
      s += '<path d="M82 128 Q112 94 142 128" fill="none"' + o(9) + '/><path d="M158 128 Q188 94 218 128" fill="none"' + o(9) + '/>';
      s += '<circle cx="86" cy="152" r="11" fill="#f4a3a3" opacity=".7"/><circle cx="214" cy="152" r="11" fill="#f4a3a3" opacity=".7"/>';
    } else {
      s += '<circle cx="108" cy="122" r="38" fill="#fff"' + o(7) + '/><circle cx="192" cy="122" r="38" fill="#fff"' + o(7) + '/>';
      var r = mood === "scam" ? 9 : 14;
      var px = mood === "careful" ? 10 : 0;
      var py = mood === "careful" ? 4 : 0;
      s += '<g class="pupils"><circle cx="' + (108 + px) + '" cy="' + (122 + py) + '" r="' + r + '" fill="' + O.ink + '"/><circle cx="' + (192 + px) + '" cy="' + (122 + py) + '" r="' + r + '" fill="' + O.ink + '"/>';
      s += '<circle cx="' + (103 + px) + '" cy="' + (116 + py) + '" r="4.5" fill="#fff"/><circle cx="' + (187 + px) + '" cy="' + (116 + py) + '" r="4.5" fill="#fff"/></g>';
      if (mood === "scam") s += '<path d="M70 76 L132 94 M230 76 L168 94" stroke="' + O.ink + '" stroke-width="9" stroke-linecap="round"/>';
      if (mood === "careful") s += '<path d="M72 80 Q104 60 136 84" fill="none"' + o(8) + '/><path d="M164 88 L228 88" fill="none"' + o(8) + '/>';
    }
    s += '<path d="M135 146 L165 146 L150 176 Z" fill="' + O.beak + '"' + o(6) + '/>';

    // the magnifying glass over one eye: the owl's signature
    s += '<circle cx="192" cy="122" r="50" fill="#fff" fill-opacity=".18" stroke="' + O.navy + '" stroke-width="12"/>';
    s += '<path d="M228 158 L268 198" stroke="' + O.navy + '" stroke-width="16" stroke-linecap="round"/>';
    s += '<path d="M164 102 Q172 88 186 86" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".9"/>';
    s += '</g>';

    // little marks that show the mood
    if (mood === "scam") {
      s += '<g fill="#d50000"' + o(5) + '><rect x="138" y="-34" width="24" height="46" rx="10"/><circle cx="150" cy="30" r="13"/></g>';
      s += '<g stroke="#d50000" stroke-width="7" stroke-linecap="round"><path d="M40 40 l-22 -14 M52 14 l-12 -22 M260 40 l22 -14 M248 14 l12 -22"/></g>';
    }
    if (mood === "careful") {
      s += '<g transform="translate(244 6)"><path d="M0 18 Q0 -6 22 -6 Q44 -6 44 14 Q44 28 26 36 Q22 40 22 52" fill="none" stroke="' + O.ink + '" stroke-width="18" stroke-linecap="round"/><path d="M0 18 Q0 -6 22 -6 Q44 -6 44 14 Q44 28 26 36 Q22 40 22 52" fill="none" stroke="#ffb300" stroke-width="8" stroke-linecap="round"/><circle cx="22" cy="72" r="10" fill="#ffb300"' + o(4) + '/></g>';
    }
    if (mood === "okay") {
      var star = function (x, y, rr) { return '<path d="M' + x + ' ' + (y - rr) + ' Q' + x + ' ' + y + ' ' + (x + rr) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y + rr) + ' Q' + x + ' ' + y + ' ' + (x - rr) + ' ' + y + ' Q' + x + ' ' + y + ' ' + x + ' ' + (y - rr) + ' Z" fill="#7ed957"/>'; };
      s += star(36, 36, 24) + star(268, 20, 18) + star(284, 96, 12);
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
