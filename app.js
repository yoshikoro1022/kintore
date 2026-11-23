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

// アプリ全体のデータ
//   records     : 記録の一覧 [{ id, date, exercise, weight, reps, sets, createdAt }, ...]
//   bodyWeights : 日付ごとの体重 { '2026-11-23': 70.5, ... }
//   exercises   : 種目の一覧
const data = loadData();

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
  selectExercise(form.exercise);
  onDateChange();

  // オフライン(電波がない場所)でも開けるようにする仕組みを登録
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn(e));
  }
}

init();
