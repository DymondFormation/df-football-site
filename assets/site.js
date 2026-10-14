const body = document.body,
  root = body.dataset.root,
  controls = document.querySelector("#controls"),
  content = document.querySelector("#content"),
  summary = document.querySelector("#summary");

const params = new URLSearchParams(location.search);

const image = (category, id, alt, cls = "entity-logo") => {
  const available = window.siteImages?.[category] || [];
  const key = String(id ?? "");
  const src = available.includes(key)
    ? `${root}assets/images/${category}/${encodeURIComponent(key)}.png`
    : category === "teams" ? `${root}assets/images/teams/unknown_light.png`
      : category === "competitions" ? `${root}assets/images/competitions/unknown_light.png` : "";
  return src ? `<img class="${cls}" src="${src}" alt="" title="${esc(alt)}">` : "";
};

const entity = (category, id, name, cls = "entity-logo") =>
  `${image(category, id, name || id, cls)}<span>${esc(name || id || "—")}</span>`;

// Dense history headers show a logo instead of the ID; names stay in tooltips.
const historyEntity = (category, id, name) =>
  image(category, id, name || id, "match-history-badge history-logo") || esc(id || "—");

const esc = (v) =>
  String(v ?? "—").replace(
    /[&<>"']/g,

    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const colour = (id) => {
  let h = 0;

  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;

  return `hsl(${h % 360} 65% 55%)`;
};

const date = (v) =>
  v
    ? new Date(v).toLocaleString(undefined, {
        month: "short",

        day: "numeric",

        hour: "numeric",

        minute: "2-digit",

        hour12: true,
      })
    : "Kickoff pending";

const fixtureDateKey = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fixtureTimeKey = (value) => {
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const fixtureTimeLabel = (value) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(`2000-01-01T${value}:00`))
    .replace(/\b(am|pm)\b/i, (match) => match.toUpperCase());

const fixtureDateLabel = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const competitionKey = (f) => `${f.source}:${f.source_competition_id}`;

const competitionMark = (f) =>
  image("competitions", f.source_competition_id, f.competition) ||
  `<span>${esc(f.competition)}</span>`;

const get = async (url) => {
  const r = await fetch(url);

  if (!r.ok) throw Error("Data unavailable");

  return r.json();
};

const state = (key, value) => {
  params.set(key, value);

  history.replaceState(null, "", "?" + params);
};

function select(key, label, options, initial) {
  const l = document.createElement("label");

  l.textContent = label;

  const s = document.createElement("select");

  s.id = key;

  for (const [v, t] of options) {
    const o = new Option(t, v);

    s.add(o);
  }

  s.value = params.get(key) || String(initial);

  if (!s.value) s.selectedIndex = 0;

  l.append(s);

  controls.append(l);

  return s;
}

function input(key, label, type, value) {
  const l = document.createElement("label");

  l.textContent = label;

  const x = document.createElement("input");

  x.type = type;

  x.value = params.get(key) || value;

  x.id = key;

  l.append(x);

  controls.append(l);

  return x;
}

const unique = (rows, key) =>
  [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort();

const fixtureCard = (f) =>
  `<a class="card home-fixture" href="${root}${esc(f.page)}" aria-label="Analyse ${esc(f.home_team)} versus ${esc(f.away_team)}">
    <div class="home-fixture-top"><time>${esc(date(f.scheduled_start_utc))}</time><small class="home-fixture-comp">${entity("competitions", f.source_competition_id, f.competition)}</small><span class="fixture-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6" /></svg></span></div>
    <h3 class="home-fixture-teams"><span class="home-fixture-team home-fixture-home"><span>${esc(f.home_team)}</span>${image("teams", f.home_team_id, f.home_team)}</span><span class="home-fixture-versus">v</span><span class="home-fixture-team home-fixture-away">${image("teams", f.away_team_id, f.away_team)}<span>${esc(f.away_team)}</span></span></h3>
  </a>`;

const empty = () =>
  '<p class="empty">No collected matches meet these filters.</p>';

// Group fixture rows without changing their upstream statistics.
function fixtureGroups(fixtures, grouping) {
  const byCompetition = grouping === "competition";
  const compareText = (a, b) => String(a || "").localeCompare(String(b || ""));
  const kickoff = (f) => new Date(f.scheduled_start_utc).getTime();
  const sorted = [...fixtures].sort((a, b) => {
    const primary = byCompetition
      ? compareText(a.competition, b.competition)
      : kickoff(a) - kickoff(b);
    const secondary = byCompetition
      ? kickoff(a) - kickoff(b)
      : compareText(a.competition, b.competition);
    return (
      primary ||
      secondary ||
      compareText(a.home_team, b.home_team) ||
      compareText(a.away_team, b.away_team)
    );
  });
  const groups = new Map();
  for (const f of sorted) {
    const key = byCompetition
      ? `${f.source}|${f.source_competition_id}`
      : String(kickoff(f));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  return `<div class="fixture-groups">${[...groups.values()]
    .map((group) => {
      const first = group[0];
      const heading = byCompetition
        ? first.competition
        : date(first.scheduled_start_utc);
      return `<section class="fixture-group"><h2>${esc(heading)}</h2><div class="fixture-group-rows">${group
        .map((f) => {
          const context = byCompetition
            ? esc(date(f.scheduled_start_utc))
            : competitionMark(f);
          return `<a class="fixture-row" href="${root}${esc(f.page)}" aria-label="Analyse ${esc(f.home_team)} versus ${esc(f.away_team)}">
        <span class="fixture-context">${context}</span>
        <span class="fixture-home"><span>${esc(f.home_team)}</span>${image("teams", f.home_team_id, f.home_team)}</span>
        <span class="fixture-versus">v</span>
        <span class="fixture-away">${image("teams", f.away_team_id, f.away_team)}<span>${esc(f.away_team)}</span></span>
        <span class="fixture-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>
        </span>
      </a>`;
        })
        .join("")}</div></section>`;
    })
    .join("")}</div>`;
}

async function start() {
  const data = await get(body.dataset.payload);
  window.siteImages = data.images || {};

  if (body.dataset.kind === "home") {
    summary.innerHTML = `<div class="shortcuts"><a href="${root}players/index.html?stat=shots&mode=per95">Shots / 95 →</a><a href="${root}players/index.html?stat=tackles&mode=per95">Tackles / 95 →</a><a href="${root}players/index.html?stat=fouls_drawn&mode=per95">Fouls drawn / 95 →</a></div>`;

    content.innerHTML =
      '<h2 class="home-fixtures-heading">Next fixtures</h2><div class="cards home-fixtures">' +
      data.fixtures.slice(0, 30).map(fixtureCard).join("") +
      "</div>";

    if (!data.fixtures.length) content.innerHTML = empty();

    return;
  }

  if (body.dataset.kind === "fixtures") {
    const oldCountry = params.get("country");
    const oldCompetition = params.get("competition");
    const selected = {
      regions: new Set(params.getAll("regions")),
      competitions: new Set(params.getAll("competitions")),
      dates: new Set(params.getAll("dates")),
      kickoffs: new Set(params.getAll("kickoffs")),
    };
    if (!selected.regions.size && oldCountry && oldCountry !== "all")
      selected.regions.add(oldCountry);
    if (!selected.competitions.size && oldCompetition && oldCompetition !== "all")
      for (const f of data.fixtures)
        if (f.competition === oldCompetition)
          selected.competitions.add(competitionKey(f));
    if (!selected.dates.size && (params.get("from") || params.get("to")))
      for (const f of data.fixtures) {
        const day = fixtureDateKey(f.scheduled_start_utc);
        if (
          (!params.get("from") || day >= params.get("from")) &&
          (!params.get("to") || day <= params.get("to"))
        )
          selected.dates.add(day);
      }

    let groupBy = params.get("group") === "competition" ? "competition" : "kickoff";
    let searchValue = params.get("team") || "";
    params.delete("country");
    params.delete("competition");
    params.delete("from");
    params.delete("to");

    const icons = {
      regions:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18m0-18a15 15 0 0 0 0 18"/></svg>',
      competitions:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v4m-4 3h12m-10-3h8"/></svg>',
      dates:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><text x="12" y="18" text-anchor="middle" class="calendar-day">31</text></svg>',
      kickoffs:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    };
    const slicerSpecs = [
      ["regions", "Region / country"],
      ["competitions", "Competitions"],
      ["dates", "Date"],
      ["kickoffs", "Kickoff time"],
    ];
    controls.innerHTML =
      slicerSpecs
        .map(
          ([key, label]) => `<section class="fixture-slicer" data-slicer="${key}" role="group" aria-label="${label}">
        <span class="slicer-icon" title="${label}" aria-hidden="true">${icons[key]}</span>
        <div class="slicer-options" role="group" aria-label="${label} options"></div>
        <button class="slicer-clear" type="button" data-clear="${key}" aria-label="Clear ${label} filters" title="Clear ${label} filters">×</button>
      </section>`,
        )
        .join("") +
      `<div class="fixture-filter-bottom">
        <div class="group-toggle" role="group" aria-label="Group fixtures by">
          <svg class="view-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
          <button type="button" data-group="competition" aria-label="Group by competition" title="Group by competition" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v4m-4 3h12m-10-3h8"/></svg></button>
          <button type="button" data-group="kickoff" aria-label="Group by kickoff time" title="Group by kickoff time" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></button>
        </div>
        <div class="fixture-team-search">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="m9 5 7 3 7-3 6 4-3 7-4-2v13H10V14l-4 2-3-7z"/><circle cx="24" cy="9" r="5"/><path d="m27.5 12.5 3 3"/></svg>
          <label class="sr-only" for="team">Team search</label>
          <input id="team" type="search" value="${esc(searchValue)}" placeholder="Search teams" />
        </div>
      </div>`;

    for (const track of controls.querySelectorAll(".slicer-options")) {
      let scrollTimer;
      track.addEventListener(
        "scroll",
        () => {
          track.classList.add("is-scrolling");
          clearTimeout(scrollTimer);
          scrollTimer = setTimeout(() => track.classList.remove("is-scrolling"), 650);
        },
        { passive: true },
      );
    }

    const passes = (f, except) =>
      (except === "regions" || !selected.regions.size || selected.regions.has(String(f.region_name))) &&
      (except === "competitions" || !selected.competitions.size || selected.competitions.has(competitionKey(f))) &&
      (except === "dates" || !selected.dates.size || selected.dates.has(fixtureDateKey(f.scheduled_start_utc))) &&
      (except === "kickoffs" || !selected.kickoffs.size || selected.kickoffs.has(fixtureTimeKey(f.scheduled_start_utc))) &&
      (!searchValue || `${f.home_team} ${f.away_team}`.toLowerCase().includes(searchValue.toLowerCase()));

    const optionsFor = {
      regions: (rows) =>
        [...new Set(rows.map((f) => f.region_name).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b))
          .map((value) => [value, value]),
      competitions: (rows) => {
        const byKey = new Map(rows.map((f) => [competitionKey(f), f]));
        for (const key of selected.competitions) {
          const old = data.fixtures.find((f) => competitionKey(f) === key);
          if (old) byKey.set(key, old);
        }
        return [...byKey]
          .sort((a, b) => a[1].competition.localeCompare(b[1].competition))
          .map(([key, f]) => [key, f.competition]);
      },
      dates: (rows) =>
        [...new Set(rows.map((f) => fixtureDateKey(f.scheduled_start_utc)))].sort().map((value) => [value, fixtureDateLabel(value)]),
      kickoffs: (rows) =>
        [...new Set(rows.map((f) => fixtureTimeKey(f.scheduled_start_utc)))].sort().map((value) => [value, fixtureTimeLabel(value)]),
    };

    const render = () => {
      for (const [key] of slicerSpecs) {
        const available = optionsFor[key](data.fixtures.filter((f) => passes(f, key)));
        const availableKeys = new Set(available.map(([value]) => value));
        const allOptions = [...available];
        for (const value of selected[key]) {
          if (availableKeys.has(value)) continue;
          const fallback =
            key === "competitions"
              ? data.fixtures.find((f) => competitionKey(f) === value)?.competition
              : key === "dates"
                ? fixtureDateLabel(value)
                : key === "kickoffs"
                  ? fixtureTimeLabel(value)
                  : value;
          if (fallback) allOptions.push([value, fallback]);
        }
        const orderedOptions = ["regions", "competitions"].includes(key)
          ? [
              ...[...selected[key]]
                .map((value) => allOptions.find(([option]) => option === value))
                .filter(Boolean),
              ...allOptions.filter(([value]) => !selected[key].has(value)),
            ]
          : allOptions;
        const track = controls.querySelector(`[data-slicer="${key}"] .slicer-options`);
        const oldScroll = track.scrollLeft;
        track.innerHTML = orderedOptions
          .map(
            ([value, label]) => `<button class="slicer-chip${selected[key].has(value) ? " active" : ""}" type="button" data-filter="${key}" data-value="${esc(value)}" aria-pressed="${selected[key].has(value)}"${!availableKeys.has(value) && !selected[key].has(value) ? " disabled" : ""}>${esc(label)}</button>`,
          )
          .join("");
        track.scrollLeft = oldScroll;
        controls.querySelector(`[data-slicer="${key}"] .slicer-clear`).disabled =
          selected[key].size === 0;
      }
      for (const button of controls.querySelectorAll("[data-group]")) {
        const active = button.dataset.group === groupBy;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      }
      const rows = data.fixtures.filter((f) => passes(f));
      content.innerHTML = rows.length ? fixtureGroups(rows, groupBy) : empty();
      syncFixtureFiltersToUrl();
    };

    const syncFixtureFiltersToUrl = () => {
      for (const key of ["regions", "competitions", "dates", "kickoffs"]) {
        params.delete(key);
        for (const value of selected[key]) params.append(key, value);
      }
      params.set("group", groupBy);
      if (searchValue) params.set("team", searchValue);
      else params.delete("team");
      history.replaceState(null, "", params.toString() ? `?${params}` : location.pathname);
    };

    controls.addEventListener("click", (event) => {
      const clear = event.target.closest("[data-clear]");
      if (clear) {
        selected[clear.dataset.clear].clear();
        render();
        return;
      }
      const chip = event.target.closest("[data-filter]");
      if (chip && !chip.disabled) {
        const values = selected[chip.dataset.filter];
        if (values.has(chip.dataset.value)) values.delete(chip.dataset.value);
        else values.add(chip.dataset.value);
        render();
        return;
      }
      const groupButton = event.target.closest("[data-group]");
      if (groupButton) {
        groupBy = groupButton.dataset.group;
        render();
      }
    });
    controls.querySelector("#team").addEventListener("input", (event) => {
      searchValue = event.target.value;
      render();
      const search = controls.querySelector("#team");
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
    });

    render();

    return;
  }

  if (body.dataset.kind === "players") {
    await rankings(data);

    return;
  }

  await match(data);
}

async function rankings(data) {
  const savedWindow = params.get("window") || "last_5";
  const savedMode = params.get("mode") || "per95";
  let matchNextSide = params.get("match_side") === "1";
  let startersOnly = params.get("starters") === "1";
  const maximumRecentGames = Math.max(1, Number(data.recent_games) || 10);
  const selected = {
    regions: new Set(params.getAll("region")),
    competitions: new Set(params.getAll("competition")),
    dates: new Set(params.getAll("next_date")),
    kickoffs: new Set(params.getAll("next_kickoff")),
  };
  let sampleValue = savedWindow,
    modeValue = ["total", "per95"].includes(savedMode) ? savedMode : "per95",
    appearances = [],
    limit = 50,
    sortKey = "metric",
    sortDirection = -1;
  const icons = {
    regions:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18m0-18a15 15 0 0 0 0 18"/></svg>',
    competitions:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v4m-4 3h12m-10-3h8"/></svg>',
    dates:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><text x="12" y="18" text-anchor="middle" class="calendar-day">31</text></svg>',
    kickoffs:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    statistics:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v18h18M6 16l5-5 4 3 6-8m-5 0h5v5"/></svg>',
    player:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6.2" r="3.5" fill="currentColor" stroke="none"/><path fill="currentColor" fill-rule="evenodd" stroke="none" d="M8.1 10.7 6.5 11.2 4.3 12.7 2.2 16.8 6.3 19l1.5-2.6V22h8.4v-5.6l1.5 2.6 4.1-2.2-2.1-4.1-2.2-1.5-1.6-.5L12 13.4l-3.9-2.7z M9.4 11.2 12 13.1l2.6-1.9-1.2-.4-1.4 1-1.4-1z"/></svg>',
  };
  const sampleOptions = [3, 5, 10].map((size) => [`last_${size}`, String(size)]);
  if (![3, 5, 10].includes(maximumRecentGames))
    sampleOptions.push([`last_${maximumRecentGames}`, String(maximumRecentGames)]);
  if (!sampleOptions.some(([value]) => value === savedWindow)) sampleValue = "last_5";
  const modeOptions = [
    ["total", "Tot"],
    ["per95", "p95"],
  ];
  controls.innerHTML = `
    <section class="rank-slicer" data-slicer="regions" role="group" aria-label="Region">
      <span class="slicer-icon" title="Region" aria-hidden="true">${icons.regions}</span>
      <div class="rank-slicer-options" role="group" aria-label="Region options"></div>
      <button class="slicer-clear" type="button" data-clear="regions" aria-label="Clear region filters" title="Clear region filters">×</button>
    </section>
    <section class="rank-slicer" data-slicer="competitions" role="group" aria-label="Competition">
      <span class="slicer-icon" title="Competition" aria-hidden="true">${icons.competitions}</span>
      <div class="rank-slicer-options" role="group" aria-label="Competition options"></div>
      <button class="slicer-clear" type="button" data-clear="competitions" aria-label="Clear competition filters" title="Clear competition filters">×</button>
    </section>
    <section class="rank-slicer" data-slicer="dates" role="group" aria-label="Next match date">
      <span class="slicer-icon" title="Next match date" aria-hidden="true">${icons.dates}</span>
      <div class="rank-slicer-options" role="group" aria-label="Next match date options"></div>
      <button class="slicer-clear" type="button" data-clear="dates" aria-label="Clear next match date filters" title="Clear next match date filters">×</button>
    </section>
    <section class="rank-slicer" data-slicer="kickoffs" role="group" aria-label="Next match kickoff time">
      <span class="slicer-icon" title="Next match kickoff time" aria-hidden="true">${icons.kickoffs}</span>
      <div class="rank-slicer-options" role="group" aria-label="Next match kickoff time options"></div>
      <button class="slicer-clear" type="button" data-clear="kickoffs" aria-label="Clear next match kickoff time filters" title="Clear next match kickoff time filters">×</button>
    </section>
    <div class="ranking-settings">
      <div class="rank-settings-line">
        <span class="slicer-icon rank-settings-icon" title="Statistics" aria-label="Statistics" role="img">${icons.statistics}</span>
        <div class="rank-settings-row rank-settings-primary">
          <label class="rank-control rank-stat">Metric<select id="stat">${Object.entries(data.metrics).map(([key, name]) => `<option value="${esc(key)}">${esc(name)}</option>`).join("")}</select></label>
          <div class="rank-control"><span>Maximum Matches</span><div class="rank-choice" data-choice-group="window" role="group" aria-label="Maximum Matches"></div></div>
          <div class="rank-control"><span>View</span><div class="rank-choice" data-choice-group="mode" role="group" aria-label="View"></div></div>
          <div class="rank-control"><span>Next side</span><button class="rank-toggle" id="match-side-toggle" type="button" aria-pressed="false">Off</button></div>
        </div>
      </div>
      <div class="rank-settings-line">
        <span class="slicer-icon rank-settings-icon" title="Player context" aria-label="Player context" role="img">${icons.player}</span>
        <div class="rank-settings-row rank-settings-context">
          <div class="rank-control rank-starter"><span>Starter</span><button class="rank-toggle rank-toggle-starter" id="starter-toggle" type="button" aria-pressed="false">Off</button></div>
          <label class="rank-control rank-number">Mins+<input id="minutes" type="number" min="0" value="${esc(params.get("minutes") || "90")}" inputmode="numeric"></label>
          <label class="rank-control rank-number rank-starts">Starts+<input id="starts" type="number" min="0" value="${esc(params.get("starts") || "0")}" inputmode="numeric"></label>
          <label class="rank-control rank-search">Team<input id="team" type="search" value="${esc(params.get("team") || "")}" placeholder="Team"></label>
          <label class="rank-control rank-position">Pos<input id="position" type="search" maxlength="3" value="${esc(params.get("position") || params.get("role") || "")}" placeholder="Any" autocomplete="off"></label>
        </div>
      </div>
    </div>`;

  const choices = { window: sampleOptions, mode: modeOptions };
  for (const [group, options] of Object.entries(choices)) {
    controls.querySelector(`[data-choice-group="${group}"]`).innerHTML = options
      .map(
        ([value, label]) =>
          `<button class="rank-choice-button" type="button" data-choice="${group}" data-value="${value}" aria-pressed="false">${label}</button>`,
      )
      .join("");
  }
  const stat = controls.querySelector("#stat");
  const minutes = controls.querySelector("#minutes");
  const starts = controls.querySelector("#starts");
  const team = controls.querySelector("#team");
  const position = controls.querySelector("#position");
  const matchSideToggle = controls.querySelector("#match-side-toggle");
  const starterToggle = controls.querySelector("#starter-toggle");
  stat.value = params.get("stat") || "shots";

  function syncUrl() {
    params.delete("context");
    params.delete("role");
    params.delete("season");
    for (const key of ["region", "competition", "next_date", "next_kickoff"])
      params.delete(key);
    for (const value of selected.regions) params.append("region", value);
    for (const value of selected.competitions) params.append("competition", value);
    for (const value of selected.dates) params.append("next_date", value);
    for (const value of selected.kickoffs) params.append("next_kickoff", value);
    params.set("window", sampleValue);
    params.set("mode", modeValue);
    params.delete("venue");
    if (matchNextSide) params.set("match_side", "1");
    else params.delete("match_side");
    if (startersOnly) params.set("starters", "1");
    else params.delete("starters");
    for (const [key, value] of [
      ["stat", stat.value],
      ["minutes", minutes.value],
      ["starts", starts.value],
      ["team", team.value],
      ["position", position.value],
    ]) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    history.replaceState(null, "", params.toString() ? `?${params}` : location.pathname);
  }

  function filteredRows(except = "", includeContext = true) {
    const roleSearch = position.value.trim().toLowerCase();
    const teamSearch = team.value.trim().toLowerCase();
    return appearances.filter(
      (r) =>
        (except === "regions" || !selected.regions.size || selected.regions.has(r.region_name)) &&
        (except === "competitions" || !selected.competitions.size || selected.competitions.has(String(r.source_competition_id))) &&
        (except === "dates" || !selected.dates.size || (r.next_match_scheduled_start_utc && selected.dates.has(fixtureDateKey(r.next_match_scheduled_start_utc)))) &&
        (except === "kickoffs" || !selected.kickoffs.size || (r.next_match_scheduled_start_utc && selected.kickoffs.has(fixtureTimeKey(r.next_match_scheduled_start_utc)))) &&
        (!startersOnly || Boolean(r.started)) &&
        (!matchNextSide || (r.next_match_side && r.team_side === (r.next_match_side === "H" ? "home" : "away"))) &&
        (!includeContext || !roleSearch || `${r.position || ""} ${r.tactical_role || ""}`.toLowerCase().includes(roleSearch)) &&
        (!includeContext || !teamSearch || (r.team_name || "").toLowerCase().includes(teamSearch)),
    );
  }

  function aggregateRows() {
    const gameCount = Number(sampleValue.match(/\d+/)?.[0] || maximumRecentGames);
    const groups = new Map();
    for (const appearance of filteredRows("", false)) {
      const key = `${appearance.source}|${appearance.source_player_id}|${appearance.source_team_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(appearance);
    }
    const aggregated = [];
    for (const group of groups.values()) {
      group.sort((a, b) =>
        new Date(b.match_date) - new Date(a.match_date) ||
        Number(b.source_match_id) - Number(a.source_match_id),
      );
      const sample = group.slice(0, gameCount);
      const latest = sample[0];
      const result = {
        ...latest,
        window_type: sampleValue,
        venue_scope: matchNextSide ? (latest.next_match_side === "H" ? "home" : "away") : "all",
        matches: sample.length,
        starts: sample.filter((r) => Boolean(r.started)).length,
        minutes: sample.reduce((sum, r) => sum + Number(r.minutes_played || 0), 0),
      };
      for (const metric of Object.keys(data.metrics)) {
        result[metric] = sample.reduce((sum, r) => sum + Number(r[metric] || 0), 0);
      }
      const roleSearch = position.value.trim().toLowerCase();
      const teamSearch = team.value.trim().toLowerCase();
      if (
        (!roleSearch || `${result.position || ""} ${result.tactical_role || ""}`.toLowerCase().includes(roleSearch)) &&
        (!teamSearch || (result.team_name || "").toLowerCase().includes(teamSearch))
      ) aggregated.push(result);
    }
    return aggregated;
  }

  function renderFilters() {
    const dimensions = [
      ["regions", (r) => r.region_name, (r) => r.region_name],
      ["competitions", (r) => String(r.source_competition_id), (r) => r.competition_name],
      [
        "dates",
        (r) =>
          r.next_match_scheduled_start_utc
            ? fixtureDateKey(r.next_match_scheduled_start_utc)
            : null,
        (r) => fixtureDateLabel(fixtureDateKey(r.next_match_scheduled_start_utc)),
      ],
      [
        "kickoffs",
        (r) =>
          r.next_match_scheduled_start_utc
            ? fixtureTimeKey(r.next_match_scheduled_start_utc)
            : null,
        (r) => fixtureTimeLabel(fixtureTimeKey(r.next_match_scheduled_start_utc)),
      ],
    ];
    for (const [key, valueOf, labelOf] of dimensions) {
      const available = new Map();
      for (const row of filteredRows(key)) {
        const value = valueOf(row);
        if (value && !available.has(value)) available.set(value, labelOf(row));
      }
      const selectedValues = selected[key];
      const allValues = new Map(available);
      for (const value of selectedValues) {
        if (allValues.has(value)) continue;
        const fallback = appearances.find((r) => valueOf(r) === value);
        if (fallback) allValues.set(value, labelOf(fallback));
      }
      const track = controls.querySelector(`[data-slicer="${key}"] .rank-slicer-options`);
      const oldScroll = track.scrollLeft;
      const orderedValues = [...allValues].sort((a, b) =>
        key === "dates" || key === "kickoffs"
          ? a[0].localeCompare(b[0])
          : String(a[1]).localeCompare(String(b[1])),
      );
      const displayValues = !["regions", "competitions"].includes(key)
        ? orderedValues
        : [
            ...[...selectedValues]
              .map((value) => orderedValues.find(([option]) => option === value))
              .filter(Boolean),
            ...orderedValues.filter(([value]) => !selectedValues.has(value)),
          ];
      track.innerHTML = displayValues
        .map(
          ([value, label]) =>
            `<button class="slicer-chip${selectedValues.has(value) ? " active" : ""}" type="button" data-filter="${key}" data-value="${esc(value)}" aria-pressed="${selectedValues.has(value)}"${!available.has(value) && !selectedValues.has(value) ? " disabled" : ""}>${esc(label)}</button>`,
        )
        .join("");
      track.scrollLeft = oldScroll;
      controls.querySelector(`[data-clear="${key}"]`).disabled = !selectedValues.size;
      if (!track.dataset.scrollHandler) {
        let scrollTimer;
        track.addEventListener("scroll", () => {
          track.classList.add("is-scrolling");
          clearTimeout(scrollTimer);
          scrollTimer = setTimeout(() => track.classList.remove("is-scrolling"), 650);
        }, { passive: true });
        track.dataset.scrollHandler = "true";
      }
    }

    for (const button of controls.querySelectorAll("[data-choice]")) {
      const active = button.dataset.choice === "window" ? button.dataset.value === sampleValue : button.dataset.value === modeValue;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    for (const [toggle, active] of [[matchSideToggle, matchNextSide], [starterToggle, startersOnly]]) {
      toggle.classList.toggle("active", active);
      toggle.setAttribute("aria-pressed", String(active));
      toggle.textContent = active ? "On" : "Off";
    }
  }

  async function load() {
    if (!appearances.length)
      appearances = await get(`${root}data/rankings/player-matches.json`);
    limit = 50;
    render();
  }

  function render() {
    renderFilters();
    const filtered = aggregateRows().filter(
      (r) =>
        r.window_type === sampleValue &&
        Number(r.minutes) >= Number(minutes.value || 0) &&
        Number(r.starts) >= Number(starts.value || 0),
    );
    const value = (r) =>
      modeValue === "total"
        ? Number(r[stat.value] || 0)
        : (Number(r[stat.value] || 0) * (modeValue === "per95" ? 95 : 90)) / Number(r.minutes || 1);
    const playerName = (r) => r.player_display_name || r.player_name;
    const sortValue = (r) => {
      if (sortKey === "player") return playerName(r);
      if (sortKey === "info")
        return `${r.team_name || ""} ${r.position || r.tactical_role || ""} ${r.next_match_opponent_name || ""}`;
      if (sortKey === "minutes") return Number(r.minutes || 0);
      if (sortKey === "apps") return Number(r.matches || 0);
      return value(r);
    };
    filtered.sort((a, b) => {
      const left = sortValue(a);
      const right = sortValue(b);
      const comparison =
        typeof left === "string"
          ? left.localeCompare(right, undefined, { sensitivity: "base" })
          : left - right;
      return sortDirection * comparison || playerName(a).localeCompare(playerName(b));
    });
    const sortButton = (key, label) =>
      `<button class="rank-sort" type="button" data-rank-sort="${key}" aria-label="Sort by ${esc(label)}" aria-sort="${sortKey === key ? (sortDirection < 0 ? "descending" : "ascending") : "none"}">${esc(label)}${sortKey === key ? ` ${sortDirection < 0 ? "↓" : "↑"}` : ""}</button>`;
    const gameCount = Number(sampleValue.match(/\d+/)?.[0] || data.recent_games);
    content.innerHTML = filtered.length
      ? `<div class="scroll ranking-scroll"><table class="ranking-table"><colgroup><col class="rank-col-player"><col class="rank-col-info"><col class="rank-col-metric"><col class="rank-col-minutes"><col class="rank-col-apps"></colgroup><thead><tr><th>${sortButton("player", "Player")}</th><th>${sortButton("info", "Info")}</th><th>${sortButton("metric", "Metric")}</th><th>${sortButton("minutes", "Mins")}</th><th>${sortButton("apps", "Apps")}</th></tr></thead><tbody>${filtered
          .slice(0, limit)
          .map(
            (r) => {
              const matchQuery = new URLSearchParams({
                stat: stat.value,
                games: String(gameCount),
                team: String(r.source_team_id),
              });
              const matchLink = r.next_match_page
                ? `<a class="rank-next-match" href="${root}${esc(r.next_match_page)}.html?${matchQuery}" aria-label="Analyse ${esc(r.next_match_opponent_name)} match"><span class="rank-next-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></span><span>vs ${esc(r.next_match_opponent_name)} (${esc(r.next_match_side)})</span></a>`
                : "";
              return `<tr><td class="rank-player"><div class="rank-player-cell"><button class="expand" data-detail="${r.detail}" aria-expanded="false" aria-label="Show recent appearances">+</button><span class="rank-player-name" title="${esc(playerName(r))}">${esc(playerName(r))}</span></div></td><td class="rank-info"><div class="rank-info-team">${image("teams", r.source_team_id, r.team_name)}<span class="rank-info-name" title="${esc(r.team_name)}">${esc(r.team_name)}</span><span class="rank-info-position">${esc(r.position || r.tactical_role || "")}</span></div>${matchLink}</td><td class="rank-metric">${value(r).toFixed(modeValue === "total" ? 0 : 2)}</td><td>${Math.round(r.minutes)}</td><td>${r.matches} (${Math.max(0, Number(r.matches || 0) - Number(r.starts || 0))})</td></tr>`;
            },
          )
          .join("")}</tbody></table></div>${filtered.length > limit ? '<button id="more">Show 50 more</button>' : ""}`
      : empty();
    for (const button of content.querySelectorAll("[data-rank-sort]"))
      button.addEventListener("click", () => {
        const scrollLeft = content.querySelector(".ranking-scroll")?.scrollLeft || 0;
        const nextKey = button.dataset.rankSort;
        if (sortKey === nextKey) sortDirection *= -1;
        else {
          sortKey = nextKey;
          sortDirection = nextKey === "metric" ? -1 : 1;
        }
        render();
        requestAnimationFrame(() => {
          const rankingScroll = content.querySelector(".ranking-scroll");
          if (rankingScroll) rankingScroll.scrollLeft = scrollLeft;
        });
      });
    document.querySelector("#more")?.addEventListener("click", () => {
      limit += 50;
      render();
    });
    for (const button of document.querySelectorAll(".expand"))
      button.onclick = async () => {
        if (button.getAttribute("aria-expanded") === "true") {
          button.closest("tr").nextElementSibling.remove();
          button.setAttribute("aria-expanded", "false");
          button.textContent = "+";
          return;
        }
        button.disabled = true;
        try {
          const detail = await get(root + "data/players/" + button.dataset.detail + ".json");
          const tr = document.createElement("tr");
          tr.className = "detail";
          tr.innerHTML = `<td colspan="5"><strong>Latest appearances across all teams / competitions</strong><div>${detail.map((r) => `<p>${date(r.match_date)} · ${esc(r.team_name)} v ${esc(r.opponent_name)} · ${esc(r.competition_name)} · ${r.started ? "S" : "ON"} · ${Math.round(r.minutes_played)} min · ${esc(data.metrics[stat.value])}: ${esc(r[stat.value])}</p>`).join("")}</div></td>`;
          button.closest("tr").after(tr);
          button.setAttribute("aria-expanded", "true");
          button.textContent = "−";
        } catch {
          content.insertAdjacentHTML("beforeend", "<p>Recent details unavailable.</p>");
        } finally {
          button.disabled = false;
        }
      };
    syncUrl();
  }

  controls.addEventListener("click", (event) => {
    const clear = event.target.closest("[data-clear]");
    if (clear) {
      selected[clear.dataset.clear].clear();
      render();
      return;
    }
    const chip = event.target.closest("[data-filter]");
    if (chip && !chip.disabled) {
      const values = selected[chip.dataset.filter];
      if (values.has(chip.dataset.value)) values.delete(chip.dataset.value);
      else values.add(chip.dataset.value);
      render();
      return;
    }
    const choice = event.target.closest("[data-choice]");
    if (choice) {
      if (choice.dataset.choice === "window") sampleValue = choice.dataset.value;
      if (choice.dataset.choice === "mode") modeValue = choice.dataset.value;
      syncUrl();
      if (choice.dataset.choice === "window") load().catch(showError);
      else render();
    }
  });
  content.addEventListener("click", (event) => {
    const sortButton = event.target.closest("button[data-grid-sort]");
    if (!sortButton) return;
    const key = sortButton.dataset.gridSort;
    const index = Number(sortButton.dataset.gridSortIndex || 0);
    if (gridSortKey === key && (key !== "match" || gridSortMatchIndex === index)) {
      gridSortDirection *= -1;
    } else {
      gridSortKey = key;
      gridSortMatchIndex = index;
      gridSortDirection = key === "match" ? -1 : 1;
    }
    render();
  });
  matchSideToggle.addEventListener("click", () => {
    matchNextSide = !matchNextSide;
    syncUrl();
    load().catch(showError);
  });
  starterToggle.addEventListener("click", () => {
    startersOnly = !startersOnly;
    syncUrl();
    load().catch(showError);
  });
  stat.onchange = () => render();
  for (const field of [minutes, starts, team, position])
    field.oninput = () => render();
  await load();
}

async function match(data) {
  const f = data.fixture;

  const resultCode = (value) =>
    ({ win: "W", draw: "D", loss: "L" })[value] || value || "—";
  const form = (rows) => {
    const tiles = rows.slice(0, 5).map((r, index) =>
      `<span class="form-tile ${esc(resultCode(r.result))}${index === 0 ? " latest-form" : ""}" title="${esc(r.historical_opponent_name)}">${esc(resultCode(r.result))}</span>`,
    );
    while (tiles.length < 5) tiles.push('<span class="form-tile form-tile-empty" aria-hidden="true"></span>');
    return tiles.join("");
  };
  const teamNames = new Map([
    [String(f.home_team_id), f.home_team],
    [String(f.away_team_id), f.away_team],
  ]);
  let teamValue = params.get("team") || String(f.home_team_id);
  let competitionValue = params.get("competition") || "all";
  let statValue = params.get("stat") || "shots";
  let gameCount = Number(params.get("games") || 10);
  let sideFilterOn = (params.get("venue") || "all") !== "all";
  let gridSortKey = "match";
  let gridSortMatchIndex = 0;
  let gridSortDirection = -1;
  const formatFormation = (value) => {
    return String(value || "").replaceAll("-", "");
  };
  const icon = (file, label, cls = "metadata-icon") =>
    `<img class="${cls}" src="${root}assets/images/icons/${file}.png" alt="" title="${esc(label)}">`;
  const dates = (value) => new Date(value).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
  const kickoff = (value) => new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric", minute: "2-digit", hour12: true,
  }).replace(/\b(am|pm)\b/i, (part) => part.toUpperCase());
  const fitTitle = () => {
    const title = summary.querySelector(".match-title");
    if (!title) return;
    title.style.fontSize = "";
    const style = getComputedStyle(title);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const namesWidth = [".match-title-home", ".match-title-away"]
      .reduce((total, selector) => total + context.measureText(title.querySelector(selector).textContent).width, 0);
    const separatorWidth = title.querySelector(".versus").getBoundingClientRect().width;
    const available = Math.max(0, title.clientWidth - separatorWidth - 16);
    if (namesWidth > available && namesWidth > 0)
      title.style.fontSize = `${parseFloat(style.fontSize) * available / namesWidth}px`;
  };
  window.addEventListener("resize", fitTitle);

  controls.innerHTML = `
    <section class="match-team-row" aria-label="Team and venue filters">
      <div class="match-team-toggle" role="group" aria-label="Team">
        <span class="match-control-icon" title="Team" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4 3 6l2 5 3-1v10h8V10l3 1 2-5-4-2-2 2h-6z"/><path d="M9 6c.5 2 5.5 2 6 0"/></svg></span>
        ${[f.home_team_id, f.away_team_id].map((id) => `<button type="button" class="match-team-choice" data-match-team="${esc(id)}">${image("teams", id, teamNames.get(String(id)), "match-team-logo")}<span>${esc(teamNames.get(String(id)))}</span></button>`).join("")}
      </div>
      <div class="match-side-filter"><span class="pitch-venue-icon" title="Side filter" aria-hidden="true"><svg viewBox="0 0 32 32"><rect x="2" y="3" width="28" height="26" rx="2"/><path d="M16 3v26M2 10h5v12H2m28-12h-5v12h5M12 12h8v8h-8z"/></svg></span><button type="button" class="match-side-button" data-match-side aria-label="Filter by side" aria-pressed="false">Any</button></div>
    </section>
    <section class="match-competition-filter" aria-label="Competition history">
      <span class="match-control-icon" title="Competition" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v4m-4 3h12m-10-3h8"/></svg></span>
      <div class="match-competition-options" id="match-competitions"></div>
    </section>
    <section class="match-settings" aria-label="Match history settings">
      <span class="match-control-icon match-settings-icon" title="Statistics" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 3v18h18M6 16l5-5 4 3 6-8m-5 0h5v5"/></svg></span>
      <label class="match-control match-metric"><span class="sr-only">Metric</span><span class="match-select-wrap"><span class="match-selected-value" aria-hidden="true"></span><select id="match-stat" aria-label="Metric">${Object.entries(data.metrics).map(([key, label]) => `<option value="${esc(key)}">${esc(label)}</option>`).join("")}</select></span></label>
      <label class="match-control match-games-control"><span class="sr-only">Matches</span><select id="match-games" aria-label="Matches">${[3, 5, 10, 15, 20, Number(data.recent_games)].filter((n, i, xs) => n > 0 && xs.indexOf(n) === i).sort((a, b) => a - b).map((n) => `<option value="${n}">${n} matches</option>`).join("")}</select></label>
    </section>`;
  const stat = controls.querySelector("#match-stat");
  const selectedMetricValue = controls.querySelector(".match-selected-value");
  const competitionOptions = controls.querySelector("#match-competitions");
  stat.value = statValue;
  selectedMetricValue.textContent = `Metric: ${stat.selectedOptions[0]?.textContent || ""}`;
  const syncMatchUrl = () => {
    for (const [key, value] of [["team", teamValue], ["competition", competitionValue], ["stat", statValue], ["games", gameCount], ["venue", sideFilterOn ? "side" : "all"]]) params.set(key, value);
    history.replaceState(null, "", params.toString() ? `?${params}` : location.pathname);
  };
  const teamHistory = (id) => data.teams
    .filter((r) => String(r.source_team_id) === String(id) &&
      (competitionValue === "all" || String(r.historical_competition_id) === competitionValue))
    .sort((a, b) => Number(a.matches_ago) - Number(b.matches_ago));
  function renderSummary() {
    const chosenCompetition = competitionValue;
    const metadata = [f.home_team_id, f.away_team_id].map((id, i) => {
      const rows = teamHistory(id);
      const latest = rows[0];
      const fallback = (data.team_context || []).find((r) => String(r.source_team_id) === String(id));
      const managerName = latest?.manager_name || fallback?.manager_name;
      const formationName = latest?.team_starting_formation_name || fallback?.team_starting_formation_name;
      const venue = i === 0 ? "home" : "away";
      const sideRows = rows.filter((r) => r.historical_team_side === venue);
      return `<section class="team-meta ${i === 0 ? "team-meta-home" : "team-meta-away"}">
        <div class="meta-line">${managerName ? `<span class="meta-item">${icon("manager_icon", "Manager")}<span title="${esc(managerName)}">${esc(managerName)}</span></span>` : ""}${formationName ? `<span class="meta-item">${icon("formation_icon", "Formation")}<span>${esc(formatFormation(formationName))}</span></span>` : ""}</div>
        <div class="form-line"><small>Recent</small>${form(rows)}</div>
        <div class="form-line"><small>${i === 0 ? "Home" : "Away"}</small>${form(sideRows)}</div>
      </section>`;
    });
    summary.innerHTML = `<header class="match-heading">
      <h1 class="match-title"><span class="match-title-home">${esc(f.home_team)}</span><span class="versus">v</span><span class="match-title-away">${esc(f.away_team)}</span></h1>
      <div class="match-info"><span>${esc(f.competition)}</span><span>${esc(dates(f.scheduled_start_utc))}</span><span>${esc(kickoff(f.scheduled_start_utc))}</span></div>
      <div class="team-metadata">${metadata.join("")}</div>
    </header>`;
    fitTitle();
  }
  function renderCompetitionOptions() {
    const available = new Map(data.teams
      .filter((r) => String(r.source_team_id) === String(teamValue))
      .map((r) => [String(r.historical_competition_id), r.historical_competition_name]));
    competitionOptions.innerHTML = `<button type="button" data-match-competition="all">All</button>${[...available].sort((a, b) => a[1].localeCompare(b[1])).map(([id, label]) => `<button type="button" data-match-competition="${esc(id)}">${esc(label)}</button>`).join("")}`;
  }
  function render() {
    const previousScrollLeft = content.querySelector(".match-table-scroll")?.scrollLeft || 0;
    const selectedTeamSide = String(teamValue) === String(f.home_team_id) ? "home" : "away";
    const matches = teamHistory(teamValue)
      .filter((r) => !sideFilterOn || r.historical_team_side === selectedTeamSide)
      .slice(0, gameCount);
    const selectedMatchIndex = matches.length
      ? Math.min(gridSortMatchIndex, matches.length - 1)
      : 0;
    const sortArrow = (active) => active
      ? `<span class="grid-sort-arrow">${gridSortDirection < 0 ? "↓" : "↑"}</span>`
      : "";
    const playerHistory = data.players
      .filter((r) => String(r.source_team_id) === String(teamValue))
      .sort((a, b) => Number(b.matches_ago) - Number(a.matches_ago));
    const players = new Map(playerHistory.map((r) => [r.source_player_id, r]));
    const shirtNumbers = new Map();
    for (const row of [...playerHistory].sort((a, b) => Number(a.matches_ago) - Number(b.matches_ago))) {
      if (row.shirt_number != null && !shirtNumbers.has(row.source_player_id))
        shirtNumbers.set(row.source_player_id, row.shirt_number);
    }
    const cells = new Map(playerHistory.map((r) => [`${r.source_player_id}|${r.historical_match_id}`, r]));
    const shortDate = (value) => {
      const d = new Date(value);
      return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    };
    const score = (r) => r.historical_score_for == null || r.historical_score_against == null
      ? "—" : `${r.historical_score_for}–${r.historical_score_against}`;
    const competitionHeaders = matches.map((r) => `<th class="history-column">${historyEntity("competitions", r.historical_competition_id, r.historical_competition_name)}</th>`).join("");
    const dateHeaders = matches.map((r) => `<th class="history-column"><time>${shortDate(r.historical_match_date)}</time></th>`).join("");
    const opponentHeaders = matches.map((r, index) => {
      const side = r.historical_team_side === "home" ? "H" : "A";
      const result = resultCode(r.result);
      const sorted = gridSortKey === "match" && selectedMatchIndex === index;
      return `<th class="history-column${sorted ? " sorted-column" : ""}" aria-sort="${sorted ? (gridSortDirection < 0 ? "descending" : "ascending") : "none"}"><button type="button" class="history-header" data-grid-sort="match" data-grid-sort-index="${index}" title="Sort players by ${esc(statValue)} in this match · ${esc(r.historical_opponent_name)} · ${side}">
        <span class="history-opponent">${image("teams", r.historical_opponent_id, r.historical_opponent_name, "match-history-badge history-opponent-logo") || `<span class="history-opponent-fallback">${esc(r.historical_opponent_name)}</span>`}</span>
        <span class="history-venue ${side.toLowerCase()}">(${side})</span><span class="history-score ${esc(result)}">${score(r)}</span>${sortArrow(sorted)}
      </button></th>`;
    }).join("");
    const eventMarks = (r) => [
      Number(r.goals || 0) > 0 ? `<span class="event-mark goal-mark" title="${r.goals} goal${r.goals === 1 ? "" : "s"}">⚽${r.goals > 1 ? esc(r.goals) : ""}</span>` : "",
      Number(r.assists || 0) > 0 ? `<span class="event-mark assist-mark" title="${r.assists} assist${r.assists === 1 ? "" : "s"}">A${r.assists > 1 ? esc(r.assists) : ""}</span>` : "",
      Number(r.yellow_cards || 0) > 0 ? `<span class="event-mark yellow-mark" title="${r.yellow_cards} yellow card${r.yellow_cards === 1 ? "" : "s"}">Y${r.yellow_cards > 1 ? esc(r.yellow_cards) : ""}</span>` : "",
      Number(r.second_yellow_cards || 0) > 0 ? `<span class="event-mark yellow-mark" title="${r.second_yellow_cards} second yellow card${r.second_yellow_cards === 1 ? "" : "s"}">2Y${r.second_yellow_cards > 1 ? esc(r.second_yellow_cards) : ""}</span>` : "",
      Number(r.red_cards || 0) > 0 ? `<span class="event-mark red-mark" title="${r.red_cards} red card${r.red_cards === 1 ? "" : "s"}">R${r.red_cards > 1 ? esc(r.red_cards) : ""}</span>` : "",
    ].join("");
    const nameParts = (player) => String(player.player_name || player.player_display_name || "")
      .trim().split(/\s+/).filter(Boolean);
    const comparePlayerNames = (a, b) => {
      const aParts = nameParts(a);
      const bParts = nameParts(b);
      const surnameOrder = (aParts.at(-1) || "").localeCompare(
        bParts.at(-1) || "", undefined, { sensitivity: "base" },
      );
      return surnameOrder || aParts.slice(0, -1).join(" ").localeCompare(
        bParts.slice(0, -1).join(" "), undefined, { sensitivity: "base" },
      );
    };
    const compareNullable = (left, right) => {
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      return (left - right) * gridSortDirection;
    };
    const orderedPlayers = [...players.values()].sort((a, b) => {
      let comparison = 0;
      if (gridSortKey === "number") {
        comparison = compareNullable(
          shirtNumbers.get(a.source_player_id), shirtNumbers.get(b.source_player_id),
        );
      } else if (gridSortKey === "player") {
        comparison = gridSortDirection * comparePlayerNames(a, b);
      } else if (matches.length) {
        const matchId = matches[selectedMatchIndex].historical_match_id;
        const aCell = cells.get(`${a.source_player_id}|${matchId}`);
        const bCell = cells.get(`${b.source_player_id}|${matchId}`);
        const aValue = Number(aCell?.seconds_played) > 0 ? Number(aCell?.[statValue] || 0) : null;
        const bValue = Number(bCell?.seconds_played) > 0 ? Number(bCell?.[statValue] || 0) : null;
        comparison = compareNullable(aValue, bValue);
      }
      return comparison || comparePlayerNames(a, b);
    });
    const playerRows = orderedPlayers.map((p) => {
      const matchCells = matches.map((m) => {
        const r = cells.get(`${p.source_player_id}|${m.historical_match_id}`);
        if (!r) return '<td class="match-cell"></td>';
        if (!(Number(r.seconds_played) > 0)) return `<td class="match-cell"><span class="bench-icon" title="Named substitute; did not play" aria-label="Named substitute; did not play"><img class="bench-icon-image" src="${root}assets/images/icons/unused_sub.png" alt=""></span></td>`;
        const participation = r.started === true
          ? '<span class="participation-label started" title="Started" aria-label="Started">XI</span>'
          : r.subbed_on === true ? '<span class="participation-label subbed-on" title="Subbed on" aria-label="Subbed on">ON</span>' : "";
        const value = r[statValue] == null ? 0 : r[statValue];
        return `<td class="match-cell"><div class="played-cell"><span class="cell-participation">${participation}</span><span class="minute-value">${Math.round(r.minutes_played || 0)}′</span><strong>${esc(value)}</strong><span class="position-badge">${esc(r.match_position || "")}</span><span class="cell-events">${eventMarks(r)}</span></div></td>`;
      }).join("");
      const shirtNumber = shirtNumbers.get(p.source_player_id);
      const playerName = p.player_display_name || p.player_name;
      const position = p.usual_position || p.dominant_position || p.position || "";
      return `<tr><td class="shirt-column">${shirtNumber == null ? "" : esc(shirtNumber)}</td><td class="player-column"><span class="player-grid-name" title="${esc(p.player_name)}">${esc(playerName)}</span>${position ? `<span class="player-position">${esc(position)}</span>` : ""}</td>${matchCells}</tr>`;
    }).join("");
    renderSummary();
    for (const button of controls.querySelectorAll("[data-match-team]")) {
      const active = String(button.dataset.matchTeam) === String(teamValue);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    for (const button of controls.querySelectorAll("[data-match-competition]")) {
      const active = button.dataset.matchCompetition === competitionValue;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    const sideButton = controls.querySelector("[data-match-side]");
    sideButton.textContent = sideFilterOn ? (selectedTeamSide === "home" ? "Home" : "Away") : "Any";
    sideButton.classList.toggle("active", sideFilterOn);
    sideButton.setAttribute("aria-pressed", String(sideFilterOn));
    const numberSort = gridSortKey === "number";
    const playerSort = gridSortKey === "player";
    content.innerHTML = matches.length
      ? `<div class="match-grid-stack"><div class="history-meta-scroll"><table class="history-meta-grid" aria-hidden="true"><tbody><tr><td class="shirt-column"></td><td class="player-column"></td>${competitionHeaders}</tr><tr><td class="shirt-column"></td><td class="player-column"></td>${dateHeaders}</tr></tbody></table></div><div class="scroll match-table-scroll"><table class="match-grid"><thead><tr><th class="shirt-column${numberSort ? " sorted-column" : ""}" aria-sort="${numberSort ? (gridSortDirection < 0 ? "descending" : "ascending") : "none"}"><button type="button" class="grid-text-sort" data-grid-sort="number">#${sortArrow(numberSort)}</button></th><th class="player-column${playerSort ? " sorted-column" : ""}" aria-sort="${playerSort ? (gridSortDirection < 0 ? "descending" : "ascending") : "none"}"><button type="button" class="grid-text-sort" data-grid-sort="player">Player${sortArrow(playerSort)}</button></th>${opponentHeaders}</tr></thead><tbody>${playerRows}</tbody></table></div></div>`
      : empty();
    const metaScroll = content.querySelector(".history-meta-scroll");
    const tableScroll = content.querySelector(".match-table-scroll");
    if (metaScroll && tableScroll) {
      let syncing = false;
      const syncScroll = (source, target) => {
        if (syncing) return;
        syncing = true;
        target.scrollLeft = source.scrollLeft;
        syncing = false;
      };
      metaScroll.addEventListener("scroll", () => syncScroll(metaScroll, tableScroll), { passive: true });
      tableScroll.addEventListener("scroll", () => syncScroll(tableScroll, metaScroll), { passive: true });
      tableScroll.scrollLeft = previousScrollLeft;
      metaScroll.scrollLeft = previousScrollLeft;
    }
    syncMatchUrl();
  }
  controls.addEventListener("click", (event) => {
    const teamButton = event.target.closest("[data-match-team]");
    const compButton = event.target.closest("[data-match-competition]");
    const sideButton = event.target.closest("[data-match-side]");
    if (teamButton) {
      teamValue = teamButton.dataset.matchTeam;
      competitionValue = "all";
      gridSortKey = "match";
      gridSortMatchIndex = 0;
      gridSortDirection = -1;
      renderCompetitionOptions();
      render();
    } else if (compButton) {
      competitionValue = compButton.dataset.matchCompetition;
      render();
    } else if (sideButton) {
      sideFilterOn = !sideFilterOn;
      gridSortKey = "match";
      gridSortMatchIndex = 0;
      gridSortDirection = -1;
      render();
    }
  });
  content.addEventListener("click", (event) => {
    const sortButton = event.target.closest("button[data-grid-sort]");
    if (!sortButton) return;
    const key = sortButton.dataset.gridSort;
    const index = Number(sortButton.dataset.gridSortIndex || 0);
    if (gridSortKey === key && (key !== "match" || gridSortMatchIndex === index)) {
      gridSortDirection *= -1;
    } else {
      gridSortKey = key;
      gridSortMatchIndex = index;
      gridSortDirection = key === "match" ? -1 : 1;
    }
    render();
  });
  stat.addEventListener("change", () => {
    statValue = stat.value;
    selectedMetricValue.textContent = `Metric: ${stat.selectedOptions[0]?.textContent || ""}`;
    render();
  });
  const gamesSelect = controls.querySelector("#match-games");
  gamesSelect.value = String(gameCount);
  gamesSelect.addEventListener("change", () => {
    gameCount = Number(gamesSelect.value);
    render();
  });
  renderCompetitionOptions();
  render();
}

function showError(e) {
  content.innerHTML =
    '<p class="empty">Could not load the generated data. Serve this directory over HTTP and regenerate the site if needed.</p>';

  console.error(e);
}

start().catch(showError);
