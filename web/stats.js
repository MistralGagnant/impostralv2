// Impostral model-performance dashboard: fetch /stats and render a HUD-style
// leaderboard comparing each AI model against the anonymous Humans baseline.
(function () {
  "use strict";

  const pct = (x) => Math.round((Number(x) || 0) * 100) + "%";
  const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));

  // The three compared measures. Order is fixed and never cycled. Colors are the
  // game's brand hues, validated for colorblind separation; every bar also
  // carries a text label and a printed value, so identity is never color-alone.
  const METRICS = [
    { key: "team_win_rate", label: "Win rate", cssVar: "--m-win",
      hint: "Share of appearances that ended in a win." },
    { key: "survival_rate", label: "Survival", cssVar: "--m-survival",
      hint: "Share of appearances still alive at game end." },
    { key: "vote_accuracy", label: "AI target rate", cssVar: "--m-accuracy",
      hint: "Share of this player's votes that correctly hit an AI." },
  ];

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const isHuman = (row) => row.model === "Humans";

  function orderRows(models) {
    // Rank playable rows by win rate (survival breaks ties); rows without
    // comparable data sink to the bottom in their original order.
    const withData = models.filter((m) => m.data_available);
    const withoutData = models.filter((m) => !m.data_available);
    withData.sort((a, b) =>
      (b.team_win_rate - a.team_win_rate) ||
      (b.survival_rate - a.survival_rate) ||
      (b.games - a.games));
    return { ranked: withData, unranked: withoutData };
  }

  function metricLeaders(models) {
    // The best value per metric, used only for a non-color "best" marker.
    const leaders = {};
    for (const metric of METRICS) {
      let best = -Infinity;
      for (const row of models) {
        if (!row.data_available) continue;
        best = Math.max(best, Number(row[metric.key]) || 0);
      }
      leaders[metric.key] = best;
    }
    return leaders;
  }

  function meter(row, metric, isLeader) {
    const value = clamp01(row[metric.key]);
    const width = value * 100;

    const rowEl = el("div", "st-meter");
    const label = el("div", "st-meter-label", metric.label);
    rowEl.appendChild(label);

    const track = el("div", "st-track");
    track.style.setProperty("--c", `var(${metric.cssVar})`);
    track.title = `${metric.label}: ${pct(value)} — ${metric.hint}`;

    const fill = el("div", "st-fill");
    fill.style.width = width + "%";

    const inside = width >= 26;
    const val = el("span", "st-val", pct(value));
    if (inside) {
      fill.appendChild(val);
    } else {
      val.classList.add("st-val-outside");
      val.style.left = `calc(${width}% + 8px)`;
    }
    track.appendChild(fill);
    if (!inside) track.appendChild(val);
    rowEl.appendChild(track);

    const tag = el("div", "st-meter-flag");
    if (isLeader && value > 0) {
      tag.classList.add("is-best");
      tag.textContent = "BEST";
      tag.title = `Highest ${metric.label.toLowerCase()} of all players.`;
    }
    rowEl.appendChild(tag);
    return rowEl;
  }

  function legend() {
    const wrap = el("div", "st-legend");
    for (const metric of METRICS) {
      const item = el("span", "st-legend-item");
      const sw = el("span", "st-swatch");
      sw.style.background = `var(${metric.cssVar})`;
      item.appendChild(sw);
      item.appendChild(el("span", null, metric.label));
      item.title = metric.hint;
      wrap.appendChild(item);
    }
    return wrap;
  }

  function entityCard(row, rank, leaders) {
    const card = el("div", "st-card" + (isHuman(row) ? " is-human" : ""));

    const head = el("div", "st-card-head");
    const badge = el("div", "st-rank", rank ? "#" + rank : "—");
    if (isHuman(row)) badge.classList.add("st-rank-human");
    head.appendChild(badge);

    const idBlock = el("div", "st-id");
    const name = el("div", "st-name", isHuman(row) ? "Humans" : row.model);
    idBlock.appendChild(name);

    const meta = el("div", "st-id-meta");
    const kind = el("span", "st-kind" + (isHuman(row) ? " st-kind-human" : ""),
      isHuman(row) ? "Human baseline" : "Mistral model");
    meta.appendChild(kind);
    const appearances = el("span", "st-appear",
      row.games + (row.games === 1 ? " appearance" : " appearances"));
    meta.appendChild(appearances);
    idBlock.appendChild(meta);
    head.appendChild(idBlock);

    if (row.data_available) {
      const avg = el("div", "st-avg");
      avg.appendChild(el("span", "st-avg-num",
        (Number(row.avg_rounds_survived) || 0).toFixed(1)));
      avg.appendChild(el("span", "st-avg-lbl", "avg rounds"));
      avg.title = "Average number of rounds this player survived.";
      head.appendChild(avg);
    }
    card.appendChild(head);

    if (!row.data_available) {
      card.appendChild(el("p", "st-note",
        "No comparable data in historical games yet."));
      return card;
    }

    const meters = el("div", "st-meters");
    for (const metric of METRICS) {
      const isLeader = (Number(row[metric.key]) || 0) >= leaders[metric.key]
        && (Number(row[metric.key]) || 0) > 0;
      meters.appendChild(meter(row, metric, isLeader));
    }
    card.appendChild(meters);
    return card;
  }

  function heroTiles(data) {
    const playable = data.models.filter((m) => m.data_available);
    const topSurvivor = playable
      .slice()
      .sort((a, b) => b.survival_rate - a.survival_rate)[0];
    const humans = data.models.find((m) => m.model === "Humans");

    const tiles = [
      { num: String(data.total_games), lbl: "Games recorded",
        hint: "Total finished games written to the results log." },
      { num: String(data.models.length), lbl: "Players tracked",
        hint: "Distinct AI models plus the Humans baseline." },
    ];
    if (topSurvivor) {
      tiles.push({
        num: pct(topSurvivor.survival_rate),
        lbl: "Top survival",
        sub: isHuman(topSurvivor) ? "Humans" : topSurvivor.model,
        hint: "Best survival rate across all players.",
      });
    }
    if (humans && humans.data_available) {
      tiles.push({
        num: pct(humans.team_win_rate),
        lbl: "Human win rate",
        sub: "team victories",
        hint: "How often the human side won.",
      });
    }

    const grid = el("div", "st-hero");
    for (const tile of tiles) {
      const t = el("div", "st-tile");
      t.title = tile.hint || "";
      t.appendChild(el("div", "st-tile-num", tile.num));
      t.appendChild(el("div", "st-tile-lbl", tile.lbl));
      if (tile.sub) t.appendChild(el("div", "st-tile-sub", tile.sub));
      grid.appendChild(t);
    }
    return grid;
  }

  function detailsTable(models) {
    const scroll = el("div", "st-table-scroll");
    const table = el("table", "st-table");

    const thead = el("thead");
    const htr = el("tr");
    for (const h of ["Player", "Appearances", "Win rate", "Survival",
      "AI target", "Votes", "Avg rounds"]) {
      htr.appendChild(el("th", null, h));
    }
    thead.appendChild(htr);
    table.appendChild(thead);

    const tbody = el("tbody");
    for (const r of models) {
      const tr = el("tr", isHuman(r) ? "is-human" : null);
      const cells = r.data_available
        ? [r.model, r.games, pct(r.team_win_rate), pct(r.survival_rate),
          pct(r.vote_accuracy), r.votes_total,
          (Number(r.avg_rounds_survived) || 0).toFixed(1)]
        : [r.model, r.games, "—", "—", "—", "—", "—"];
      cells.forEach((cell, index) => {
        const td = el("td", null, String(cell));
        if (index === 0) td.className = "st-cell-name";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    scroll.appendChild(table);
    return scroll;
  }

  function section(title, node, kicker) {
    const sec = el("section", "st-section");
    const head = el("div", "st-section-head");
    head.appendChild(el("h2", "st-section-title", title));
    if (kicker) head.appendChild(el("span", "st-section-kicker", kicker));
    sec.appendChild(head);
    sec.appendChild(node);
    return sec;
  }

  function stateCard(title, body) {
    const wrap = el("div", "st-empty");
    wrap.appendChild(el("div", "st-empty-title", title));
    if (body) wrap.appendChild(el("p", "st-empty-body", body));
    return wrap;
  }

  // The two rulesets are reported side by side but never mixed: a hardcore
  // agent is rewarded for eliminating humans, so its numbers say something
  // else entirely. Games recorded before hardcore existed count as standard.
  const MODES = ["standard", "hardcore"];
  let selectedMode = "standard";
  let lastPayload = null;

  const modeTabs = document.getElementById("mode-tabs");
  const modeButtons = modeTabs
    ? [...modeTabs.querySelectorAll("[data-mode]")]
    : [];

  function modeView(payload, mode) {
    // An older server without the split still answers with the flat shape.
    return payload?.modes?.[mode] || (mode === "standard" ? payload : null);
  }

  function syncModeTabs(payload) {
    for (const button of modeButtons) {
      const mode = button.dataset.mode;
      const view = modeView(payload, mode);
      const games = view?.total_games || 0;
      // An empty ruleset stays visible only when it is the selected one, so
      // the page never shows a tab that leads nowhere.
      button.classList.toggle("hidden", !games && mode !== selectedMode);
      button.setAttribute("aria-selected", String(mode === selectedMode));
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
      const res = await fetch("/stats");
      if (!res.ok) throw new Error("bad status " + res.status);
      payload = await res.json();
    } catch (err) {
      content.textContent = "";
      content.appendChild(stateCard(
        "Could not load stats",
        "The results service did not respond. Try refreshing in a moment."));
      return;
    }

    lastPayload = payload;
    // Land on the ruleset that actually has games behind it.
    if (!modeView(payload, selectedMode)?.total_games) {
      selectedMode = MODES.find((mode) => modeView(payload, mode)?.total_games)
        || "standard";
    }
    render(payload);
  }

  function render(payload) {
    const content = document.getElementById("content");
    syncModeTabs(payload);
    const data = modeView(payload, selectedMode) || { models: [], total_games: 0 };
    content.textContent = "";

    if (!data.models || data.models.length === 0) {
      content.appendChild(stateCard(
        `No ${selectedMode} games recorded yet`,
        "Finish a game and this dashboard will fill with model performance."));
      return;
    }

    content.appendChild(heroTiles(data));

    const { ranked, unranked } = orderRows(data.models);
    const leaders = metricLeaders(data.models);

    const board = el("div", "st-board");
    board.appendChild(legend());
    let rank = 0;
    for (const row of ranked) {
      rank += 1;
      board.appendChild(entityCard(row, rank, leaders));
    }
    for (const row of unranked) {
      board.appendChild(entityCard(row, 0, leaders));
    }
    content.appendChild(section("Leaderboard", board,
      "Ranked by win rate"));

    content.appendChild(section("Full breakdown", detailsTable(data.models),
      "Every metric"));

    const legacy = data.legacy_games_without_humans || 0;
    const meta = el("p", "st-meta");
    meta.textContent =
      `${data.total_games} ${selectedMode} ` +
      `game${data.total_games === 1 ? "" : "s"} recorded. ` +
      "Win rate counts winning appearances, survival counts seats still alive " +
      "at game end, and AI target rate is the share of a player's votes that " +
      "correctly hit an AI." +
      (legacy
        ? ` Human metrics are unavailable for ${legacy} older ` +
          `game${legacy === 1 ? "" : "s"} recorded before human tracking.`
        : "");
    content.appendChild(meta);
  }

  const refresh = document.getElementById("refresh");
  if (refresh) refresh.addEventListener("click", load);
  load();
})();
