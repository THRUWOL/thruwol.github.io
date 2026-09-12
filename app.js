const state = {
  view: "intro",
  texts: null,
  fromWiki: false,
  loading: false,
  loadError: "",
  elapsed: { regular: null, bionic: null },
  scores: { regular: null, bionic: null },
  running: false,
  startedAt: 0,
  acc: 0,
  tick: null,
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

function fixationCount(len) {
  if (len <= 3) return 1;
  if (len <= 6) return 2;
  if (len <= 9) return 3;
  if (len <= 12) return 4;
  return Math.ceil(len * 0.4);
}

function toBionic(text) {
  return text.replace(/([A-Za-zА-Яа-яЁё]+)|([^A-Za-zА-Яа-яЁё]+)/g, (all, word, other) => {
    if (other) return escapeHtml(other);
    const n = Math.min(fixationCount(word.length), word.length);
    return `<b>${escapeHtml(word.slice(0, n))}</b>${escapeHtml(word.slice(n))}`;
  });
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

function buildTexts(pair) {
  const extras = pair.extras || [];
  return ["regular", "bionic"].reduce((acc, kind, index) => {
    const article = pair.articles[index];
    const payload = {
      body: article.body,
      sourceTitle: article.sourceTitle || article.title,
    };
    acc[kind] = {
      title: kind === "regular" ? "Обычный шрифт" : "Бионический шрифт",
      phase: kind,
      body: article.body,
      sourceTitle: payload.sourceTitle,
      url: article.url || "",
      questions: generateQuestions(payload, extras),
    };
    return acc;
  }, {});
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
      if (!state.fromWiki) {
        state.loadError = "Википедия сейчас недоступна, взяты запасные абзацы.";
      }
    } finally {
      state.loading = false;
      loadPromise = null;
    }
  })();
  return loadPromise;
}

function render() {
  if (state.view === "intro") return renderIntro();
  if (state.view === "read-regular") return renderRead("regular");
  if (state.view === "quiz-regular") return renderQuiz("regular");
  if (state.view === "read-bionic") return renderRead("bionic");
  if (state.view === "quiz-bionic") return renderQuiz("bionic");
  return renderResults();
}

function renderIntro() {
  resetTimer();
  const busy = state.loading;
  stage.innerHTML = `
    <section class="card">
      <h2>Как проходит тест</h2>
      <p class="lead">Каждый запуск берёт два разных отрывка из русской Википедии. Сначала обычный шрифт и секундомер, затем бионический — начало каждого слова жирным. После каждого текста будут вопросы по прочитанному.</p>
      <ol class="steps">
        <li><span class="num">1</span><span>Сайт сам подтягивает два новых отрывка из Википедии.</span></li>
        <li><span class="num">2</span><span>Секундомер стартует вместе с текстом. Прочитайте абзац один раз.</span></li>
        <li><span class="num">3</span><span>Ответьте на вопросы. Потом то же самое со вторым абзацем.</span></li>
      </ol>
      <p class="note">${busy ? "Ищу подходящие статьи и выравниваю длину отрывков…" : state.loadError || "Тексты каждый раз новые. Короткие заглушки и списки отбрасываются, чтобы абзацы были похожи по объёму."}</p>
      <div class="actions">
        <button class="primary" id="startTest" ${busy ? "disabled" : ""}>${busy ? "Загрузка…" : state.texts ? "Начать чтение" : "Загрузить тексты из Википедии"}</button>
      </div>
    </section>
  `;
  document.getElementById("startTest").onclick = async () => {
    await prepareTexts();
    if (!state.texts) return;
    state.view = "read-regular";
    render();
  };
}

function renderRead(kind) {
  const item = state.texts[kind];
  const html = kind === "bionic" ? toBionic(item.body) : escapeHtml(item.body);
  resetTimer();
  stage.innerHTML = `
    <section class="card">
      <span class="phase ${item.phase}">Текст ${kind === "regular" ? "1" : "2"} · ${item.title}</span>
      <h2>Прочитайте абзац</h2>
      <p class="note" id="hint">Секундомер ещё не запущен. Когда будете готовы, нажмите «Начать чтение».</p>
      <article class="passage hidden-text" id="passage">${html}</article>
      <p class="meta">${wordCount(item.body)} слов · отрывок из русской Википедии, CC BY-SA</p>
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
    state.view = kind === "regular" ? "quiz-regular" : "quiz-bionic";
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
      <h2>Что вы запомнили?</h2>
      <p class="note">Текст скрыт. Время чтения: <strong>${formatTime(state.elapsed[kind])}</strong></p>
      <form class="quiz">${questions}</form>
      <div class="actions">
        <button class="primary" id="submitQuiz">Дальше</button>
      </div>
    </section>
  `;

  document.getElementById("submitQuiz").onclick = () => {
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
    state.view = kind === "regular" ? "read-bionic" : "results";
    render();
  };
}

function sourceLink(item) {
  if (!item.url) return escapeHtml(item.sourceTitle);
  return `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.sourceTitle)}</a>`;
}

function renderResults() {
  resetTimer();
  const a = state.elapsed.regular;
  const b = state.elapsed.bionic;
  const diff = a - b;
  const percent = a ? Math.round((Math.abs(diff) / a) * 100) : 0;
  let verdict;
  if (diff > 400) {
    verdict = `Бионический абзац вы прочитали быстрее на ${formatTime(diff)} (${percent}%).`;
  } else if (diff < -400) {
    verdict = `Обычный абзац вы прочитали быстрее на ${formatTime(Math.abs(diff))} (${percent}%).`;
  } else {
    verdict = "По времени оба абзаца получились почти одинаково.";
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
          <p class="meta">${wordsPerMinute(wordCount(regular.body), a)} слов/мин · вопросы ${state.scores.regular}/${regular.questions.length}</p>
        </div>
        <div class="result">
          <span>Бионический шрифт</span>
          <strong>${formatTime(b)}</strong>
          <p class="meta">${wordsPerMinute(wordCount(bionic.body), b)} слов/мин · вопросы ${state.scores.bionic}/${bionic.questions.length}</p>
        </div>
      </div>
      <div class="verdict"><p>${verdict}</p></div>
      <p class="answers">Источники: ${sourceLink(regular)} и ${sourceLink(bionic)}. Тексты — CC BY-SA, русская Википедия. Один проход — личное сравнение, не научный вывод.</p>
      <div class="actions">
        <button class="primary" id="restart">Новые тексты</button>
      </div>
    </section>
  `;

  document.getElementById("restart").onclick = async () => {
    state.view = "intro";
    state.texts = null;
    state.elapsed = { regular: null, bionic: null };
    state.scores = { regular: null, bionic: null };
    render();
    await prepareTexts();
    render();
  };
}

render();
prepareTexts().then(() => {
  if (state.view === "intro") render();
});
