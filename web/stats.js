// Impostral model-performance dashboard: fetch /stats and render a HUD-style
// leaderboard comparing each AI model against the anonymous Humans baseline.
(function () {
  "use strict";

  const pct = (x) => Math.round((Number(x) || 0) * 100) + "%";
  const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));

  const isHuman = (row) => row.model === "Humans";

  // Three compared measures. Order is fixed and never cycled. Colors are the
  // game's brand hues, validated for colorblind separation; every bar also
  // carries a text label and a printed value, so identity is never color-alone.
  //
  // The third is scored against whoever that player is trying to send home,
  // which is not the same seat on both sides of a hardcore room: an agent there
  // wins by surviving whatever it eliminates and is briefed to hunt the humans,
  // so its ballots are read against the humans, not against the other AIs.
  const BASE_METRICS = [
    { key: "team_win_rate", label: "Win rate", cssVar: "--m-win",
      hint: "Share of appearances that ended in a win." },
    { key: "survival_rate", label: "Survival", cssVar: "--m-survival",
      hint: "Share of appearances still alive at game end." },
  ];
  const AI_TARGET = {
    key: "vote_accuracy", label: "AI target rate", cssVar: "--m-accuracy",
    hint: "Share of this player's votes that hit an AI.",
  };
  const HUMAN_TARGET = {
    key: "vote_accuracy", label: "Human target rate", cssVar: "--m-accuracy",
    hint: "Share of this agent's votes that sent a human home — what hardcore "
      + "rewards it for.",
  };

  const huntsHumans = (mode, row) => mode === "hardcore" && !isHuman(row);
  // Row-specific because the two sides of a hardcore table chase each other.
  const metricsFor = (mode, row) =>
    BASE_METRICS.concat(huntsHumans(mode, row) ? HUMAN_TARGET : AI_TARGET);

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

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

  // A row only competes for "best" against rows measured the same way. Win rate
  // and survival always are; the target rate is not, because a hardcore agent
  // is scored on humans eliminated while the humans are scored on AIs.
  const leaderGroup = (mode, row, key) =>
    key === "vote_accuracy" && huntsHumans(mode, row) ? "vote_accuracy:human"
      : key;

  function metricLeaders(models, mode) {
    // The best value per comparable group, used only for a non-color marker.
    const leaders = {};
    for (const row of models) {
      if (!row.data_available) continue;
      for (const key of ["team_win_rate", "survival_rate", "vote_accuracy"]) {
        if (key === "vote_accuracy" && !row.target_data_available) continue;
        const group = leaderGroup(mode, row, key);
        leaders[group] = Math.max(leaders[group] ?? -Infinity,
          Number(row[key]) || 0);
      }
    }
    return leaders;
  }

  function meter(row, metric, isLeader) {
    const value = clamp01(row[metric.key]);
    const width = value * 100;

    const rowEl = el("div", "st-meter");
    const label = el("div", "st-meter-label", metric.label);
    rowEl.appendChild(label);

    // Games recorded before ballots were scored per ruleset have no comparable
    // target history; an empty bar would read as a 0% hit rate.
    if (metric.key === "vote_accuracy" && !row.target_data_available) {
      rowEl.appendChild(el("div", "st-track is-empty"));
      const none = el("div", "st-meter-flag", "no data");
      none.title = "No ballots recorded under the current scoring for this "
        + "player.";
      rowEl.appendChild(none);
      return rowEl;
    }

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

  function legend(mode) {
    const wrap = el("div", "st-legend");
    // The legend describes the board as a whole, so in hardcore the third
    // swatch is named for what it measures on both sides at once.
    const metrics = BASE_METRICS.concat(
      mode === "hardcore"
        ? {
          key: "vote_accuracy", label: "Target rate", cssVar: "--m-accuracy",
          hint: "Share of a player's votes that hit its own target: the "
            + "humans for an agent, the AIs for the humans.",
        }
        : AI_TARGET,
    );
    for (const metric of metrics) {
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

  function entityCard(row, rank, leaders, mode) {
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
    for (const metric of metricsFor(mode, row)) {
      const best = leaders[leaderGroup(mode, row, metric.key)];
      const isLeader = (Number(row[metric.key]) || 0) >= best
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

  function detailsTable(models, mode) {
    const scroll = el("div", "st-table-scroll");
    const table = el("table", "st-table");

    const thead = el("thead");
    const htr = el("tr");
    // One column, two readings in hardcore: each row is scored against the
    // side it is playing to eliminate, so the header stays neutral there.
    const targetHeader = mode === "hardcore" ? "On target" : "AI target";
    for (const h of ["Player", "Appearances", "Win rate", "Survival",
      targetHeader, "Votes", "Avg rounds"]) {
      htr.appendChild(el("th", null, h));
    }
    thead.appendChild(htr);
    table.appendChild(thead);

    const tbody = el("tbody");
    for (const r of models) {
      const tr = el("tr", isHuman(r) ? "is-human" : null);
      const target = r.target_data_available ? pct(r.vote_accuracy) : "—";
      const cells = r.data_available
        ? [r.model, r.games, pct(r.team_win_rate), pct(r.survival_rate),
          target, r.votes_total,
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
    const leaders = metricLeaders(data.models, selectedMode);

    const board = el("div", "st-board");
    board.appendChild(legend(selectedMode));
    let rank = 0;
    for (const row of ranked) {
      rank += 1;
      board.appendChild(entityCard(row, rank, leaders, selectedMode));
    }
    for (const row of unranked) {
      board.appendChild(entityCard(row, 0, leaders, selectedMode));
    }
    content.appendChild(section("Leaderboard", board,
      "Ranked by win rate"));

    content.appendChild(section("Full breakdown",
      detailsTable(data.models, selectedMode), "Every metric"));

    const legacy = data.legacy_games_without_humans || 0;
    const meta = el("p", "st-meta");
    meta.textContent =
      `${data.total_games} ${selectedMode} ` +
      `game${data.total_games === 1 ? "" : "s"} recorded. ` +
      "Win rate counts winning appearances and survival counts seats still " +
      "alive at game end. " +
      (selectedMode === "hardcore"
        ? "An AI here wins by surviving whatever it eliminates, so win rate " +
          "tracks survival by design and the target rate is what separates " +
          "the agents: it reads their votes against the humans they are " +
          "briefed to hunt, and the humans' votes against the AIs."
        : "AI target rate is the share of a player's votes that hit an AI. " +
          "An AI that votes a human out survives without winning, which is " +
          "why survival can run ahead of win rate.") +
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
