/*
 * results.js — runs in the small window opened by the right-click menu.
 * background.js puts the text in the web address (?text=...). We read it,
 * check it with rules.js, and show the answer.
 */

const params = new URLSearchParams(window.location.search);
const text = (params.get("text") || "").trim();

const resultBox = document.getElementById("result");
const checkedBox = document.getElementById("checked");

if (text === "") {
  resultBox.textContent = "There was nothing to check.";
  resultBox.className = "nudge";
} else {
  ScamUI.showResult(resultBox, ScamRules.checkText(text));
  // Show what was checked (shortened if it's very long)
  checkedBox.textContent = text.length > 300 ? text.slice(0, 300) + "…" : text;
}

document.getElementById("close").addEventListener("click", () => window.close());
