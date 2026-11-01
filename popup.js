/*
 * popup.js — makes the toolbar popup work.
 * When "Check" is pressed: read the text box, ask rules.js, show the answer.
 */

const input = document.getElementById("input");
const resultBox = document.getElementById("result");

document.getElementById("check").addEventListener("click", () => {
  const text = input.value.trim();

  // Nothing typed yet? Give a gentle nudge instead of a result.
  if (text === "") {
    resultBox.textContent = "Please paste a message or link first.";
    resultBox.className = "nudge";
    input.focus();
    return;
  }

  resultBox.className = "";
  ScamUI.showResult(resultBox, ScamRules.checkText(text));
});

document.getElementById("clear").addEventListener("click", () => {
  input.value = "";
  resultBox.textContent = "";
  resultBox.className = "";
  input.focus();
});

// Make it quick: the cursor starts in the box, and pressing Enter checks.
// (Shift+Enter still starts a new line.)
input.focus();
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    document.getElementById("check").click();
  }
});
