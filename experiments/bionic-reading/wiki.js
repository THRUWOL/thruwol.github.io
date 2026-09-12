const WIKI_API = "https://ru.wikipedia.org/w/api.php";
const TARGET_WORDS = 130;
const MIN_WORDS = 75;
const MAX_WORDS = 170;

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function unique(list) {
  return [...new Set(list)];
}

function cleanExtract(raw) {
  if (!raw) return "";
  return raw
    .replace(/\u0301/g, "")
    .replace(/\([^)]{0,90}\)/g, (chunk) =>
      /[A-Za-z]{4,}/.test(chunk) && !/[А-Яа-яЁё]{6,}/.test(chunk) ? "" : chunk
    )
    .replace(/==+[^=]+==+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/…+\s*$/g, "")
    .replace(/\.{2,}\s*$/g, "")
    .trim();
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?…])\s+(?=[«"A-ZА-ЯЁ])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && /[.!?]$/.test(s));
}

function takeChunk(sentences, start, target = TARGET_WORDS) {
  const out = [];
  let count = 0;
  let index = start;
  for (; index < sentences.length; index += 1) {
    const next = wordCount(sentences[index]);
    if (count && count + next > target + 28) break;
    out.push(sentences[index]);
    count += next;
    if (count >= target) {
      index += 1;
      break;
    }
  }
  return { text: out.join(" ").trim(), next: index, words: count };
}

function splitIntoParagraphs(text) {
  const sentences = splitSentences(text);
  if (sentences.length < 6) return null;
  const first = takeChunk(sentences, 0);
  const second = takeChunk(sentences, first.next);
  if (first.words < MIN_WORDS || second.words < MIN_WORDS) return null;
  if (first.words > MAX_WORDS + 35 || second.words > MAX_WORDS + 35) return null;
  if (first.text === second.text) return null;
  return [first.text, second.text];
}

function isCandidate(page) {
  const title = page.title || "";
  const extract = cleanExtract(page.extract);
  if (!extract) return false;
  if ((page.length || 0) < 8000) return false;
  if (/\(значения\)$/i.test(title)) return false;
  if (/^список\s/i.test(title)) return false;
  if (/^\d+(\s|\u00a0)?(год|годы)/i.test(title)) return false;
  if (/может означать|неоднозначн/i.test(extract)) return false;
  return true;
}

async function wikiQuery(params) {
  const search = new URLSearchParams({ format: "json", origin: "*", formatversion: "2", ...params });
  const response = await fetch(`${WIKI_API}?${search}`);
  if (!response.ok) throw new Error("Wikipedia API " + response.status);
  return response.json();
}

async function fetchRandomBatch() {
  const data = await wikiQuery({
    action: "query",
    generator: "random",
    grnnamespace: "0",
    grnfilterredir: "nonredirects",
    grnlimit: "10",
    prop: "extracts|info",
    exintro: "1",
    explaintext: "1",
    exchars: "400",
    inprop: "url",
  });
  return data.query?.pages || [];
}

async function fetchCategoryTitles(category, limit) {
  const data = await wikiQuery({
    action: "query",
    list: "categorymembers",
    cmtitle: category,
    cmnamespace: "0",
    cmtype: "page",
    cmlimit: String(limit),
  });
  return (data.query?.categorymembers || []).map((item) => item.title);
}

async function getTitlePool() {
  try {
    const cached = sessionStorage.getItem("bionic-wiki-titles-v2");
    if (cached) {
      const titles = JSON.parse(cached);
      if (Array.isArray(titles) && titles.length > 40) return titles;
    }
  } catch (_error) {
    /* ignore quota / parse errors */
  }
  const [good, featured] = await Promise.all([
    fetchCategoryTitles("Категория:Википедия:Хорошие_статьи_по_алфавиту", "400"),
    fetchCategoryTitles("Категория:Википедия:Избранные_статьи_по_алфавиту", "200"),
  ]);
  const titles = unique([...featured, ...good]).filter(
    (title) => !/^список\s/i.test(title) && !title.startsWith("Категория:")
  );
  try {
    sessionStorage.setItem("bionic-wiki-titles-v2", JSON.stringify(titles));
  } catch (_error) {
    /* ignore quota */
  }
  return titles;
}

function pageUrl(title) {
  return `https://ru.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

async function fetchArticlePlain(title) {
  const data = await wikiQuery({
    action: "parse",
    page: title,
    prop: "text",
    disabletoc: "1",
    redirects: "1",
  });
  const html = data.parse?.text;
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll("p")]
    .map((node) => cleanExtract(node.textContent.replace(/\[\d+\]/g, " ")))
    .filter((para) => wordCount(para) >= 18)
    .join(" ");
}

function pairFromPlain(title, url, plain) {
  const parts = splitIntoParagraphs(plain);
  if (!parts) return null;
  return {
    fromWiki: true,
    sourceTitle: title,
    url,
    articles: parts.map((body) => ({
      sourceTitle: title,
      url,
      body,
    })),
  };
}

async function collectCandidates() {
  const pool = await getTitlePool();
  const data = await wikiQuery({
    action: "query",
    titles: shuffle(pool).slice(0, 12).join("|"),
    redirects: "1",
    prop: "extracts|info",
    exintro: "1",
    explaintext: "1",
    exchars: "400",
    inprop: "url",
  });
  const pages = data.query?.pages || [];
  return pages.filter((page) => !page.missing && isCandidate(page));
}

async function loadWikipediaPair() {
  let candidates = [];
  try {
    candidates = await collectCandidates();
  } catch (error) {
    console.warn("Wikipedia categories:", error);
  }
  if (candidates.length < 2) {
    const batches = await Promise.all([fetchRandomBatch(), fetchRandomBatch()]);
    candidates = batches.flat().filter((page) => !page.missing && isCandidate(page));
  }
  for (const page of shuffle(candidates).slice(0, 6)) {
    try {
      const plain = await fetchArticlePlain(page.title);
      const pair = pairFromPlain(page.title, page.fullurl || page.canonicalurl || pageUrl(page.title), plain);
      if (pair) return pair;
    } catch (error) {
      console.warn("parse", page.title, error);
    }
  }
  throw new Error("Не удалось нарезать два абзаца");
}

function numberedDistractors(value) {
  const raw = String(value).replace(",", ".");
  const num = Number(raw);
  if (!Number.isFinite(num)) return [];
  const isYear = num >= 1000 && num <= 2026 && Number.isInteger(num);
  const variants = isYear
    ? [num - 11, num + 7, num - 4, num + 13]
    : [num + 3, Math.max(1, num - 5), Math.round(num * 1.5), num + 12];
  return unique(
    variants
      .filter((n) => n !== num && n > 0)
      .map((n) => (String(value).includes(",") ? String(n).replace(".", ",") : String(n)))
  );
}

function makeOptions(correct, extras) {
  if (!correct) return null;
  let pool = unique(extras.filter(Boolean)).filter((item) => item !== correct);
  if (pool.length < 2) {
    const mutated = String(correct).replace(/\d+/, (n) => String(Number(n) + 8));
    if (mutated !== String(correct)) pool.push(mutated);
    pool.push("этого в абзаце не было");
  }
  pool = unique(pool).filter((item) => item !== correct);
  const options = shuffle([correct, ...shuffle(pool).slice(0, 2)]);
  while (options.length < 3) options.push("в этом абзаце этого нет");
  return {
    options: options.slice(0, 3),
    answer: options.indexOf(correct),
  };
}

function snippet(sentence, maxWords = 16) {
  const words = sentence.replace(/^[«"]|[»"]$/g, "").trim().split(/\s+/);
  const cut = words.slice(0, maxWords).join(" ");
  return words.length > maxWords ? `${cut}…` : cut;
}

function laterText(text) {
  const sentences = splitSentences(text);
  return (sentences.length > 1 ? sentences.slice(1) : sentences).join(" ");
}

function contentSnippets(text) {
  const sentences = splitSentences(text).filter((s) => {
    const words = wordCount(s);
    return words >= 8 && words <= 28;
  });
  const preferred = sentences.length > 2 ? sentences.slice(1) : sentences;
  return unique(preferred.map((s) => snippet(s))).filter((s) => s.split(/\s+/).length >= 7);
}

function extractNumbers(text) {
  return unique([...(laterText(text).match(/\b(?:\d+(?:[.,]\d+)?|1[0-9]{3}|20[0-2][0-9])\b/g) || [])]).filter((n) => {
    const value = Number(String(n).replace(",", "."));
    return Number.isFinite(value) && value >= 3;
  });
}

function extractNames(text) {
  return unique(
    [...(laterText(text).match(/[А-ЯЁ][а-яё]{4,}(?:(?:\s+|-)[А-ЯЁа-яё]{3,}){0,2}/g) || [])]
  ).filter((name) => name.length >= 6 && name.length <= 42);
}

function generateQuestions(body, siblingBody) {
  const questions = [];
  const mine = contentSnippets(body);
  const theirs = contentSnippets(siblingBody).filter((item) => !mine.includes(item));
  const usedSnips = new Set();

  const addPhrase = (prompt) => {
    const candidates = shuffle(mine.filter((item) => !usedSnips.has(item)));
    const built = makeOptions(candidates[0], theirs);
    if (!built) return;
    usedSnips.add(candidates[0]);
    questions.push({ q: prompt, options: built.options, answer: built.answer });
  };

  addPhrase("Какая фраза была в этом абзаце, а не в другом?");
  if (mine.length > 1) addPhrase("Что из этого сказано именно здесь?");

  const myNums = extractNumbers(body);
  const theirNums = extractNumbers(siblingBody);
  const uniqueNum = myNums.find((n) => !theirNums.includes(n));
  if (uniqueNum && questions.length < 3) {
    const distractors = unique([...theirNums, ...numberedDistractors(uniqueNum)]);
    const built = makeOptions(uniqueNum, distractors);
    if (built) {
      questions.push({
        q: "Какое число или год есть в этом абзаце, но не обязано быть в соседнем?",
        options: built.options,
        answer: built.answer,
      });
    }
  }

  const myNames = extractNames(body);
  const theirNames = extractNames(siblingBody);
  const uniqueName = myNames.find((n) => !theirNames.some((other) => other.includes(n) || n.includes(other)));
  if (uniqueName && questions.length < 3) {
    const built = makeOptions(uniqueName, theirNames);
    if (built) {
      questions.push({
        q: "Что из этого упоминается в прочитанном абзаце?",
        options: built.options,
        answer: built.answer,
      });
    }
  }

  return questions.slice(0, 3);
}

const FALLBACK_PAIR = {
  sourceTitle: "Городские пчёлы",
  url: "",
  articles: [
    {
      sourceTitle: "Городские пчёлы",
      url: "",
      body: "В 2018 году биологи Лондонского университета королевы Марии сравнили медоносных пчёл из центра города и с окрестных ферм. Городские пчёлы не кружили широкими петлями вокруг улья, а прыгали короткими маршрутами между крышами, скверами и балконными ящиками. За один вылет средняя городская пчела посещала семнадцать источников пыльцы, сельская — только девять. Исследователи связали это с плотной мозаикой клумб и парков: корм был ближе, поэтому долгие разведывательные петли оказались не нужны.",
    },
    {
      sourceTitle: "Городские пчёлы",
      url: "",
      body: "Мёд из лондонских ульев содержал на двадцать восемь процентов больше железа и на четырнадцать процентов больше цинка. Неожиданной оказалась чистота городского мёда: неоникотиноидов в нём было втрое меньше, чем в образцах с полей рапса. Авторы предложили городским службам оставлять на крышах нестриженые полосы клевера шириной не меньше двух метров. Именно такие полосы кормили пчёл в самые сухие недели июля, когда обычные газоны уже выгорали.",
    },
  ],
};

async function loadTestTexts() {
  try {
    return await loadWikipediaPair();
  } catch (error) {
    console.warn("Wikipedia fallback:", error);
    return { fromWiki: false, ...FALLBACK_PAIR };
  }
}
