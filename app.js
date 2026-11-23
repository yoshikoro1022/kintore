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
//   links       : やる気スイッチのボタン [{ name, url }, ...]
const data = loadData();
// 古いデータには links がないので、そのときは最初のボタンを入れておく
if (!Array.isArray(data.links)) data.links = DEFAULT_LINKS.map((l) => ({ ...l }));
// マインド日記 [{ id, date, mood, text, createdAt }, ...]。古いデータにはないので空で用意
if (!Array.isArray(data.minds)) data.minds = [];

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

// ---------- やる気スイッチ(音楽・動画を開くボタン) ----------
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
  $('link-edit-done').addEventListener('click', () => { $('link-editor').hidden = true; });
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

// ---------- タブの切り替え ----------
function showView(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  if (name === 'history') renderHistory();
  window.scrollTo(0, 0);
}

function onDateChange() {
  renderBodyWeight();
  renderPrevious();
  renderDayList();
}

// ---------- 起動時の処理 ----------
function init() {
  $('date').value = toDateStr(new Date());
  $('date').addEventListener('change', onDateChange);
  $('bodyweight').addEventListener('change', saveBodyWeight);
  $('save').addEventListener('click', saveRecord);
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));

  setupSteppers();
  setupLinks();
  setupMind();
  selectExercise(form.exercise);
  onDateChange();

  // オフライン(電波がない場所)でも開けるようにする仕組みを登録
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn(e));
  }
}

init();
