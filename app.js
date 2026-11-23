'use strict';
// ===== 筋トレ記録アプリの「動き」を担当するファイル =====
// 画面の部品は index.html、見た目は style.css に書いてあります。
// ここでは「ボタンを押したら何をするか」「データをどう保存するか」を書きます。

const STORAGE_KEY = 'kintore-data-v1';
const DEFAULT_EXERCISES = [
  'ベンチプレス', 'スクワット', 'デッドリフト', 'ショルダープレス',
  'ラットプルダウン', '懸垂', '腕立て伏せ', '腹筋',
];

// ---------- データの読み込みと保存 ----------
// データはスマホ(ブラウザ)の中の「localStorage」という保管場所に保存します。
// オブジェクトを文字列(JSON)に変えて保存するので、C#でいう
// 「シリアライズして保存」と同じ考え方です。
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('データの読み込みに失敗しました', e);
  }
  // 初めて開いたときの空っぽのデータ
  return { records: [], bodyWeights: {}, exercises: [...DEFAULT_EXERCISES] };
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    scheduleCloudSave(); // Googleの自動保存が設定されていれば、少し後に送る
  } catch (e) {
    alert('保存に失敗しました。容量がいっぱいか、プライベートブラウズになっていないか確認してください。');
  }
}

// やる気スイッチのボタン(最初に入っているもの)
// url は「共有 → リンクをコピー」したものに差し替えられます。
const DEFAULT_LINKS = [
  { name: '🎵 音楽', url: 'https://music.line.me/' },
  { name: '▶ YouTube', url: 'https://www.youtube.com/shorts' },
  { name: '♪ TikTok', url: 'https://www.tiktok.com/' },
];

// アプリ全体のデータ
//   records     : 記録の一覧 [{ id, date, exercise, weight, reps, sets, createdAt }, ...]
//   bodyWeights : 日付ごとの体重 { '2026-11-23': 70.5, ... }
//   exercises   : 種目の一覧
//   links       : 音楽のボタン [{ name, url }, ...]
//   videos      : やる気動画 [{ id, kind, vid, url, title }, ...]
const data = loadData();
// 古いデータには links / videos がないので、そのときは最初の状態を入れておく
if (!Array.isArray(data.links)) data.links = DEFAULT_LINKS.map((l) => ({ ...l }));
// マインド日記 [{ id, date, mood, text, createdAt }, ...]。古いデータにはないので空で用意
if (!Array.isArray(data.minds)) data.minds = [];
if (!Array.isArray(data.videos)) data.videos = [];

// 今、画面で入力中の値
const form = { exercise: data.exercises[0] || '', weight: 20, reps: 10, sets: 3 };

// ---------- 小さな便利関数 ----------
const $ = (id) => document.getElementById(id);

// Date → '2026-11-23' の形の文字列
function toDateStr(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// '2026-11-23' → '11/23(月)'
function formatDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  const week = '日月火水木金土'[new Date(y, m - 1, d).getDay()];
  return `${m}/${d}(${week})`;
}

// 記録1件を '60kg × 10回 × 3セット' の形にする
function formatSet(r) {
  const w = r.weight > 0 ? `${r.weight}kg` : '自重';
  return `${w} × ${r.reps}回 × ${r.sets}セット`;
}

let toastTimer = null;
function showToast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

// その種目の「前回の記録」を探す
// (選んでいる日付まででいちばん新しいもの。同じ日の2セット目以降にも使える)
function findPrevious(exercise, uptoDate) {
  let best = null;
  for (const r of data.records) {
    if (r.exercise !== exercise || r.date > uptoDate) continue;
    if (!best || r.date > best.date || (r.date === best.date && r.createdAt > best.createdAt)) {
      best = r;
    }
  }
  return best;
}

// ---------- 種目 ----------
function renderExercises() {
  const box = $('exercise-list');
  box.innerHTML = '';
  for (const name of data.exercises) {
    const b = document.createElement('button');
    b.className = 'chip' + (name === form.exercise ? ' active' : '');
    b.textContent = name;
    b.addEventListener('click', () => selectExercise(name));
    box.appendChild(b);
  }
  const add = document.createElement('button');
  add.className = 'chip add';
  add.textContent = '＋ 種目を追加';
  add.addEventListener('click', addExercise);
  box.appendChild(add);
}

// 種目を選んだら、前回の数字を入力欄に自動で入れる(入力を減らすため)
function selectExercise(name) {
  form.exercise = name;
  const prev = findPrevious(name, $('date').value);
  if (prev) {
    form.weight = prev.weight;
    form.reps = prev.reps;
    form.sets = prev.sets;
  }
  renderExercises();
  renderPrevious();
  renderSteppers();
}

function addExercise() {
  const name = (prompt('追加する種目名を入力してください') || '').trim();
  if (!name) return;
  if (data.exercises.includes(name)) {
    showToast('その種目はもうあります');
  } else {
    data.exercises.push(name);
    saveData();
  }
  selectExercise(name);
}

function renderPrevious() {
  const prev = findPrevious(form.exercise, $('date').value);
  $('previous').textContent = prev
    ? `前回 ${formatDate(prev.date)}：${formatSet(prev)}`
    : 'この種目は初めての記録です';
}

// ---------- −/＋ の部品 ----------
function renderSteppers() {
  document.querySelectorAll('.stepper').forEach((el) => {
    el.querySelector('.stepper-value').value = form[el.dataset.key];
  });
}

function setupSteppers() {
  document.querySelectorAll('.stepper').forEach((el) => {
    const key = el.dataset.key;
    const step = Number(el.dataset.step);
    const min = Number(el.dataset.min);
    const input = el.querySelector('.stepper-value');

    const change = (diff) => {
      // 小数の計算誤差(0.1+0.2=0.30000000004 みたいなもの)を防ぐために丸める
      form[key] = Math.max(min, Math.round((form[key] + diff) * 10) / 10);
      input.value = form[key];
    };
    el.querySelector('.minus').addEventListener('click', () => change(-step));
    el.querySelector('.plus').addEventListener('click', () => change(step));

    // 数字を直接打ち込んだとき
    input.addEventListener('change', () => {
      const v = Number(input.value);
      form[key] = Number.isFinite(v) && v >= min ? v : min;
      input.value = form[key];
    });
  });
}

// ---------- 記録 ----------
function saveRecord() {
  if (!form.exercise) {
    showToast('種目を選んでください');
    return;
  }
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: $('date').value,
    exercise: form.exercise,
    weight: form.weight,
    reps: form.reps,
    sets: form.sets,
    createdAt: Date.now(),
  };
  data.records.push(record);
  saveData();
  showToast(`記録しました：${record.exercise} ${formatSet(record)}`);
  owlSay('saved');
  renderDayList();
  renderPrevious();
}

function deleteRecord(id) {
  const r = data.records.find((x) => x.id === id);
  if (!r) return;
  if (!confirm(`${r.exercise} ${formatSet(r)} を削除しますか？`)) return;
  data.records = data.records.filter((x) => x.id !== id);
  saveData();
  renderDayList();
  renderPrevious();
}

// 選んでいる日付の記録を一覧表示
function renderDayList() {
  const date = $('date').value;
  const list = $('day-list');
  list.innerHTML = '';
  const items = data.records
    .filter((r) => r.date === date)
    .sort((a, b) => a.createdAt - b.createdAt);

  if (items.length === 0) {
    const li = document.createElement('li');
    li.innerHTML = '<p class="empty">まだ記録はありません</p>';
    list.appendChild(li);
    return;
  }
  for (const r of items) {
    list.appendChild(makeLogItem(r, true));
  }
}

// 記録1件ぶんの行を作る(withDelete が true なら削除ボタン付き)
function makeLogItem(r, withDelete) {
  const li = document.createElement('li');
  const info = document.createElement('div');
  info.className = 'info';
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = r.exercise;
  const detail = document.createElement('div');
  detail.className = 'detail';
  detail.textContent = formatSet(r);
  info.append(name, detail);
  li.appendChild(info);

  if (withDelete) {
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '削除';
    del.addEventListener('click', () => deleteRecord(r.id));
    li.appendChild(del);
  }
  return li;
}

// ---------- 体重 ----------
function renderBodyWeight() {
  const v = data.bodyWeights[$('date').value];
  $('bodyweight').value = v ?? '';
}

function saveBodyWeight() {
  const date = $('date').value;
  const v = parseFloat($('bodyweight').value);
  if (Number.isFinite(v) && v > 0) {
    data.bodyWeights[date] = v;
    showToast(`体重 ${v}kg を保存しました`);
  } else {
    delete data.bodyWeights[date];
  }
  saveData();
}

// ---------- 履歴 ----------
function renderHistory() {
  const box = $('history');
  box.innerHTML = '';
  // 記録か体重がある日付を、新しい順に並べる
  const dates = new Set([...data.records.map((r) => r.date), ...Object.keys(data.bodyWeights)]);
  const sorted = [...dates].sort().reverse();

  if (sorted.length === 0) {
    box.innerHTML = '<div class="card"><p class="empty">まだ記録がありません。「記録」タブから始めましょう。</p></div>';
    return;
  }

  for (const date of sorted) {
    const card = document.createElement('div');
    card.className = 'card';

    const head = document.createElement('div');
    head.className = 'history-head';
    const h3 = document.createElement('h3');
    h3.textContent = formatDate(date);
    head.appendChild(h3);
    if (data.bodyWeights[date]) {
      const bw = document.createElement('span');
      bw.className = 'bw';
      bw.textContent = `体重 ${data.bodyWeights[date]}kg`;
      head.appendChild(bw);
    }
    card.appendChild(head);

    const ul = document.createElement('ul');
    ul.className = 'log';
    data.records
      .filter((r) => r.date === date)
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((r) => ul.appendChild(makeLogItem(r, false)));
    card.appendChild(ul);

    // この日を記録タブで開く(あとから直したいとき用)
    const open = document.createElement('button');
    open.className = 'history-open';
    open.textContent = 'この日を開いて編集 →';
    open.addEventListener('click', () => {
      $('date').value = date;
      onDateChange();
      showView('record');
    });
    card.appendChild(open);

    box.appendChild(card);
  }
}

// ---------- 音楽(プレイリストなどを開くボタン) ----------
// アプリの中身を操作することはできないので、「そのページを開く」だけのボタンです。
// iPhone では、アプリが入っていればアプリで開くことが多いです。
function renderLinks() {
  const box = $('link-buttons');
  box.innerHTML = '';
  for (const l of data.links) {
    if (!l.url) continue;
    const a = document.createElement('a');
    a.className = 'link-btn';
    a.textContent = l.name || 'リンク';
    a.href = l.url;
    a.target = '_blank'; // 記録アプリは閉じずに、別の画面で開く
    a.rel = 'noopener';
    box.appendChild(a);
  }
}

// 編集画面:ボタン1つにつき「名前」「URL」「削除」の1行
function renderLinkEditor() {
  const rows = $('link-edit-rows');
  rows.innerHTML = '';
  data.links.forEach((l, i) => {
    const row = document.createElement('div');
    row.className = 'link-edit-row';

    const name = document.createElement('input');
    name.value = l.name;
    name.placeholder = '名前（例：🎵 筋トレ用）';
    name.addEventListener('change', () => { l.name = name.value.trim(); saveData(); renderLinks(); });

    const url = document.createElement('input');
    url.type = 'url';
    url.value = l.url;
    url.placeholder = 'https://...';
    url.addEventListener('change', () => { l.url = url.value.trim(); saveData(); renderLinks(); });

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '削除';
    del.addEventListener('click', () => {
      data.links.splice(i, 1);
      saveData();
      renderLinks();
      renderLinkEditor();
    });

    row.append(name, url, del);
    rows.appendChild(row);
  });
}

function setupLinks() {
  $('link-edit-toggle').addEventListener('click', () => {
    const editor = $('link-editor');
    editor.hidden = !editor.hidden;
    if (!editor.hidden) renderLinkEditor();
  });
  $('link-edit-done').addEventListener('click', () => { $('link-editor').hidden = true; renderLinks(); });
  $('link-add').addEventListener('click', () => {
    data.links.push({ name: '', url: '' });
    saveData();
    renderLinkEditor();
  });
  renderLinks();
}

// ---------- マインド日記 ----------
// 気分を1タップ＋ひとことを話して残す。
// 「🎤 押して話す」は、ブラウザの音声入力の仕組み(Web Speech)を使います。
// iPhoneのホーム画面アプリでは使えないことがあるので、そのときは
// キーボードのマイクボタンで話してもらう(どちらでも文字が入ればOK)。
const MOODS = ['🔥 やる気', '🙂 ふつう', '😮‍💨 だるい', '😣 しんどい'];
let mindMood = '';

// 今日の気分ボタン
function renderMoods() {
  const box = $('mind-moods');
  box.innerHTML = '';
  for (const m of MOODS) {
    const b = document.createElement('button');
    b.className = 'chip' + (m === mindMood ? ' active' : '');
    b.textContent = m;
    b.addEventListener('click', () => {
      mindMood = mindMood === m ? '' : m; // もう一度押すと取り消し
      renderMoods();
    });
    box.appendChild(b);
  }
}

// 長い文から「ひとこと見出し」を作る(AIではなく、最初の1文を短く切るだけ)
function mindTitle(text) {
  const first = text.split(/[。！？!?\n]/).find((t) => t.trim()) || '';
  const t = first.trim();
  return t.length > 20 ? t.slice(0, 20) + '…' : t;
}

// '2026-11-23' → '261123'(Notionのマインド日記のページ名ルールに合わせる)
function toYYMMDD(s) {
  return s.replaceAll('-', '').slice(2);
}

function saveMind() {
  const text = $('mind-text').value.trim();
  if (!text && !mindMood) {
    showToast('気分かひとことを入れてください');
    return;
  }
  data.minds.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: toDateStr(new Date()),
    mood: mindMood,
    text,
    createdAt: Date.now(),
  });
  saveData();
  $('mind-text').value = '';
  mindMood = '';
  renderMoods();
  renderMindList();
  showToast('マインド日記に残しました');
  owlSay('mindSaved');
}

// Notionに貼りやすい形にしてコピー(1行目がページ名「261123‐ひとこと」)
async function copyMindForNotion(m) {
  const title = `${toYYMMDD(m.date)}‐${mindTitle(m.text) || '筋トレ'}`;
  const body = [m.mood && `気分：${m.mood}`, m.text].filter(Boolean).join('\n');
  const all = `${title}\n${body}`;
  try {
    await navigator.clipboard.writeText(all);
    showToast('コピーしました。Notionに貼り付けてください');
  } catch (e) {
    prompt('下の文を長押ししてコピーしてください', all);
  }
}

// 前回まとめてコピーした後の分を、全部まとめてコピーする。
// これをClaudeに貼ると、要約してNotionに書いてもらえる(月1回や週1回でOK)。
async function copyMindBulk() {
  const since = data.mindBulkCopiedAt || 0;
  let items = data.minds.filter((m) => m.createdAt > since);
  if (items.length === 0) items = data.minds; // 新しい分がなければ全部
  if (items.length === 0) {
    showToast('まだ日記がありません');
    return;
  }
  items = [...items].sort((a, b) => a.createdAt - b.createdAt);
  const lines = ['筋トレのマインド日記です。要約してNotionに記録してください。', ''];
  for (const m of items) {
    lines.push(`■ ${m.date} ${m.mood}`.trim());
    if (m.text) lines.push(m.text);
    lines.push('');
  }
  const all = lines.join('\n');
  try {
    await navigator.clipboard.writeText(all);
    showToast(`${items.length}件コピーしました。Claudeに貼り付けてください`);
  } catch (e) {
    prompt('下の文を長押ししてコピーしてください', all);
  }
  data.mindBulkCopiedAt = Date.now();
  saveData();
}

function deleteMind(id) {
  if (!confirm('このマインド日記を削除しますか？')) return;
  data.minds = data.minds.filter((m) => m.id !== id);
  saveData();
  renderMindList();
}

function renderMindList() {
  const list = $('mind-list');
  list.innerHTML = '';
  const items = [...data.minds].sort((a, b) => b.createdAt - a.createdAt);
  if (items.length === 0) {
    list.innerHTML = '<li><p class="empty">まだありません。今の気持ちをひとこと残してみよう</p></li>';
    return;
  }
  for (const m of items) {
    const li = document.createElement('li');
    li.className = 'mind-item';

    const head = document.createElement('div');
    head.className = 'mind-head';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = `${formatDate(m.date)}　${m.mood}`;
    head.appendChild(name);

    const body = document.createElement('div');
    body.className = 'mind-body';
    body.textContent = m.text;

    const actions = document.createElement('div');
    actions.className = 'mind-actions';
    const copy = document.createElement('button');
    copy.textContent = 'Notion用にコピー';
    copy.addEventListener('click', () => copyMindForNotion(m));
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '削除';
    del.addEventListener('click', () => deleteMind(m.id));
    actions.append(copy, del);

    li.append(head, body, actions);
    list.appendChild(li);
  }
}

// ---------- やる気動画(アプリの中で再生) ----------
// YouTube や TikTok の「共有 → リンクをコピー」したURLを登録しておくと、
// アプリを切り替えずにこの画面の中で再生できます。
// (「後で見る」や「いいね」の一覧を自動で読み込むことは、各サービスが許可していないためできません)

// URL を見て「どのサービスの、どの動画か」を調べる。C#でいう「パース(解析)」
function parseVideoUrl(text) {
  let u;
  try { u = new URL(text.trim()); } catch (e) { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') {
    const vid = u.pathname.slice(1).split('/')[0];
    return vid ? { kind: 'youtube', vid } : null;
  }
  if (host.endsWith('youtube.com')) {
    const shorts = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]+)/);
    if (shorts) return { kind: 'youtube', vid: shorts[2] };
    if (u.searchParams.get('v')) return { kind: 'youtube', vid: u.searchParams.get('v') };
    // 再生リストのURL(自分で作った「筋トレ用」再生リストなど)
    if (u.searchParams.get('list')) return { kind: 'youtube-list', vid: u.searchParams.get('list') };
    return null;
  }
  if (host.endsWith('tiktok.com')) {
    const m = u.pathname.match(/\/video\/(\d+)/);
    if (m) return { kind: 'tiktok', vid: m[1] };
    // 短いURL(vt.tiktok.com など)は中身の番号が分からないので、TikTokを開くリンクとして保存
    return { kind: 'link', vid: '' };
  }
  return null;
}

// 動画を再生するための「埋め込み用URL」を作る
function embedUrl(v) {
  if (v.kind === 'youtube') return `https://www.youtube.com/embed/${v.vid}?autoplay=1&playsinline=1&rel=0`;
  if (v.kind === 'youtube-list') return `https://www.youtube.com/embed/videoseries?list=${v.vid}&autoplay=1&playsinline=1&rel=0`;
  if (v.kind === 'tiktok') return `https://www.tiktok.com/player/v1/${v.vid}?autoplay=1&loop=1&rel=0`;
  return '';
}

let playingId = null;

function addVideo() {
  const text = prompt('YouTube か TikTok の動画のURLを貼り付けてください\n（再生リストのURLもOK）');
  if (!text) return;
  const info = parseVideoUrl(text);
  if (!info) {
    showToast('YouTube か TikTok のURLを貼ってください');
    return;
  }
  const v = {
    id: Date.now().toString(36),
    kind: info.kind,
    vid: info.vid,
    url: text.trim(),
    title: { youtube: 'YouTube', 'youtube-list': '再生リスト', tiktok: 'TikTok', link: 'TikTok（外で開く）' }[info.kind],
  };
  data.videos.unshift(v); // 新しいものを先頭に
  saveData();
  renderVideos();
  if (info.kind === 'link') showToast('短いURLなので、押すとTikTokで開きます');
  fetchTitle(v);
}

// YouTube の動画名を取りに行く(取れなければそのまま)
function fetchTitle(v) {
  if (v.kind !== 'youtube') return;
  fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + v.vid)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (j && j.title) { v.title = j.title; saveData(); renderVideos(); }
    })
    .catch(() => {});
}

function deleteVideo(id) {
  if (!confirm('この動画をリストから外しますか？')) return;
  data.videos = data.videos.filter((v) => v.id !== id);
  if (playingId === id) closePlayer();
  saveData();
  renderVideos();
}

function playVideo(id) {
  const v = data.videos.find((x) => x.id === id);
  if (!v) return;
  if (v.kind === 'link') {
    window.open(v.url, '_blank');
    return;
  }
  playingId = id;
  const player = $('player');
  player.innerHTML = '';
  player.classList.toggle('wide', v.kind === 'youtube-list');
  const f = document.createElement('iframe');
  f.src = embedUrl(v);
  f.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
  f.allowFullscreen = true;
  player.appendChild(f);
  player.hidden = false;
  $('player-controls').hidden = false;
  renderVideos();
  player.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// アプリ内で再生できる動画だけを順番に回す
function playNext(random) {
  const list = data.videos.filter((v) => v.kind !== 'link');
  if (list.length === 0) return;
  let i = list.findIndex((v) => v.id === playingId);
  if (random && list.length > 1) {
    let r;
    do { r = Math.floor(Math.random() * list.length); } while (r === i);
    i = r;
  } else {
    i = (i + 1) % list.length;
  }
  playVideo(list[i].id);
}

function closePlayer() {
  playingId = null;
  $('player').innerHTML = ''; // 中身を消すと再生も止まる
  $('player').hidden = true;
  $('player-controls').hidden = true;
  renderVideos();
}

function renderVideos() {
  const list = $('video-list');
  list.innerHTML = '';
  if (data.videos.length === 0) {
    list.innerHTML = '<li class="empty">「＋ 追加」から、YouTube や TikTok の「共有 → リンクをコピー」したURLを貼ってください。</li>';
    return;
  }
  for (const v of data.videos) {
    const li = document.createElement('li');
    li.className = 'video-item';
    const b = document.createElement('button');
    b.className = 'video-thumb' + (v.id === playingId ? ' playing' : '');
    if (v.kind === 'youtube') {
      b.style.backgroundImage = `url(https://i.ytimg.com/vi/${v.vid}/hqdefault.jpg)`;
      b.classList.add('has-img');
    }
    b.textContent = v.title;
    b.addEventListener('click', () => playVideo(v.id));
    const del = document.createElement('button');
    del.className = 'video-del';
    del.textContent = '×';
    del.setAttribute('aria-label', '外す');
    del.addEventListener('click', () => deleteVideo(v.id));
    li.append(b, del);
    list.appendChild(li);
  }
}

// 「🎤 押して話す」ボタン
function setupMic() {
  const btn = $('mind-mic');
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) {
    // 音声入力の仕組みがない → ボタンを隠して、キーボードのマイクを使ってもらう
    btn.hidden = true;
    return;
  }
  let rec = null;
  const stop = () => {
    btn.classList.remove('listening');
    btn.textContent = '🎤 押して話す';
    rec = null;
  };
  btn.addEventListener('click', () => {
    if (rec) { rec.stop(); return; } // 話している途中でもう一度押すと終わり
    rec = new Rec();
    rec.lang = 'ja-JP';
    rec.interimResults = false;
    rec.continuous = true;
    const before = $('mind-text').value.trim();
    let heard = '';
    rec.onresult = (e) => {
      heard = '';
      for (const r of e.results) heard += r[0].transcript;
      $('mind-text').value = [before, heard].filter(Boolean).join('\n');
    };
    rec.onerror = () => {
      showToast('音声入力が使えませんでした。キーボードのマイクで話してください');
      $('mind-text').focus();
    };
    rec.onend = stop;
    rec.start();
    btn.classList.add('listening');
    btn.textContent = '■ 話し終わったらタップ';
  });
}

function setupMind() {
  $('mind-save').addEventListener('click', saveMind);
  $('mind-bulk').addEventListener('click', copyMindBulk);
  setupMic();
  renderMoods();
  renderMindList();
}

function setupVideos() {
  $('video-add').addEventListener('click', addVideo);
  $('video-next').addEventListener('click', () => playNext(false));
  $('video-random').addEventListener('click', () => playNext(true));
  $('video-close').addEventListener('click', closePlayer);
  renderVideos();
}

// ---------- タブの切り替え ----------
// ---------- フクロウのひとこと ----------
// 画面の上のフクロウが、吹き出しで短く話しかけます。
// 記録が止まっても責めない、やさしい言葉だけにしています。
const OWL_WORDS = {
  start: ['今日もいこう！', 'まずは1種目から', 'ゆるっといこう'],
  more: ['いい感じ！', 'その調子！', 'ナイスペース'],
  saved: ['ナイス！', 'いいぞ！', '今日も一歩前進', '休憩も大事だよ', 'えらい！'],
  history: ['積み重ねてるね', 'ちゃんと続いてる'],
  mind: ['今日の気分は？', 'なんでも話してね'],
  mindSaved: ['話してくれてありがとう', '残しておいたよ'],
  motivation: ['テンション上げよ', '好きな曲かけよ'],
  tap: ['ホー！', 'がんばってるね', '水分とった？', 'フクロウだよ'],
};
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function owlSay(kind) {
  const el = $('owl-msg');
  el.textContent = pick(OWL_WORDS[kind]);
  el.classList.remove('pop');
  void el.offsetWidth; // アニメーションをもう一度動かすためのおまじない
  el.classList.add('pop');
}

// 今いるタブに合わせて話す
function owlForView(name) {
  if (name === 'record') {
    const today = data.records.some((r) => r.date === $('date').value);
    owlSay(today ? 'more' : 'start');
  } else {
    owlSay(name);
  }
}

function showView(name) {
  owlForView(name);
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  if (name === 'history') { renderHistory(); renderBackupInfo(); }
  if (name !== 'motivation' && playingId) closePlayer(); // 別のタブに移ったら動画を止める
  window.scrollTo(0, 0);
}

function onDateChange() {
  renderBodyWeight();
  renderPrevious();
  renderDayList();
}

// ---------- バックアップ(書き出し・読み込み) ----------
// data をまるごと JSON の文字列にしてファイルにします。
// C#でいう「オブジェクトをシリアライズしてファイルに保存」と同じです。
const BACKUP_LAST_KEY = 'kintore-last-backup';

function renderBackupInfo() {
  let last = null;
  try { last = localStorage.getItem(BACKUP_LAST_KEY); } catch (e) { /* 読めなくても動くように */ }
  $('backup-info').textContent = `記録 ${data.records.length}件・日記 ${data.minds.length}件` +
    (last ? ` ／ 最後の書き出し：${formatDate(last)}` : ' ／ まだ書き出していません');
}

async function exportBackup() {
  const today = toDateStr(new Date());
  const json = JSON.stringify(makeBackup(), null, 1);
  const fileName = `kintore-backup-${today.replace(/-/g, '')}.json`;
  const file = new File([json], fileName, { type: 'application/json' });

  // iPhone では「共有」画面を出して「"ファイル"に保存」を選べるようにする
  let done = false;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '筋トレ記録のバックアップ' });
      done = true;
    } catch (e) {
      if (e.name === 'AbortError') return; // 自分でキャンセルしたときは何もしない
    }
  }
  // 共有が使えないとき(パソコンなど)は普通にダウンロード
  if (!done) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  try { localStorage.setItem(BACKUP_LAST_KEY, today); } catch (e) { /* 気にしない */ }
  renderBackupInfo();
  showToast('書き出しました');
}

// 同じ id のものは重ねない(二重に読み込んでも増えない)ように合体させる
function mergeById(mine, theirs) {
  const ids = new Set(mine.map((x) => x.id));
  return [...mine, ...theirs.filter((x) => x && !ids.has(x.id))];
}

function importBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    alert('このファイルは読み込めませんでした。書き出したファイルを選んでください。');
    return;
  }
  mergeBackup(parsed, true);
}

// バックアップの中身(オブジェクト)を今の記録に合体させる。ファイルからもGoogleからも使う
function mergeBackup(parsed, ask) {
  const incoming = parsed && (parsed.data || parsed); // 包み紙あり・なし どちらでもOK
  if (!incoming || !Array.isArray(incoming.records)) {
    alert('筋トレ記録のバックアップではないようです。');
    return;
  }
  const n = incoming.records.length;
  const m = Array.isArray(incoming.minds) ? incoming.minds.length : 0;
  if (ask && !confirm(`記録 ${n}件・日記 ${m}件 を読み込みます。\n今ある記録は消さずに、足りない分だけ追加します。よろしいですか？`)) return;

  data.records = mergeById(data.records, incoming.records);
  data.minds = mergeById(data.minds, incoming.minds || []);
  data.videos = mergeById(data.videos, incoming.videos || []);
  data.bodyWeights = { ...(incoming.bodyWeights || {}), ...data.bodyWeights };
  data.exercises = [...new Set([...data.exercises, ...(incoming.exercises || [])])];
  if (Array.isArray(incoming.links) && incoming.links.length) data.links = incoming.links;
  saveData();

  renderExercises();
  renderLinks();
  renderVideos();
  renderMindList();
  renderHistory();
  onDateChange();
  renderBackupInfo();
  if (ask) showToast('読み込みました');
}

function makeBackup() {
  return { app: 'kintore', version: 1, exportedAt: new Date().toISOString(), data };
}

// ---------- Googleドライブへの自動保存 ----------
// Google側に置いた小さなスクリプト(住所=URL)に、記録をまるごと送ります。
// URLと合言葉はこの端末の中だけに保存し、公開しているコードには書きません。
const CLOUD_KEY = 'kintore-cloud';
let cloudTimer = null;

function cloudSettings() {
  try { return JSON.parse(localStorage.getItem(CLOUD_KEY)) || null; } catch (e) { return null; }
}
function setCloudStatus(text) {
  const c = cloudSettings();
  if (c) { c.status = text; try { localStorage.setItem(CLOUD_KEY, JSON.stringify(c)); } catch (e) { /* 気にしない */ } }
  renderCloudInfo();
}
function renderCloudInfo() {
  const c = cloudSettings();
  $('cloud-info').textContent = c ? `Googleに自動保存：オン（${c.status || '待機中'}）` : 'Googleに自動保存：オフ';
  $('cloud-setup').textContent = c ? '設定を変える' : '☁ 自動保存を設定';
  $('cloud-restore').hidden = !c;
}

// 保存のたびにすぐ送ると何度も通信するので、3秒まとめてから送る
function scheduleCloudSave() {
  if (!cloudSettings()) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(cloudSave, 3000);
}

async function cloudSave() {
  const c = cloudSettings();
  if (!c) return;
  try {
    // 中身を文字として送る(ブラウザの余計な確認が起きない送り方)
    const res = await fetch(c.url, { method: 'POST', body: JSON.stringify({ key: c.key, backup: makeBackup() }) });
    const r = await res.json();
    if (!r.ok) throw new Error(r.error);
    const t = new Date();
    setCloudStatus(`${t.getMonth() + 1}/${t.getDate()} ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')} 保存済み`);
  } catch (e) {
    // 電波がないときなど。次に記録したとき・アプリを開いたときに、もう一度送る
    setCloudStatus(e.message === 'key' ? '合言葉がちがいます' : 'まだ送れていません');
  }
}

async function cloudLoad(ask) {
  const c = cloudSettings();
  if (!c) return false;
  const res = await fetch(`${c.url}?key=${encodeURIComponent(c.key)}`);
  const r = await res.json();
  if (!r.ok) throw new Error(r.error);
  if (r.backup) mergeBackup(r.backup, ask);
  return true;
}

async function setupCloud() {
  const c = cloudSettings() || {};
  const url = prompt('Googleのスクリプトの URL を貼ってください\n(空にすると自動保存をオフにします)', c.url || '');
  if (url === null) return;
  if (!url.trim()) {
    try { localStorage.removeItem(CLOUD_KEY); } catch (e) { /* 気にしない */ }
    renderCloudInfo();
    return;
  }
  if (!/^https:\/\/script\.google\.com\//.test(url.trim())) { alert('script.google.com で始まる URL を貼ってください'); return; }
  const key = prompt('合言葉を入れてください', c.key || '');
  if (!key) return;
  try { localStorage.setItem(CLOUD_KEY, JSON.stringify({ url: url.trim(), key })); } catch (e) { return; }
  // 大事：新しいアイコンの空っぽの記録で上書きしないよう、先にGoogleの記録を取り込んでから送る
  try {
    await cloudLoad(false);
    await cloudSave();
    showToast('つながりました');
  } catch (e) {
    setCloudStatus(e.message === 'key' ? '合言葉がちがいます' : 'つながりませんでした');
  }
}

function setupBackup() {
  $('cloud-setup').addEventListener('click', setupCloud);
  $('cloud-restore').addEventListener('click', async () => {
    try { await cloudLoad(true); } catch (e) { alert('Googleから読み込めませんでした。電波と設定を確認してください。'); }
  });
  renderCloudInfo();
  // 前回送れていなかったときのために、開いたときにも1回送る
  if (cloudSettings()) scheduleCloudSave();

  $('backup-export').addEventListener('click', exportBackup);
  $('backup-import').addEventListener('click', () => $('backup-file').click());
  $('backup-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = ''; // 同じファイルをもう一度選べるように空にしておく
    if (f) importBackup(await f.text());
  });
  renderBackupInfo();
}

// ---------- 起動時の処理 ----------
function init() {
  $('date').value = toDateStr(new Date());
  $('date').addEventListener('change', onDateChange);
  $('bodyweight').addEventListener('change', saveBodyWeight);
  $('save').addEventListener('click', saveRecord);
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
  $('owl').addEventListener('click', () => owlSay('tap'));
  owlForView('record');

  setupSteppers();
  setupLinks();
  setupMind();
  setupVideos();
  setupBackup();
  selectExercise(form.exercise);
  onDateChange();

  // オフライン(電波がない場所)でも開けるようにする仕組みを登録
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn(e));
  }
}

init();
