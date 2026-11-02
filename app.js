/*
 * app.js — what happens when someone uses Scam Spotter. The toolbar popup, the
 * right-click window, and the web version all run THIS file, so they always
 * behave the same.
 *
 * The journey:
 *   1. HOME    – the owl asks you to paste something (or try an example).
 *   2. SCAN    – the owl "reads" your message for a moment and the warning
 *                signs light up inside it, one by one.
 *   3. RESULT  – the verdict, a 3-step meter, the numbered reasons that match
 *                the highlights, and the advice to ask a family member.
 *                "Check another" takes you back to the start.
 *
 * (rules.js decides; ui.js draws the pieces; this file connects them.)
 */
const ScamApp = (function () {
  "use strict";

  var el = ScamUI.el;
  var counter = 0;

  var EXAMPLES = [
    { label: "A delivery text", text: "USPS: Your package is on hold. Pay a $2.99 redelivery fee at usps-redelivery.top/x" },
    { label: "A link", text: "https://paypa1.com/login" },
    { label: "A normal text", text: "Hey, dinner at 6?" }
  ];

  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Build the screen inside `root`. options: { initialText, autofocus, markSrc }
  function mount(root, options) {
    options = options || {};
    var uid = "scam-input-" + (++counter);
    var timers = [];
    root.textContent = "";

    // ---------- the skeleton ----------
    var app = el("div", "app state-home");

    var hero = el("header", "hero");
    var brand = el("div", "brand");
    var mark = el("img", "brand-mark"); mark.src = options.markSrc || markSrc(); mark.alt = "";
    brand.appendChild(mark);
    brand.appendChild(el("span", "brand-name", ScamUI.APP_NAME));
    hero.appendChild(brand);
    var heroMain = el("div", "hero-main");
    var copy = el("div", "hero-copy");
    copy.appendChild(el("h1", "hero-title", "Got a message that feels off?"));
    copy.appendChild(el("p", "hero-sub", "Paste it below and I’ll take a look."));
    heroMain.appendChild(copy);
    var heroOwl = el("div", "hero-owl"); heroOwl.appendChild(ScamUI.owl("idle"));
    heroMain.appendChild(heroOwl);
    hero.appendChild(heroMain);
    app.appendChild(hero);

    var sheet = el("main", "sheet");
    var homeView = el("section", "view view-home");
    var label = el("label", "field-label", "Paste a message or link"); label.setAttribute("for", uid);
    var input = el("textarea", "field"); input.id = uid; input.rows = 4;
    input.placeholder = "Paste it here, then press Enter";
    var actions = el("div", "actions");
    var checkBtn = el("button", "btn primary", "Check it"); checkBtn.type = "button";
    actions.appendChild(checkBtn);
    var nudge = el("p", "nudge"); nudge.hidden = true;
    var exWrap = el("div", "examples");
    exWrap.appendChild(el("span", "ex-label", "Not sure? Try one:"));
    var exList = el("div", "ex-list");
    EXAMPLES.forEach(function (ex) {
      var chip = el("button", "chip-btn", ex.label); chip.type = "button";
      chip.addEventListener("click", function () { input.value = ex.text; run(ex.text); });
      exList.appendChild(chip);
    });
    exWrap.appendChild(exList);
    homeView.appendChild(label); homeView.appendChild(input); homeView.appendChild(nudge);
    homeView.appendChild(actions); homeView.appendChild(exWrap);

    var resultView = el("section", "view view-result");
    resultView.hidden = true;

    sheet.appendChild(homeView);
    sheet.appendChild(resultView);
    var privacy = el("p", "privacy");
    privacy.appendChild(ScamUI.icon("lock", "privacy-ico"));
    privacy.appendChild(el("span", null, "Private: nothing leaves your device."));
    sheet.appendChild(privacy);
    app.appendChild(sheet);
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
      if (options.autofocus !== false) input.focus();
    }

    // ---------- the check itself ----------
    function run(rawText) {
      var text = String(rawText || "").trim();
      if (!text) {
        nudge.textContent = "Paste a message or link first, then press Check.";
        nudge.hidden = false;
        input.focus();
        return;
      }
      nudge.hidden = true;
      clearTimers();

      var result = ScamRules.checkText(text);
      var ann = ScamUI.annotate(result.text, result.evidence);

      // Build the result view once. Pieces are hidden until their moment.
      resultView.textContent = "";
      var verdictSlot = el("div", "reveal slot-verdict");
      var verdictInner = el("div", "reveal-inner");
      verdictInner.appendChild(ScamUI.verdict(result));
      verdictInner.appendChild(ScamUI.meter(result.level));
      verdictSlot.appendChild(verdictInner);

      var msgCard = el("section", "msg-card scanning");
      var msgHead = el("div", "msg-head");
      var scanOwl = el("span", "scan-owl"); scanOwl.appendChild(ScamUI.owl("scan"));
      var msgLabel = el("span", "msg-label", "Reading it closely");
      var dots = el("span", "dots"); dots.setAttribute("aria-hidden", "true"); dots.textContent = "...";
      msgLabel.appendChild(dots);
      msgHead.appendChild(scanOwl); msgHead.appendChild(msgLabel);
      msgCard.appendChild(msgHead);
      var msgBody = el("div", "msg-body");
      msgBody.appendChild(ann.node);
      msgBody.appendChild(el("div", "scanbar"));
      msgCard.appendChild(msgBody);

      var restSlot = el("div", "reveal slot-rest");
      var restInner = el("div", "reveal-inner");
      restInner.appendChild(ScamUI.reasons(result));
      restInner.appendChild(ScamUI.advice(result));
      var again = el("button", "btn primary again", "Check another"); again.type = "button";
      again.addEventListener("click", showHome);
      restInner.appendChild(again);
      restSlot.appendChild(restInner);

      resultView.appendChild(verdictSlot);
      resultView.appendChild(msgCard);
      resultView.appendChild(restSlot);

      homeView.hidden = true;
      resultView.hidden = false;
      setState("scan");

      // Finish early if someone taps the message while it is still scanning.
      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        clearTimers();
        ann.marks.forEach(function (m) { m.classList.add("on"); });
        msgCard.classList.remove("scanning");
        msgLabel.textContent = "Your message";
        scanOwl.hidden = true;
        verdictSlot.classList.add("show");
        restSlot.classList.add("show");
        setState("result");
        var v = verdictSlot.querySelector(".verdict");
        if (v) v.focus({ preventScroll: true });
        verdictSlot.scrollIntoView({ block: "start" });
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
    if (options.initialText) { input.value = options.initialText; run(options.initialText); }
    else if (options.autofocus !== false) input.focus();

    return { run: run, home: showHome, root: app };
  }

  // The small shield icon next to the name. (Path is relative to whichever page loads us.)
  function markSrc() {
    return (document.body && document.body.dataset.root || "") + "icons/icon32.png";
  }

  // ---------- start automatically on the real pages ----------
  function autoStart() {
    var root = document.getElementById("app");
    if (!root || window.SCAM_NO_AUTOSTART) return;
    document.title = ScamUI.APP_NAME;
    var fromLink = new URLSearchParams(location.search).get("text");   // the right-click window passes the text this way
    mount(root, { initialText: fromLink ? fromLink.trim() : "" });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoStart);
  else autoStart();

  return { mount: mount };
})();
