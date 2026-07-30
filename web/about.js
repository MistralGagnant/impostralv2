// The four names are shuffled on every load: no position is a ranking, and
// nobody is first by default. The HTML order is only the no-JavaScript
// fallback.
(function () {
  "use strict";

  const board = document.querySelector(".ab-people");
  if (!board) return;

  const cards = [...board.children];
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  // `appendChild` moves an existing node, so this reorders in place.
  for (const card of cards) board.appendChild(card);
})();
