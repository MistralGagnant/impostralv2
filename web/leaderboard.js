// Impostral leaderboard: fetch /leaderboard and rank the human players who
// entered a pseudo by games won, one board per ruleset. The AI models are
// ranked too by the same endpoint, but they belong to the model benchmark on
// /stats, so this page drops them and shows people only. Player names are
// free-form input and are only ever written with `textContent`.
(function () {
  "use strict";

  const pct = (x) => Math.round((Number(x) || 0) * 100) + "%";
  const players = (data) => (data?.entries || []).filter((e) => e.kind === "human");

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
      + (rank <= 3 && row.wins > 0 ? " is-podium" : ""));

    wrap.appendChild(el("div", "lb-rank", "#" + rank));

    const idBlock = el("div", "lb-id");
    idBlock.appendChild(el("div", "lb-name", row.name));
    const meta = el("div", "lb-id-meta");
    // No kind badge: every row on this board is a player.
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

  function heroTiles(data, entries) {
    const leader = entries[0];

    const tiles = [
      { num: String(data.total_games || 0), lbl: "Games recorded",
        hint: "Finished games played under this ruleset." },
      { num: String(entries.length), lbl: "Players ranked",
        hint: "Players who entered a pseudo under this ruleset." },
    ];
    // A "most wins: 0" tile says nothing; the board below already shows that
    // nobody has won yet.
    if (leader && leader.wins > 0) {
      tiles.push({
        num: String(leader.wins), lbl: "Most wins", sub: leader.name,
        hint: "Highest win count on this board.",
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
    // No "Kind" column: the board holds players and nothing else.
    for (const header of ["#", "Player", "Wins", "Games", "Win rate",
      "Survival", "Last played"]) {
      htr.appendChild(el("th", null, header));
    }
    thead.appendChild(htr);
    table.appendChild(thead);

    const tbody = el("tbody");
    entries.forEach((row, index) => {
      const tr = el("tr");
      const cells = [index + 1, row.name,
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
    // Land on the ruleset that actually has a board behind it — counting
    // players, since a ruleset ranked for AI models only shows nothing here.
    if (!players(modeView(payload, selectedMode)).length) {
      selectedMode = MODES.find((mode) => players(modeView(payload, mode)).length)
        || "standard";
    }
    render(payload);
  }

  function render(payload) {
    const content = document.getElementById("content");
    syncModeTabs();
    const data = modeView(payload, selectedMode) || { entries: [], total_games: 0 };
    const entries = players(data);
    content.textContent = "";

    if (!entries.length) {
      content.appendChild(stateCard(
        `No ${selectedMode} player ranked yet`,
        "Finish a game under this ruleset and every player who entered a "
        + "pseudo shows up here. The AI models are benchmarked on the stats "
        + "page instead."));
      content.appendChild(anonymousNote(data));
      return;
    }

    content.appendChild(heroTiles(data, entries));

    const topWins = entries[0].wins || 0;
    const board = el("div", "lb-board");
    entries.forEach((row, index) => {
      board.appendChild(rankedRow(row, index + 1, topWins));
    });
    content.appendChild(section("Ranking", board, "By games won"));

    content.appendChild(section("Full breakdown", detailsTable(entries),
      "Every player"));
    content.appendChild(anonymousNote(data));
  }

  function anonymousNote(data) {
    const anonymous = data.anonymous_appearances || 0;
    const meta = el("p", "lb-meta");
    meta.textContent =
      `${data.total_games || 0} ${selectedMode} ` +
      `game${data.total_games === 1 ? "" : "s"} recorded. ` +
      // The human win condition is the same under both rulesets; what differs
      // is who is hunting you, which is why the boards stay apart.
      "You win when the humans expose every AI, or when the last human and the "
      + "last AI share the final duel — players voted out earlier win with "
      + "their side. " +
      (selectedMode === "hardcore"
        ? "In hardcore, the AIs only win by sending a human home, so they are "
          + "hunting you. "
        : "In standard, an AI that votes a human out loses, so the AIs are "
          + "hunting each other. ") +
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
