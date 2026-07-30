// Impostral leaderboard: fetch /leaderboard and rank every contestant by games
// won — human players who entered a pseudo, and each AI model — one board per
// ruleset. Player names are free-form input and are only ever written with
// `textContent`.
(function () {
  "use strict";

  const pct = (x) => Math.round((Number(x) || 0) * 100) + "%";
  const isHuman = (row) => row.kind === "human";

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  function shortDate(iso) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined,
      { year: "numeric", month: "short", day: "numeric" });
  }

  function rankedRow(row, rank, topWins) {
    const wrap = el("div", "lb-row"
      + (isHuman(row) ? " is-human" : "")
      + (rank <= 3 && row.wins > 0 ? " is-podium" : ""));

    wrap.appendChild(el("div", "lb-rank", "#" + rank));

    const idBlock = el("div", "lb-id");
    idBlock.appendChild(el("div", "lb-name", row.name));
    const meta = el("div", "lb-id-meta");
    meta.appendChild(el("span", "lb-kind" + (isHuman(row) ? " lb-kind-human" : ""),
      isHuman(row) ? "Human" : "Mistral model"));
    meta.appendChild(el("span", "lb-played",
      `${row.games} played · ${pct(row.win_rate)} win rate`));
    idBlock.appendChild(meta);
    wrap.appendChild(idBlock);

    const track = el("div", "lb-track");
    track.title = `${row.wins} of ${row.games} games won.`;
    const fill = el("div", "lb-fill");
    fill.style.width = (topWins ? (row.wins / topWins) * 100 : 0) + "%";
    track.appendChild(fill);
    wrap.appendChild(track);

    const wins = el("div", "lb-wins");
    wins.appendChild(el("span", "lb-wins-num", String(row.wins)));
    wins.appendChild(el("span", "lb-wins-lbl", row.wins === 1 ? "win" : "wins"));
    wrap.appendChild(wins);

    return wrap;
  }

  function heroTiles(data) {
    const entries = data.entries || [];
    const leader = entries[0];
    const topHuman = entries.find(isHuman);

    const tiles = [
      { num: String(data.total_games || 0), lbl: "Games recorded",
        hint: "Finished games played under this ruleset." },
      { num: String(entries.length), lbl: "Contestants ranked",
        sub: `${data.humans || 0} human · ${data.ai_models || 0} AI`,
        hint: "Named human players plus the AI models that took a seat." },
    ];
    if (leader) {
      tiles.push({
        num: String(leader.wins), lbl: "Most wins", sub: leader.name,
        hint: "Highest win count on this board.",
      });
    }
    if (topHuman) {
      tiles.push({
        num: String(topHuman.wins), lbl: "Best human", sub: topHuman.name,
        hint: "Highest win count among named human players.",
      });
    }

    const grid = el("div", "lb-hero");
    for (const tile of tiles) {
      const node = el("div", "lb-tile");
      node.title = tile.hint || "";
      node.appendChild(el("div", "lb-tile-num", tile.num));
      node.appendChild(el("div", "lb-tile-lbl", tile.lbl));
      if (tile.sub) {
        const sub = el("div", "lb-tile-sub", tile.sub);
        sub.title = tile.sub;
        node.appendChild(sub);
      }
      grid.appendChild(node);
    }
    return grid;
  }

  function detailsTable(entries) {
    const scroll = el("div", "lb-table-scroll");
    const table = el("table", "lb-table");

    const thead = el("thead");
    const htr = el("tr");
    for (const header of ["#", "Player", "Kind", "Wins", "Games", "Win rate",
      "Survival", "Last played"]) {
      htr.appendChild(el("th", null, header));
    }
    thead.appendChild(htr);
    table.appendChild(thead);

    const tbody = el("tbody");
    entries.forEach((row, index) => {
      const tr = el("tr", isHuman(row) ? "is-human" : null);
      const cells = [index + 1, row.name, isHuman(row) ? "Human" : "AI model",
        row.wins, row.games, pct(row.win_rate), pct(row.survival_rate),
        shortDate(row.last_played)];
      cells.forEach((cell, column) => {
        const td = el("td", null, String(cell));
        if (column === 1) td.className = "lb-cell-name";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);
    return scroll;
  }

  function section(title, node, kicker) {
    const sec = el("section", "lb-section");
    const head = el("div", "lb-section-head");
    head.appendChild(el("h2", "lb-section-title", title));
    if (kicker) head.appendChild(el("span", "lb-section-kicker", kicker));
    sec.appendChild(head);
    sec.appendChild(node);
    return sec;
  }

  function stateCard(title, body) {
    const wrap = el("div", "lb-empty");
    wrap.appendChild(el("div", "lb-empty-title", title));
    if (body) wrap.appendChild(el("p", "lb-empty-body", body));
    return wrap;
  }

  // The two rulesets are ranked side by side but never merged: a hardcore win
  // is survival whoever you sent home, a standard win is survival without
  // having sent a human home.
  const MODES = ["standard", "hardcore"];
  let selectedMode = "standard";
  let lastPayload = null;

  const modeTabs = document.getElementById("mode-tabs");
  const modeButtons = modeTabs
    ? [...modeTabs.querySelectorAll("[data-mode]")]
    : [];

  const modeView = (payload, mode) => payload?.modes?.[mode] || null;

  function syncModeTabs() {
    for (const button of modeButtons) {
      button.setAttribute("aria-selected",
        String(button.dataset.mode === selectedMode));
    }
  }

  for (const button of modeButtons) {
    button.addEventListener("click", () => {
      selectedMode = MODES.includes(button.dataset.mode)
        ? button.dataset.mode
        : "standard";
      if (lastPayload) render(lastPayload);
    });
  }

  async function load() {
    const content = document.getElementById("content");
    content.textContent = "";
    content.appendChild(stateCard("Loading…", "Reading the results log."));

    let payload;
    try {
      const res = await fetch("/leaderboard");
      if (!res.ok) throw new Error("bad status " + res.status);
      payload = await res.json();
    } catch (err) {
      content.textContent = "";
      content.appendChild(stateCard(
        "Could not load the leaderboard",
        "The results service did not respond. Try refreshing in a moment."));
      return;
    }

    lastPayload = payload;
    // Land on the ruleset that actually has a board behind it.
    if (!modeView(payload, selectedMode)?.entries?.length) {
      selectedMode = MODES.find((mode) => modeView(payload, mode)?.entries?.length)
        || "standard";
    }
    render(payload);
  }

  function render(payload) {
    const content = document.getElementById("content");
    syncModeTabs();
    const data = modeView(payload, selectedMode) || { entries: [], total_games: 0 };
    const entries = data.entries || [];
    content.textContent = "";

    if (!entries.length) {
      content.appendChild(stateCard(
        `No ${selectedMode} games ranked yet`,
        "Finish a game under this ruleset and every player who entered a "
        + "pseudo shows up here, next to the AI models they faced."));
      content.appendChild(anonymousNote(data));
      return;
    }

    content.appendChild(heroTiles(data));

    const topWins = entries[0].wins || 0;
    const board = el("div", "lb-board");
    entries.forEach((row, index) => {
      board.appendChild(rankedRow(row, index + 1, topWins));
    });
    content.appendChild(section("Ranking", board, "By games won"));

    content.appendChild(section("Full breakdown", detailsTable(entries),
      "Every contestant"));
    content.appendChild(anonymousNote(data));
  }

  function anonymousNote(data) {
    const anonymous = data.anonymous_appearances || 0;
    const meta = el("p", "lb-meta");
    meta.textContent =
      `${data.total_games || 0} ${selectedMode} ` +
      `game${data.total_games === 1 ? "" : "s"} recorded. ` +
      (selectedMode === "hardcore"
        ? "A hardcore win is surviving to the end, whoever you sent home. "
        : "A standard win means surviving to the end — and for an AI, without "
          + "having voted a human out. ") +
      "The pseudo is optional and unverified: seats played without one cannot "
      + "be told apart, so they are never ranked" +
      (anonymous
        ? `, and ${anonymous} anonymous seat${anonymous === 1 ? "" : "s"} ` +
          `(${data.anonymous_wins || 0} winning) ` +
          "are left out of this board."
        : ".");
    return meta;
  }

  const refresh = document.getElementById("refresh");
  if (refresh) refresh.addEventListener("click", load);
  load();
})();
