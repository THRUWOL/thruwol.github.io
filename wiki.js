const WIKI_API = "https://ru.wikipedia.org/w/api.php";
const TARGET_WORDS = 140;
const MIN_WORDS = 80;
const MAX_WORDS = 175;

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
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
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
    .filter((s) => s.length > 20);
}

function clipToWords(text, target = TARGET_WORDS) {
  const sentences = splitSentences(text).filter((sentence) => /[.!?]$/.test(sentence));
  if (!sentences.length) return text.trim();
  const out = [];
  let count = 0;
  for (const sentence of sentences) {
    const next = wordCount(sentence);
    if (count && count + next > target + 30) break;
    out.push(sentence);
    count += next;
    if (count >= target) break;
  }
  return (out.join(" ") || sentences.slice(0, 3).join(" ")).trim();
}

function isUsablePage(page) {
  const title = page.title || "";
  const extract = cleanExtract(page.extract);
  if (!extract) return false;
  if ((page.length || 0) < 2000) return false;
  if (/\(значения\)$/i.test(title)) return false;
  if (/^список\s/i.test(title)) return false;
  if (/^\d+(\s|\u00a0)?(год|годы)/i.test(title)) return false;
  if (/может означать|неоднозначн/i.test(extract)) return false;
  if (/почтовый индекс|телефонный код/i.test(extract) && wordCount(extract) < 110) return false;
  if (wordCount(extract) < MIN_WORDS) return false;
  if (splitSentences(extract).length < 3) return false;
  return true;
}

async function wikiQuery(params) {
  const search = new URLSearchParams({ format: "json", origin: "*", ...params });
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
    exchars: "1600",
    inprop: "url",
  });
  return Object.values(data.query?.pages || {});
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

function toArticle(page) {
  return {
    title: page.title,
    url: page.fullurl || page.canonicalurl,
    extract: cleanExtract(page.extract),
  };
}

async function collectFromPool() {
  const pool = await getTitlePool();
  if (pool.length < 8) throw new Error("Мало статей в категориях");
  const pages = await wikiQuery({
    action: "query",
    titles: shuffle(pool).slice(0, 12).join("|"),
    prop: "extracts|info",
    exintro: "1",
    explaintext: "1",
    exchars: "1600",
    inprop: "url",
    redirects: "1",
  });
  return Object.values(pages.query?.pages || {})
    .filter((page) => !page.missing && isUsablePage(page))
    .map(toArticle);
}

async function collectPages() {
  try {
    const fromPool = await collectFromPool();
    if (fromPool.length >= 2) return fromPool;
  } catch (error) {
    console.warn("Wikipedia categories:", error);
  }
  const batches = await Promise.all([fetchRandomBatch(), fetchRandomBatch(), fetchRandomBatch()]);
  const found = [];
  const seen = new Set();
  for (const page of batches.flat()) {
    if (seen.has(page.pageid) || !isUsablePage(page)) continue;
    seen.add(page.pageid);
    found.push(toArticle(page));
  }
  return found;
}

function numberedDistractors(value) {
  const raw = String(value).replace(",", ".");
  const num = Number(raw);
  if (!Number.isFinite(num)) return [];
  const isYear = num >= 1000 && num <= 2026 && Number.isInteger(num);
  const variants = isYear
    ? [num - 11, num + 7, num - 4, num + 13]
    : [num + 3, Math.max(1, num - 5), num * 2, Math.round(num * 1.4)];
  return unique(
    variants
      .filter((n) => n !== num && n > 0)
      .map((n) => (String(value).includes(",") ? String(n).replace(".", ",") : String(n)))
  );
}

function makeOptions(correct, extras) {
  const pool = unique([correct, ...extras.filter(Boolean)]).filter((item) => item !== correct);
  const options = shuffle([correct, ...shuffle(pool).slice(0, 2)]);
  while (options.length < 3) options.push("в тексте этого нет");
  return {
    options: options.slice(0, 3),
    answer: options.indexOf(correct),
  };
}

function snippet(sentence, maxWords = 18) {
  const words = sentence.replace(/^[«"]|[»"]$/g, "").trim().split(/\s+/);
  const cut = words.slice(0, maxWords).join(" ");
  return words.length > maxWords ? `${cut}…` : cut;
}

function generateQuestions(article, extras) {
  const text = article.body;
  const questions = [];
  const otherTitles = extras.map((item) => item.title).filter((title) => title !== article.title);
  const otherSnippets = extras
    .filter((item) => item.title !== article.title)
    .flatMap((item) => splitSentences(item.extract).map((s) => snippet(s)))
    .filter((s) => s.split(/\s+/).length >= 6);

  const topic = makeOptions(article.sourceTitle, otherTitles);
  if (topic.options.length === 3 && topic.answer >= 0) {
    questions.push({
      q: "Какая тема у этого текста?",
      options: topic.options,
      answer: topic.answer,
    });
  }

  const years = unique([...(text.match(/\b(?:1[0-9]{3}|20[0-2][0-9])\b/g) || [])]);
  if (years.length && questions.length < 3) {
    const year = years[0];
    const built = makeOptions(year, numberedDistractors(year));
    questions.push({
      q: "Какой год упоминается в тексте?",
      options: built.options,
      answer: built.answer,
    });
  }

  const numbers = unique([...(text.match(/\b\d+(?:[.,]\d+)?\b/g) || [])]).filter((n) => {
    const value = Number(String(n).replace(",", "."));
    return value >= 3 && !(value >= 1000 && value <= 2026);
  });
  if (numbers.length && questions.length < 3) {
    const number = numbers[0];
    const built = makeOptions(number, numberedDistractors(number));
    questions.push({
      q: "Какое число встречается в тексте?",
      options: built.options,
      answer: built.answer,
    });
  }

  const sentences = splitSentences(text).filter((s) => {
    const words = wordCount(s);
    return words >= 8 && words <= 30;
  });
  if (sentences.length && questions.length < 3) {
    const real = snippet(sentences[Math.min(1, sentences.length - 1)]);
    const fakes = otherSnippets.filter((s) => s !== real).slice(0, 6);
    const built = makeOptions(real, fakes);
    questions.push({
      q: "Какая фраза была в тексте?",
      options: built.options,
      answer: built.answer,
    });
  }

  const ownWords = unique((text.match(/[А-Яа-яЁё]{8,}/g) || []));
  const extraWords = extras
    .flatMap((item) => item.extract.match(/[А-Яа-яЁё]{8,}/g) || [])
    .filter((word) => !ownWords.includes(word));
  if (ownWords.length && extraWords.length && questions.length < 3) {
    const built = makeOptions(ownWords[0], extraWords);
    questions.push({
      q: "Какое слово есть в тексте?",
      options: built.options,
      answer: built.answer,
    });
  }

  if (sentences.length > 2 && questions.length < 3) {
    const real = snippet(sentences[0]);
    const built = makeOptions(real, otherSnippets);
    questions.push({
      q: "Что из этого встречалось в абзаце?",
      options: built.options,
      answer: built.answer,
    });
  }

  return questions.slice(0, 3);
}

const FALLBACK_PAIR = {
  extras: [
    {
      title: "Северное сияние",
      extract: "Северное сияние возникает, когда частицы солнечного ветра сталкиваются с атмосферой Земли над полярными областями. Цвета зависят от газа: кислород даёт зелёный оттенок, азот — фиолетовый.",
    },
    {
      title: "Гуттенберг",
      extract: "Иоганн Гутенберг в середине XV века собрал печатный станок с подвижными литерами. Это ускорило распространение книг по Европе и изменило доступ к знаниям.",
    },
  ],
  articles: [
    {
      sourceTitle: "Городские пчёлы",
      url: "",
      body: "В 2018 году биологи Лондонского университета королевы Марии сравнили медоносных пчёл из центра города и с окрестных ферм. Городские пчёлы не кружили широкими петлями вокруг улья, а прыгали короткими маршрутами между крышами, скверами и балконными ящиками. За один вылет средняя городская пчела посещала семнадцать источников пыльцы, сельская — только девять. Мёд из лондонских ульев содержал на двадцать восемь процентов больше железа и на четырнадцать процентов больше цинка. Учёные связали это с декоративными растениями, которые цветут почти без паузы с апреля по октябрь. Неожиданной оказалась чистота городского мёда: неоникотиноидов в нём было втрое меньше, чем в образцах с полей рапса. Авторы предложили городским службам оставлять на крышах нестриженые полосы клевера шириной не меньше двух метров.",
    },
    {
      sourceTitle: "Звуки кораллового рифа",
      url: "",
      body: "В 2022 году морские биологи с австралийского судна «Солана» записали звуки Большого Барьерного рифа на глубине двенадцати метров. Здоровый риф звучал почти как лес: щёлканье креветок, низкий гул рыб-попугаев, которые соскребают водоросли, и короткие трели рыб-белок. Над обесцвеченным участком громкость падала примерно на пятнадцать децибел, а ритм становился редким и рваным. Исследователи включили запись здорового рифа через подводные динамики у мёртвого кораллового поля. Через шесть недель молодь рыб возвращалась туда в 2,4 раза чаще, чем на контрольную площадку без звука. Самыми быстрыми оказались рыбы-хирурги: они подплывали к динамику уже через сорок минут.",
    },
  ],
};

async function loadWikipediaPair() {
  const pages = await collectPages();
  if (pages.length < 2) throw new Error("Недостаточно статей");
  const scored = pages
    .map((page) => {
      const body = clipToWords(page.extract);
      return { ...page, body, words: wordCount(body) };
    })
    .filter((page) => page.words >= MIN_WORDS && page.words <= MAX_WORDS + 40)
    .sort((a, b) => Math.abs(a.words - TARGET_WORDS) - Math.abs(b.words - TARGET_WORDS));

  const first = scored[0];
  const second = scored.slice(1).sort((a, b) => Math.abs(a.words - first.words) - Math.abs(b.words - first.words))[0];
  if (!first || !second) throw new Error("Не удалось подобрать абзацы");

  const extras = pages.filter((page) => page.title !== first.title && page.title !== second.title);
  return {
    fromWiki: true,
    articles: [first, second],
    extras,
  };
}

async function loadTestTexts() {
  try {
    return await loadWikipediaPair();
  } catch (error) {
    console.warn("Wikipedia fallback:", error);
    return { fromWiki: false, ...FALLBACK_PAIR };
  }
}
