/*
 * app.js — what happens when someone uses Scam Spotter. The toolbar popup, the
 * right-click window, and the web version all run THIS file, so they always
 * behave the same.
 *
 * The journey:
 *   1. HOME    – a clear question, one big box to paste into, and three examples.
 *   2. CHECK   – the owl reads the message for a moment while the warning signs
 *                light up inside it, one by one.
 *   3. ANSWER  – one big verdict with the owl's reaction and a risk bar, the numbered
 *                reasons that match the highlights, and the family-member advice.
 *                "Check another" takes you back to the start.
 *
 * (rules.js decides; ui.js draws the pieces; this file connects them.)
 */
const ScamApp = (function () {
  "use strict";

  var el = ScamUI.el;
  var counter = 0;

  var EXAMPLES = [
    { icon: "box",  label: "Delivery text", text: "USPS: Your package is on hold. Pay a $2.99 redelivery fee at usps-redelivery.top/x" },
    { icon: "link", label: "Look-alike link", text: "https://paypa1.com/login" },
    { icon: "chat", label: "Normal text", text: "Hey, dinner at 6?" }
  ];

  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Build the screen inside `root`. options: { initialText, realLink, autofocus, markSrc }
  function mount(root, options) {
    options = options || {};
    var uid = "scam-input-" + (++counter);
    var timers = [];
    root.textContent = "";

    // ---------- the skeleton ----------
    var app = el("div", "app state-home");

    var top = el("header", "topbar");
    var brand = el("div", "brand");
    var mark = el("img", "brand-mark"); mark.src = options.markSrc || markSrc(); mark.alt = "";
    brand.appendChild(mark);
    brand.appendChild(el("span", "brand-name", ScamUI.APP_NAME));
    top.appendChild(brand);
    // The larger-text switch. Remembered for next time.
    var textBtn = el("button", "text-btn"); textBtn.type = "button";
    textBtn.setAttribute("aria-label", "Larger text");
    textBtn.textContent = "Aa";
    function setLarge(on, save) {
      document.documentElement.classList.toggle("large", on);
      textBtn.setAttribute("aria-pressed", String(on));
      if (save) { try { localStorage.setItem("scamspotter-large", on ? "1" : "0"); } catch (e) { /* fine: just not remembered */ } }
    }
    var wasLarge = false;
    try { wasLarge = localStorage.getItem("scamspotter-large") === "1"; } catch (e) { /* ignore */ }
    setLarge(wasLarge, false);
    textBtn.addEventListener("click", function () { setLarge(!document.documentElement.classList.contains("large"), true); });
    top.appendChild(textBtn);
    app.appendChild(top);

    var page = el("main", "page");

    // --- home ---
    var homeView = el("section", "view view-home");
    var intro = el("div", "intro");
    var copy = el("div", "intro-copy");
    copy.appendChild(el("h1", "title", "Is this a scam?"));
    copy.appendChild(el("p", "intro-sub", "Paste a message or link and I’ll check it for warning signs."));
    intro.appendChild(copy);
    var introOwl = el("div", "intro-owl"); introOwl.appendChild(ScamUI.owl("idle"));
    intro.appendChild(introOwl);
    homeView.appendChild(intro);

    var composer = el("div", "composer");
    var label = el("label", "sr", "Message or link to check"); label.setAttribute("for", uid);
    var input = el("textarea", "field"); input.id = uid; input.rows = 4;
    input.placeholder = "Paste a message or link here";
    var checkBtn = el("button", "btn primary", "Check it"); checkBtn.type = "button";
    checkBtn.appendChild(ScamUI.icon("arrow", "btn-ico"));
    composer.appendChild(label); composer.appendChild(input); composer.appendChild(checkBtn);
    homeView.appendChild(composer);
    var nudge = el("p", "nudge"); nudge.hidden = true;
    homeView.appendChild(nudge);

    var ex = el("section", "examples");
    ex.appendChild(el("h2", "sec", "Not sure? Try one"));
    var tiles = el("div", "tiles");
    EXAMPLES.forEach(function (e) {
      var tile = el("button", "tile"); tile.type = "button";
      var ico = el("span", "tile-ico"); ico.appendChild(ScamUI.icon(e.icon));
      tile.appendChild(ico);
      tile.appendChild(el("span", "tile-label", e.label));
      tile.addEventListener("click", function () { input.value = e.text; run(e.text); });
      tiles.appendChild(tile);
    });
    ex.appendChild(tiles);
    homeView.appendChild(ex);

    // --- result (filled in by run) ---
    var resultView = el("section", "view view-result");
    resultView.hidden = true;

    page.appendChild(homeView);
    page.appendChild(resultView);
    var privacy = el("p", "privacy");
    privacy.appendChild(ScamUI.icon("lock", "privacy-ico"));
    privacy.appendChild(el("span", null, "Private: nothing leaves your device."));
    page.appendChild(privacy);
    app.appendChild(page);
    root.appendChild(app);

    // ---------- helpers ----------
    function later(fn, ms) { var t = setTimeout(fn, reduceMotion ? 0 : ms); timers.push(t); return t; }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function setState(name) { app.className = "app state-" + name; }

    function showHome() {
      clearTimers();
      resultView.hidden = true; resultView.textContent = "";
      homeView.hidden = false;
      setState("home");
      input.value = "";
      nudge.hidden = true;
      window.scrollTo(0, 0);
      if (options.autofocus !== false) input.focus();
    }

    // ---------- the check itself ----------
    function run(rawText, extra) {
      var text = String(rawText || "").trim();
      if (!text) {
        nudge.textContent = "Paste a message or link first, then press Check.";
        nudge.hidden = false;
        input.focus();
        return;
      }
      nudge.hidden = true;
      clearTimers();

      var result = ScamRules.checkText(text, extra);
      var ann = ScamUI.annotate(result.text, result.evidence);

      // Build the result view once. Pieces stay hidden until their moment.
      resultView.textContent = "";

      var status = el("div", "scan-status");
      var statusOwl = el("div", "scan-owl"); statusOwl.appendChild(ScamUI.owl("scan"));
      var statusText = el("div", "scan-text");
      statusText.appendChild(el("h2", "scan-title", "Checking your message…"));
      statusText.appendChild(el("p", "scan-sub", "Looking for common warning signs"));
      status.appendChild(statusOwl); status.appendChild(statusText);

      var verdictSlot = el("div", "reveal slot-verdict");
      var verdictInner = el("div", "reveal-inner");
      verdictInner.appendChild(ScamUI.verdict(result));
      verdictSlot.appendChild(verdictInner);

      var msgCard = el("section", "msg-card scanning");
      msgCard.appendChild(el("h3", "msg-label", "Your message"));
      var msgBody = el("div", "msg-body");
      msgBody.appendChild(ann.node);
      if (result.text.length < text.length) msgBody.appendChild(el("p", "msg-note", "Only the first " + result.text.length.toLocaleString() + " characters were checked."));
      msgBody.appendChild(el("div", "scanbar"));
      msgCard.appendChild(msgBody);

      var restSlot = el("div", "reveal slot-rest");
      var restInner = el("div", "reveal-inner");
      restInner.appendChild(ScamUI.reasons(result));
      restInner.appendChild(ScamUI.advice(result));
      var stepsBox = ScamUI.steps(result);
      if (stepsBox) restInner.appendChild(stepsBox);
      var again = el("button", "btn primary again", "Check another"); again.type = "button";
      again.appendChild(ScamUI.icon("arrow", "btn-ico"));
      again.addEventListener("click", showHome);
      restInner.appendChild(again);
      var copyBtn = el("button", "btn quiet copy", ""); copyBtn.type = "button";
      var copyIco = ScamUI.icon("copy", "btn-ico"); var copyLabel = el("span", null, "Copy a note for family");
      copyBtn.appendChild(copyIco); copyBtn.appendChild(copyLabel);
      copyBtn.addEventListener("click", function () {
        copyText(ScamUI.familyNote(result), function (ok) {
          copyLabel.textContent = ok ? "Copied. Paste it into a message." : "Couldn\u2019t copy. Try selecting the text instead.";
          setTimeout(function () { copyLabel.textContent = "Copy a note for family"; }, 3500);
        });
      });
      restInner.appendChild(copyBtn);
      restSlot.appendChild(restInner);

      resultView.appendChild(status);
      resultView.appendChild(verdictSlot);
      resultView.appendChild(msgCard);
      resultView.appendChild(restSlot);

      homeView.hidden = true;
      resultView.hidden = false;
      setState("scan");
      window.scrollTo(0, 0);

      // Finish early if someone taps the message while it is still being read.
      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        clearTimers();
        ann.marks.forEach(function (m) { m.classList.add("on"); });
        msgCard.classList.remove("scanning");
        status.hidden = true;
        verdictSlot.classList.add("show");
        restSlot.classList.add("show");
        setState("result");
        var v = verdictSlot.querySelector(".verdict-card");
        if (v) v.focus({ preventScroll: true });
      }
      msgCard.addEventListener("click", function () { if (!finished) finish(); });

      if (reduceMotion) { finish(); return; }

      // Light up the highlights one by one, then reveal the verdict.
      var gap = ann.marks.length ? Math.max(90, Math.min(240, 1100 / ann.marks.length)) : 0;
      ann.marks.forEach(function (m, i) { later(function () { m.classList.add("on"); }, 750 + i * gap); });
      later(finish, 750 + ann.marks.length * gap + 380);
    }

    // ---------- events ----------
    checkBtn.addEventListener("click", function () { run(input.value); });
    input.addEventListener("keydown", function (e) {
      // Enter checks; Shift+Enter starts a new line.
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(input.value); }
    });

    // ---------- start ----------
    if (options.initialText) { input.value = options.initialText; run(options.initialText, { realLink: options.realLink }); }
    else if (options.autofocus !== false) input.focus();

    return { run: run, home: showHome, root: app };
  }

  // Copy to the clipboard (works from a button press; falls back for older setups)
  function copyText(text, done) {
    function fallback() {
      try {
        var t = document.createElement("textarea");
        t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
        document.body.appendChild(t); t.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(t);
        done(ok);
      } catch (e) { done(false); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    else fallback();
  }

  // The small mark next to the name. (Path is relative to whichever page loads us.)
  function markSrc() {
    return (document.body && document.body.dataset.root || "") + "icons/icon48.png";
  }

  // ---------- start automatically on the real pages ----------
  function autoStart() {
    var root = document.getElementById("app");
    if (!root || window.SCAM_NO_AUTOSTART) return;
    document.title = ScamUI.APP_NAME;
    var params = new URLSearchParams(location.search);
    var fromLink = params.get("text");        // the right-click window passes the text this way
    var real = params.get("real");            // and the link's true address, if there was one
    mount(root, { initialText: fromLink ? fromLink.trim() : "", realLink: real || "" });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoStart);
  else autoStart();

  return { mount: mount };
})();
