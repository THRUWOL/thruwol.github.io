const HISTORY_KEY = "bionic-lab-attempts-v1";
const SETTINGS_KEY = "bionic-lab-settings-v1";
const HISTORY_MAX = 20;
const PREVIEW_TEXT = "Бионический шрифт выделяет начало слов, чтобы взгляд цеплялся за якоря и мозг достраивал хвост.";
const FIXATION_RATIO = [0.28, 0.36, 0.44, 0.55, 0.68];

const state = {
  view: "intro",
  texts: null,
  order: ["regular", "bionic"],
  pass: 0,
  fromWiki: false,
  loading: false,
  loadError: "",
  elapsed: { regular: null, bionic: null },
  scores: { regular: null, bionic: null },
  running: false,
  startedAt: 0,
  acc: 0,
  tick: null,
  settings: loadSettings(),
};

const stage = document.getElementById("stage");
const timerEl = document.getElementById("timer");
const digitsEl = document.getElementById("timerDigits");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return {
      fixation: clampInt(raw.fixation, 1, 5, 3),
      opacity: clampInt(raw.opacity, 40, 100, 80),
      every: clampInt(raw.every, 1, 3, 1),
    };
  } catch (_error) {
    return { fixation: 3, opacity: 80, every: 1 };
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function fixationCount(len, level = state.settings.fixation) {
  if (len <= 1) return 1;
  const n = Math.ceil(len * FIXATION_RATIO[level - 1]);
  return Math.min(len, Math.max(1, n));
}

function toBionic(text, settings = state.settings) {
  let index = 0;
  const opacity = settings.opacity / 100;
  return text.replace(/([A-Za-zА-Яа-яЁё]+)|([^A-Za-zА-Яа-яЁё]+)/g, (all, word, other) => {
    if (other) return escapeHtml(other);
    index += 1;
    if (settings.every > 1 && index % settings.every !== 1) {
      return `<span class="bionic-tail" style="opacity:${opacity}">${escapeHtml(word)}</span>`;
    }
    const n = Math.min(fixationCount(word.length, settings.fixation), word.length);
    const head = `<b>${escapeHtml(word.slice(0, n))}</b>`;
    const tail = word.slice(n);
    if (!tail) return head;
    return `${head}<span class="bionic-tail" style="opacity:${opacity}">${escapeHtml(tail)}</span>`;
  });
}

function settingsLabel(settings = state.settings) {
  const every =
    settings.every === 1 ? "каждое слово" : settings.every === 2 ? "через одно" : "каждое третье";
  return `выделение ${settings.fixation}, хвост ${settings.opacity}%, ${every}`;
}

function formatTime(ms) {
  const total = Math.max(0, ms);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const tenths = Math.floor((total % 1000) / 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function nowElapsed() {
  return state.acc + (state.running ? Date.now() - state.startedAt : 0);
}

function renderTimer() {
  digitsEl.textContent = formatTime(nowElapsed());
  timerEl.classList.toggle("running", state.running);
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  state.startedAt = Date.now();
  state.tick = setInterval(renderTimer, 80);
  renderTimer();
}

function stopTimer() {
  if (!state.running) return nowElapsed();
  state.acc = nowElapsed();
  state.running = false;
  clearInterval(state.tick);
  renderTimer();
  return state.acc;
}

function resetTimer() {
  state.running = false;
  state.startedAt = 0;
  state.acc = 0;
  clearInterval(state.tick);
  renderTimer();
}

function wordsPerMinute(words, ms) {
  if (!ms) return 0;
  return Math.round((words / (ms / 1000)) * 60);
}

function currentKind() {
  return state.order[state.pass];
}

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch (_error) {
    return [];
  }
}

function saveAttempt(entry) {
  const list = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

function buildTexts(pair) {
  let [first, second] = pair.articles;
  if (Math.random() < 0.5) [first, second] = [second, first];
  const order = shuffle(["regular", "bionic"]);
  return {
    order,
    sourceTitle: pair.sourceTitle || first.sourceTitle,
    url: pair.url || first.url || "",
    regular: {
      title: "Обычный шрифт",
      phase: "regular",
      body: first.body,
      sourceTitle: first.sourceTitle,
      url: first.url || "",
      questions: generateQuestions(first.body, second.body),
    },
    bionic: {
      title: "Бионический шрифт",
      phase: "bionic",
      body: second.body,
      sourceTitle: second.sourceTitle,
      url: second.url || "",
      questions: generateQuestions(second.body, first.body),
    },
  };
}

let loadPromise = null;

async function prepareTexts() {
  if (state.texts) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    state.loading = true;
    state.loadError = "";
    if (state.view === "intro") render();
    try {
      const pair = await loadTestTexts();
      state.fromWiki = Boolean(pair.fromWiki);
      state.texts = buildTexts(pair);
      state.order = state.texts.order;
      if (!state.fromWiki) {
        state.loadError = "Википедия сейчас недоступна, взяты запасные абзацы одной темы.";
      }
    } finally {
      state.loading = false;
      loadPromise = null;
    }
  })();
  return loadPromise;
}

function persistHistory() {
  const regular = state.texts.regular;
  const bionic = state.texts.bionic;
  const a = state.elapsed.regular;
  const b = state.elapsed.bionic;
  let faster = "tie";
  if (a - b > 400) faster = "bionic";
  if (b - a > 400) faster = "regular";
  saveAttempt({
    at: new Date().toISOString(),
    article: state.texts.sourceTitle,
    first: state.order[0],
    regularMs: a,
    bionicMs: b,
    regularWpm: wordsPerMinute(wordCount(regular.body), a),
    bionicWpm: wordsPerMinute(wordCount(bionic.body), b),
    regularScore: state.scores.regular,
    bionicScore: state.scores.bionic,
    regularMax: regular.questions.length,
    bionicMax: bionic.questions.length,
    faster,
    settings: { ...state.settings },
  });
}

function render() {
  if (state.view === "intro") return renderIntro();
  if (state.view === "read") return renderRead(currentKind());
  if (state.view === "quiz") return renderQuiz(currentKind());
  return renderResults();
}

function renderIntro() {
  resetTimer();
  const busy = state.loading;
  const tries = loadHistory().length;
  const s = state.settings;
  stage.innerHTML = `
    <section class="card">
      <h2>Как проходит тест</h2>
      <p class="lead">Два абзаца берутся из одной статьи Википедии — тема общая, сравнивается шрифт. Какой вариант будет первым, выбирается случайно. После каждого абзаца — вопросы по тому, что было именно в нём.</p>
      <ol class="steps">
        <li><span class="num">1</span><span>Сайт нарезает два соседних абзаца одной статьи.</span></li>
        <li><span class="num">2</span><span>Секундомер стартует вместе с текстом. Прочитайте абзац один раз.</span></li>
        <li><span class="num">3</span><span>Ответьте на вопросы. Затем второй абзац в другом начертании.</span></li>
      </ol>
    </section>
    <section class="card settings-card">
      <h2>Настройка шрифта</h2>
      <p class="note">Подберите вид до старта — так пойдёт бионический абзац. Настройки запоминаются в браузере.</p>
      <div class="setting">
        <div class="setting-row">
          <span>Выделение начала</span>
          <strong id="fixVal">${s.fixation}</strong>
        </div>
        <input type="range" id="fixRange" min="1" max="5" step="1" value="${s.fixation}" aria-label="Выделение начала слова" />
        <p class="setting-hint">1 — чуть-чуть, 5 — почти всё слово жирное.</p>
      </div>
      <div class="setting">
        <div class="setting-row">
          <span>Хвост слова</span>
          <strong id="opVal">${s.opacity}%</strong>
        </div>
        <input type="range" id="opRange" min="40" max="100" step="5" value="${s.opacity}" aria-label="Прозрачность хвоста слова" />
        <p class="setting-hint">Ниже — бледнее остаток слова.</p>
      </div>
      <div class="setting">
        <div class="setting-row">
          <span>Какие слова выделять</span>
        </div>
        <select id="everySelect" aria-label="Какие слова выделять">
          <option value="1"${s.every === 1 ? " selected" : ""}>каждое слово</option>
          <option value="2"${s.every === 2 ? " selected" : ""}>через одно</option>
          <option value="3"${s.every === 3 ? " selected" : ""}>каждое третье</option>
        </select>
      </div>
      <p class="setting-hint">Предпросмотр</p>
      <p class="passage preview" id="bionicPreview"></p>
      <p class="note">${busy ? "Ищу статью, из которой получаются два сопоставимых абзаца…" : state.loadError || (tries ? `Сохранено попыток на этом устройстве: ${tries}.` : "Попытки сохраняются в браузере, чтобы можно было сравнить заходы.")}</p>
      <div class="actions">
        <button class="primary" id="startTest" ${busy ? "disabled" : ""}>${busy ? "Загрузка…" : state.texts ? "Начать чтение" : "Загрузить тексты из Википедии"}</button>
      </div>
    </section>
  `;
  bindSettings();
  document.getElementById("startTest").onclick = async () => {
    await prepareTexts();
    if (!state.texts) return;
    state.pass = 0;
    state.elapsed = { regular: null, bionic: null };
    state.scores = { regular: null, bionic: null };
    state.view = "read";
    render();
  };
}

function bindSettings() {
  const fixRange = document.getElementById("fixRange");
  const opRange = document.getElementById("opRange");
  const everySelect = document.getElementById("everySelect");
  const preview = document.getElementById("bionicPreview");
  if (!fixRange || !opRange || !everySelect || !preview) return;

  const paint = () => {
    document.getElementById("fixVal").textContent = String(state.settings.fixation);
    document.getElementById("opVal").textContent = `${state.settings.opacity}%`;
    preview.innerHTML = toBionic(PREVIEW_TEXT);
    saveSettings();
  };

  fixRange.oninput = () => {
    state.settings.fixation = Number(fixRange.value);
    paint();
  };
  opRange.oninput = () => {
    state.settings.opacity = Number(opRange.value);
    paint();
  };
  everySelect.onchange = () => {
    state.settings.every = Number(everySelect.value);
    paint();
  };
  paint();
}

function renderRead(kind) {
  const item = state.texts[kind];
  const html = kind === "bionic" ? toBionic(item.body) : escapeHtml(item.body);
  resetTimer();
  stage.innerHTML = `
    <section class="card">
      <span class="phase ${item.phase}">Абзац ${state.pass + 1} из 2 · ${item.title}</span>
      <h2>Прочитайте абзац</h2>
      <p class="note" id="hint">Секундомер ещё не запущен. Когда будете готовы, нажмите «Начать чтение».</p>
      <article class="passage hidden-text" id="passage">${html}</article>
      <p class="meta">${wordCount(item.body)} слов · два абзаца одной статьи, CC BY-SA</p>
      <div class="actions">
        <button class="primary" id="toggleRead">Начать чтение</button>
      </div>
    </section>
  `;

  const passage = document.getElementById("passage");
  const hint = document.getElementById("hint");
  const btn = document.getElementById("toggleRead");
  let started = false;

  btn.onclick = () => {
    if (!started) {
      started = true;
      passage.classList.remove("hidden-text");
      hint.textContent = "Читайте. Когда закончите, нажмите «Я прочитал».";
      btn.textContent = "Я прочитал";
      startTimer();
      return;
    }
    state.elapsed[kind] = stopTimer();
    state.view = "quiz";
    render();
  };
}

function renderQuiz(kind) {
  const item = state.texts[kind];
  const questions = item.questions
    .map((q, i) => `
      <div class="question">
        <p>${i + 1}. ${escapeHtml(q.q)}</p>
        <div class="choices">
          ${q.options
            .map(
              (opt, j) => `
            <label class="choice">
              <input type="radio" name="q${i}" value="${j}" />
              <span>${escapeHtml(opt)}</span>
            </label>
          `
            )
            .join("")}
        </div>
      </div>
    `)
    .join("");

  stage.innerHTML = `
    <section class="card">
      <span class="phase ${item.phase}">Вопросы · ${item.title}</span>
      <h2>Что было в этом абзаце?</h2>
      <p class="note">Текст скрыт. Время чтения: <strong>${formatTime(state.elapsed[kind])}</strong>${item.questions.length ? "" : " Вопросов к этому отрывку не получилось — это редкий случай."}</p>
      <form class="quiz">${questions}</form>
      <div class="actions">
        <button class="primary" id="submitQuiz">Дальше</button>
      </div>
    </section>
  `;

  document.getElementById("submitQuiz").onclick = () => {
    if (!item.questions.length) {
      state.scores[kind] = 0;
    } else {
      let score = 0;
      const missing = item.questions.some((q, i) => {
        const chosen = document.querySelector(`input[name="q${i}"]:checked`);
        if (!chosen) return true;
        if (Number(chosen.value) === q.answer) score += 1;
        return false;
      });
      if (missing) {
        alert("Ответьте на все вопросы.");
        return;
      }
      state.scores[kind] = score;
    }
    if (state.pass === 0) {
      state.pass = 1;
      state.view = "read";
    } else {
      persistHistory();
      state.view = "results";
    }
    render();
  };
}

function sourceLink(item) {
  const title = escapeHtml(item.sourceTitle || "статья Википедии");
  if (!item.url) return title;
  return `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${title}</a>`;
}

function fontLabel(kind) {
  return kind === "bionic" ? "бионический" : "обычный";
}

function renderHistory() {
  const rows = loadHistory();
  if (!rows.length) return "";
  const body = rows
    .map((row) => {
      const when = new Date(row.at).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const first = fontLabel(row.first);
      const conf = row.settings ? `<div class="history-settings">${escapeHtml(settingsLabel(row.settings))}</div>` : "";
      return `<tr>
        <td>${escapeHtml(when)}${conf}</td>
        <td>${escapeHtml(first)}</td>
        <td>${formatTime(row.regularMs)} · ${row.regularWpm} сл/мин · ${row.regularScore}/${row.regularMax}</td>
        <td>${formatTime(row.bionicMs)} · ${row.bionicWpm} сл/мин · ${row.bionicScore}/${row.bionicMax}</td>
      </tr>`;
    })
    .join("");
  return `
    <div class="history">
      <h2>История попыток</h2>
      <p class="note">Только на этом устройстве и в этом браузере.</p>
      <div class="history-scroll">
        <table>
          <thead>
            <tr>
              <th>Когда</th>
              <th>Первым</th>
              <th>Обычный</th>
              <th>Бионический</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <button class="ghost" id="clearHistory" type="button">Очистить историю</button>
    </div>
  `;
}

function renderResults() {
  resetTimer();
  const a = state.elapsed.regular;
  const b = state.elapsed.bionic;
  const diff = a - b;
  const percent = a ? Math.round((Math.abs(diff) / a) * 100) : 0;
  let verdict;
  if (diff > 400) {
    verdict = `Бионический абзац вы прочитали быстрее на ${formatTime(diff)} (${percent}%). Первым был ${fontLabel(state.order[0])} шрифт.`;
  } else if (diff < -400) {
    verdict = `Обычный абзац вы прочитали быстрее на ${formatTime(Math.abs(diff))} (${percent}%). Первым был ${fontLabel(state.order[0])} шрифт.`;
  } else {
    verdict = `По времени оба абзаца получились почти одинаково. Первым был ${fontLabel(state.order[0])} шрифт.`;
  }

  const regular = state.texts.regular;
  const bionic = state.texts.bionic;

  stage.innerHTML = `
    <section class="card">
      <h2>Результат</h2>
      <div class="results">
        <div class="result">
          <span>Обычный шрифт</span>
          <strong>${formatTime(a)}</strong>
          <p class="meta">${wordsPerMinute(wordCount(regular.body), a)} слов/мин · вопросы ${state.scores.regular}/${regular.questions.length || 0}</p>
        </div>
        <div class="result">
          <span>Бионический шрифт</span>
          <strong>${formatTime(b)}</strong>
          <p class="meta">${wordsPerMinute(wordCount(bionic.body), b)} слов/мин · вопросы ${state.scores.bionic}/${bionic.questions.length || 0}</p>
        </div>
      </div>
      <div class="verdict"><p>${verdict}</p></div>
      <p class="answers">Бионический шрифт: ${escapeHtml(settingsLabel())}. Источник: ${sourceLink(state.texts)}. Два абзаца одной статьи, CC BY-SA. Вопросы проверяют, что вы читали именно этот кусок, а не соседний.</p>
      ${renderHistory()}
      <div class="actions">
        <button class="primary" id="restart">Ещё попытка</button>
      </div>
    </section>
  `;

  document.getElementById("restart").onclick = async () => {
    state.view = "intro";
    state.texts = null;
    state.pass = 0;
    state.elapsed = { regular: null, bionic: null };
    state.scores = { regular: null, bionic: null };
    render();
    await prepareTexts();
    render();
  };

  const clearBtn = document.getElementById("clearHistory");
  if (clearBtn) {
    clearBtn.onclick = () => {
      clearHistory();
      render();
    };
  }
}

render();
prepareTexts().then(() => {
  if (state.view === "intro") render();
});
