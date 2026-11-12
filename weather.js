/* Weather Dashboard: Fetch API + async/await, error handling, nested JSON rendering */
(function () {
  "use strict";

  var GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
  var FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
  var TIMEOUT_MS = 10000;
  var RECENT_KEY = "weather.recent.v1";
  var UNIT_KEY = "weather.unit.v1";

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    form: $("search-form"), city: $("city"), alert: $("alert"), alertText: $("alert-text"),
    retry: $("retry"), loading: $("loading"), result: $("result"), place: $("place"),
    stamp: $("stamp"), icon: $("icon"), temp: $("temp"), cond: $("cond"), metrics: $("metrics"),
    forecast: $("forecast"), others: $("others"), othersList: $("others-list"),
    recent: $("recent"), recentWrap: $("recent-wrap"), unit: $("unit")
  };

  var state = { unit: "c", places: [], data: null, place: null, recent: [], controller: null, lastAction: null };

  /* WMO weather codes returned by Open-Meteo */
  var CODES = {
    0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
    45: ["Fog", "🌫️"], 48: ["Freezing fog", "🌫️"], 51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"],
    55: ["Heavy drizzle", "🌦️"], 56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"],
    61: ["Light rain", "🌧️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"], 66: ["Freezing rain", "🌧️"],
    67: ["Freezing rain", "🌧️"], 71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"],
    77: ["Snow grains", "❄️"], 80: ["Rain showers", "🌦️"], 81: ["Rain showers", "🌧️"], 82: ["Violent showers", "⛈️"],
    85: ["Snow showers", "🌨️"], 86: ["Heavy snow showers", "❄️"], 95: ["Thunderstorm", "⛈️"],
    96: ["Thunderstorm with hail", "⛈️"], 99: ["Thunderstorm with hail", "⛈️"]
  };
  function describe(code) { return CODES[code] || ["Unknown conditions", "🌡️"]; }

  /* ---------- Errors ---------- */
  function AppError(kind, message) { this.kind = kind; this.message = message; }
  AppError.prototype = Object.create(Error.prototype);

  /* ---------- Fetch helper: network, timeout, HTTP and JSON errors ---------- */
  async function fetchJSON(url, signal) {
    var res;
    try {
      res = await fetch(url, { signal: signal });
    } catch (err) {
      if (err.name === "AbortError") throw err;
      throw new AppError("network", "Could not reach the weather service. Check your internet connection and try again.");
    }
    if (!res.ok) {
      throw new AppError("http", res.status >= 500
        ? "The weather service is having problems right now (error " + res.status + "). Please try again soon."
        : "The weather service rejected the request (error " + res.status + ").");
    }
    try {
      return await res.json();
    } catch (err) {
      throw new AppError("parse", "The weather service sent data that could not be read.");
    }
  }

  /* ---------- Request runner: loading state, timeout, cancel older requests ---------- */
  async function run(task) {
    if (state.controller) state.controller.abort();
    var controller = new AbortController();
    state.controller = controller;
    state.lastAction = function () { return run(task); };
    var timedOut = false;
    var timer = setTimeout(function () { timedOut = true; controller.abort(); }, TIMEOUT_MS);
    hideError();
    els.loading.hidden = false;
    try {
      await task(controller.signal);
    } catch (err) {
      if (state.controller !== controller) return;           // replaced by a newer search
      if (err.name === "AbortError") {
        showError(timedOut ? "The request took too long. Please try again." : "The request was cancelled.");
      } else if (err instanceof AppError) {
        showError(err.message);
      } else {
        showError("Something went wrong while showing the weather. Please try again.");
        console.error(err);
      }
    } finally {
      clearTimeout(timer);
      if (state.controller === controller) els.loading.hidden = true;
    }
  }
  function showError(msg) { els.alertText.textContent = msg; els.alert.hidden = false; }
  function hideError() { els.alert.hidden = true; }

  /* ---------- API calls ---------- */
  async function searchCity(query, signal) {
    var url = GEO_URL + "?name=" + encodeURIComponent(query) + "&count=5&language=en&format=json";
    var geo = await fetchJSON(url, signal);
    var places = Array.isArray(geo.results) ? geo.results : [];       // key is missing when nothing matches
    if (!places.length) {
      throw new AppError("notfound", "No city found for “" + query + "”. Check the spelling or try a nearby city.");
    }
    state.places = places;
    await loadPlace(places[0], signal);
  }

  async function loadPlace(place, signal) {
    var url = FORECAST_URL +
      "?latitude=" + encodeURIComponent(place.latitude) + "&longitude=" + encodeURIComponent(place.longitude) +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,precipitation" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&forecast_days=5&timezone=auto";
    var data = await fetchJSON(url, signal);
    if (!data || !data.current || !data.daily || !Array.isArray(data.daily.time)) {
      throw new AppError("parse", "The weather data was incomplete. Please try again.");
    }
    state.data = data;
    state.place = place;
    rememberPlace(place);
    render();
  }

  /* ---------- Formatting ---------- */
  function temp(c) {
    if (typeof c !== "number") return "–";
    return state.unit === "f" ? Math.round(c * 9 / 5 + 32) + "°F" : Math.round(c) + "°C";
  }
  function compass(deg) {
    if (typeof deg !== "number") return "";
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
  }
  function label(p) { return [p.name, p.admin1, p.country].filter(Boolean).join(", "); }

  /* ---------- Rendering nested JSON into the DOM ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function metric(name, value) {
    var li = el("li");
    li.append(el("strong", "", value), document.createTextNode(name));
    return li;
  }
  function render() {
    var d = state.data, c = d.current, u = d.current_units || {};
    var info = describe(c.weather_code);

    els.place.textContent = label(state.place);
    els.stamp.textContent = "Local time at last update: " + String(c.time).replace("T", " ") + (d.timezone ? " (" + d.timezone + ")" : "");
    els.icon.textContent = info[1];
    els.temp.textContent = temp(c.temperature_2m);
    els.cond.textContent = info[0];

    els.metrics.replaceChildren(
      metric("Feels like", temp(c.apparent_temperature)),
      metric("Humidity", c.relative_humidity_2m + (u.relative_humidity_2m || "%")),
      metric("Wind speed", c.wind_speed_10m + " " + (u.wind_speed_10m || "km/h") + " " + compass(c.wind_direction_10m)),
      metric("Pressure", Math.round(c.surface_pressure) + " " + (u.surface_pressure || "hPa")),
      metric("Precipitation", c.precipitation + " " + (u.precipitation || "mm"))
    );

    var daily = d.daily;
    els.forecast.replaceChildren.apply(els.forecast, daily.time.map(function (day, i) {
      var fi = describe(daily.weather_code[i]);
      var li = el("li");
      var date = new Date(day + "T00:00:00");
      li.append(
        el("span", "day", date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })),
        el("span", "fi", fi[1]),
        el("span", "", fi[0]),
        el("span", "range", temp(daily.temperature_2m_max[i]) + " / " + temp(daily.temperature_2m_min[i])),
        el("span", "muted", "Rain chance: " + (daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : "–") + "%")
      );
      li.lastChild.setAttribute("aria-label", "Chance of rain " + (daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : "unknown") + " percent");
      return li;
    }));

    var alt = state.places.filter(function (p) { return p !== state.place; });
    els.others.hidden = !alt.length;
    els.othersList.replaceChildren.apply(els.othersList, alt.map(function (p) {
      var li = el("li"), b = el("button", "", label(p));
      b.type = "button"; b.setAttribute("data-place", String(state.places.indexOf(p)));
      li.append(b); return li;
    }));

    renderRecent();
    els.unit.textContent = "Showing °" + state.unit.toUpperCase();
    els.unit.setAttribute("aria-pressed", String(state.unit === "f"));
    els.unit.setAttribute("aria-label", state.unit === "f" ? "Show temperatures in Celsius" : "Show temperatures in Fahrenheit");
    els.result.hidden = false;
  }

  /* ---------- Storage (guarded) ---------- */
  function readStore(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; } catch (e) { return fallback; }
  }
  function writeStore(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ } }
  function rememberPlace(p) {
    var slim = { name: p.name, admin1: p.admin1, country: p.country, latitude: p.latitude, longitude: p.longitude };
    state.recent = [slim].concat(state.recent.filter(function (r) { return r.latitude !== slim.latitude || r.longitude !== slim.longitude; })).slice(0, 5);
    writeStore(RECENT_KEY, state.recent);
  }
  function renderRecent() {
    els.recentWrap.hidden = !state.recent.length;
    els.recent.replaceChildren.apply(els.recent, state.recent.map(function (p, i) {
      var li = el("li"), b = el("button", "", p.name);
      b.type = "button"; b.setAttribute("data-recent", String(i)); b.title = label(p);
      li.append(b); return li;
    }));
  }

  /* ---------- Events ---------- */
  els.form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = els.city.value.trim();
    if (!q) { showError("Enter a city name to search."); els.city.focus(); return; }
    run(function (signal) { return searchCity(q, signal); });
  });
  els.recent.addEventListener("click", function (e) {
    var b = e.target.closest("[data-recent]"); if (!b) return;
    var p = state.recent[Number(b.getAttribute("data-recent"))];
    if (p) { state.places = [p]; run(function (signal) { return loadPlace(p, signal); }); }
  });
  els.othersList.addEventListener("click", function (e) {
    var b = e.target.closest("[data-place]"); if (!b) return;
    var p = state.places[Number(b.getAttribute("data-place"))];
    if (p) run(function (signal) { return loadPlace(p, signal); });
  });
  els.unit.addEventListener("click", function () {
    state.unit = state.unit === "c" ? "f" : "c";
    writeStore(UNIT_KEY, state.unit);
    if (state.data) render(); else els.unit.textContent = "Showing °" + state.unit.toUpperCase();
  });
  els.retry.addEventListener("click", function () { if (state.lastAction) state.lastAction(); });

  /* ---------- Start ---------- */
  state.unit = readStore(UNIT_KEY, "c") === "f" ? "f" : "c";
  state.recent = (readStore(RECENT_KEY, []) || []).filter(function (p) { return p && typeof p.latitude === "number"; });
  els.unit.textContent = "Showing °" + state.unit.toUpperCase();
  renderRecent();
  if (state.recent.length) {
    var first = state.recent[0];
    state.places = [first];
    run(function (signal) { return loadPlace(first, signal); });
  } else {
    run(function (signal) { return searchCity("Pune", signal); });
  }
})();
