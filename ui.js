/*
 * ui.js — draws a result on the screen. Used by BOTH the toolbar popup
 * and the right-click results window, so they always look the same.
 *
 * It only does display work. All the thinking is in rules.js.
 *
 * Safety note: we use textContent (never innerHTML) so that nothing inside a
 * scammer's message can ever run as code on our page.
 */
const ScamUI = {
  // Fill `container` with one card: the big colored answer, the reasons,
  // and the family-member advice.
  showResult(container, result) {
    container.textContent = ""; // clear anything old

    const card = document.createElement("div");
    card.className = "card";

    // 1) Big headline:  🔴 Likely scam
    const headline = document.createElement("div");
    headline.className = "headline " + result.level;
    headline.textContent = result.emoji + " " + result.title;
    card.appendChild(headline);

    const body = document.createElement("div");
    body.className = "card-body";

    // 2) "Why?" list, one sentence per red flag
    const heading = document.createElement("h2");
    heading.textContent = result.level === "okay" ? "What we found:" : "Why:";
    body.appendChild(heading);

    const list = document.createElement("ul");
    result.reasons.forEach((reason) => {
      const item = document.createElement("li");
      item.textContent = reason;
      list.appendChild(item);
    });
    body.appendChild(list);

    // 3) Always end with the same advice
    const footer = document.createElement("p");
    footer.className = "footer";
    footer.textContent = result.footer;
    body.appendChild(footer);

    card.appendChild(body);
    container.appendChild(card);
  }
};
