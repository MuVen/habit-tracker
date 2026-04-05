// Habit Tracker — Application Logic
// Data persisted in localStorage

const STORAGE_KEY = 'habit-tracker-data';
const ICONS = [
  'heart-pulse', 'book-open', 'dumbbell', 'droplets', 'brain',
  'moon', 'apple', 'pen-line', 'music', 'bike', 'coffee', 'salad',
  'briefcase', 'footprints', 'code', 'sparkles', 'bed-double',
  'trending-up', 'bot', 'sun',
];
const COLORS = [
  '#D97706', '#059669', '#2563EB', '#7C3AED', '#DB2777',
  '#DC2626', '#0891B2', '#4F46E5', '#CA8A04', '#16A34A',
];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const FREQUENCIES = [
  { id: 'daily', label: 'Daily', icon: 'calendar' },
  { id: 'alternate', label: 'Alternate Days', icon: 'calendar-clock' },
  { id: 'custom', label: 'Custom Days', icon: 'calendar-check' },
];

let state = loadState();
let selectedIcon = ICONS[0];
let selectedColor = COLORS[0];
let selectedFrequency = 'daily';
let selectedCustomDays = [0, 1, 2, 3, 4, 5, 6]; // all days selected by default (Mon=0..Sun=6)

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { habits: [], completions: {} };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isScheduledFor(habit, date) {
  const freq = habit.frequency || 'daily';
  if (freq === 'daily') return true;
  if (freq === 'alternate') {
    // Count days since habit creation; scheduled on even-numbered days
    const created = new Date(habit.createdAt);
    const diffDays = Math.floor((date - created) / 86400000);
    return diffDays >= 0 && diffDays % 2 === 0;
  }
  if (freq === 'custom') {
    const dayIdx = (date.getDay() + 6) % 7; // Mon=0..Sun=6
    return (habit.customDays || []).includes(dayIdx);
  }
  return true;
}

function isCompleted(habitId, date) {
  const key = dateKey(date);
  return state.completions[key]?.includes(habitId) || false;
}

function toggleCompletion(habitId, date) {
  const key = dateKey(date);
  if (!state.completions[key]) state.completions[key] = [];
  const arr = state.completions[key];
  const idx = arr.indexOf(habitId);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(habitId);
  saveState();
  render();
}

function deleteHabit(habitId) {
  state.habits = state.habits.filter(h => h.id !== habitId);
  Object.keys(state.completions).forEach(key => {
    state.completions[key] = state.completions[key].filter(id => id !== habitId);
  });
  saveState();
  render();
}

// Stats
function computeStats() {
  const today = todayKey();
  const todayDate = new Date();
  const scheduledToday = state.habits.filter(h => isScheduledFor(h, todayDate));
  const totalToday = scheduledToday.length;
  const doneToday = totalToday > 0 ? scheduledToday.filter(h => (state.completions[today] || []).includes(h.id)).length : 0;

  // Current streak — all scheduled habits completed each day
  let streak = 0;
  if (state.habits.length > 0) {
    const d = new Date();
    while (true) {
      const key = dateKey(d);
      const scheduled = state.habits.filter(h => isScheduledFor(h, d));
      if (scheduled.length === 0) { d.setDate(d.getDate() - 1); continue; }
      const done = scheduled.filter(h => (state.completions[key] || []).includes(h.id)).length;
      if (done === scheduled.length) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
  }

  // Best streak
  let best = 0, cur = 0;
  if (state.habits.length > 0) {
    const d = new Date();
    d.setDate(d.getDate() - 89);
    for (let i = 0; i < 90; i++) {
      const key = dateKey(d);
      const scheduled = state.habits.filter(h => isScheduledFor(h, d));
      if (scheduled.length === 0) { d.setDate(d.getDate() + 1); continue; }
      const done = scheduled.filter(h => (state.completions[key] || []).includes(h.id)).length;
      if (done === scheduled.length) { cur++; best = Math.max(best, cur); }
      else cur = 0;
      d.setDate(d.getDate() + 1);
    }
  }

  // Weekly rate — only count scheduled days per habit
  const week = getWeekDates();
  let weekTotal = 0, weekDone = 0;
  week.forEach(d => {
    state.habits.forEach(h => {
      if (isScheduledFor(h, d)) {
        weekTotal++;
        if (isCompleted(h.id, d)) weekDone++;
      }
    });
  });
  const weeklyRate = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;

  return { doneToday, total: totalToday, streak, best, weeklyRate };
}

// Render
function render() {
  const stats = computeStats();
  document.getElementById('stat-streak').textContent = stats.streak;
  document.getElementById('stat-today').textContent = `${stats.doneToday}/${stats.total}`;
  document.getElementById('stat-weekly').textContent = `${stats.weeklyRate}%`;
  document.getElementById('stat-best').textContent = stats.best;

  const now = new Date();
  const dateEl = document.getElementById('header-date');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  renderWeeklyBars();
  renderDayLabels();
  renderHabits();
  renderHeatmap();
  renderCharts();
  lucide.createIcons();
}

function renderDayLabels() {
  const week = getWeekDates();
  const today = todayKey();
  const container = document.getElementById('day-labels');
  container.innerHTML = week.map(d => {
    const isToday = dateKey(d) === today;
    return `<span class="flex h-7 w-7 items-center justify-center text-center text-[11px] font-medium sm:h-8 sm:w-8 ${isToday ? 'font-bold text-brand-600 dark:text-brand-400' : 'text-gray-400'}">${DAYS[((d.getDay() + 6) % 7)]}</span>`;
  }).join('');
}

function renderWeeklyBars() {
  const week = getWeekDates();
  const today = todayKey();
  const container = document.getElementById('weekly-bars');

  const range = document.getElementById('week-range');
  range.textContent = `${week[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${week[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  container.innerHTML = week.map((d, i) => {
    const key = dateKey(d);
    const scheduled = state.habits.filter(h => isScheduledFor(h, d));
    const total = scheduled.length || 1;
    const done = scheduled.filter(h => (state.completions[key] || []).includes(h.id)).length;
    const pct = Math.round((done / total) * 100);
    const isToday = key === today;
    const isFuture = d > new Date();
    const barColor = pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700';

    return `
      <div class="flex flex-1 flex-col items-center gap-1">
        <span class="text-[11px] font-semibold tabular-nums ${pct > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}">${isFuture ? '' : pct + '%'}</span>
        <div class="relative h-24 w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 sm:h-28">
          <div class="weekly-bar-fill absolute bottom-0 w-full rounded-lg ${barColor} transition-all" style="height:${isFuture ? 0 : pct}%; animation-delay:${i * 70}ms"></div>
        </div>
        <span class="text-[11px] font-medium ${isToday ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-gray-400'}">${DAYS[(d.getDay() + 6) % 7]}</span>
      </div>`;
  }).join('');
}

function renderHabits() {
  const week = getWeekDates();
  const list = document.getElementById('habit-list');
  const empty = document.getElementById('empty-state');

  if (state.habits.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = state.habits.map((h, idx) => {
    const cells = week.map(d => {
      const done = isCompleted(h.id, d);
      const isFuture = d > new Date();
      const scheduled = isScheduledFor(h, d);
      if (!scheduled) {
        return `
          <div class="flex h-7 w-7 items-center justify-center rounded-md text-gray-300 dark:text-gray-700 sm:h-8 sm:w-8" title="Not scheduled">
            <i data-lucide="minus" class="h-3 w-3"></i>
          </div>`;
      }
      return `
        <button
          class="check-cell flex h-7 w-7 items-center justify-center rounded-md text-xs transition sm:h-8 sm:w-8 ${
            done
              ? 'completed text-white shadow-sm'
              : isFuture
                ? 'bg-gray-50 dark:bg-gray-800 cursor-default opacity-30'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
          }"
          ${isFuture ? 'disabled' : ''}
          onclick="toggleCompletion('${h.id}', new Date('${dateKey(d)}'))"
          aria-label="${done ? 'Mark incomplete' : 'Mark complete'} ${h.name} ${dateKey(d)}"
          style="${done ? 'background-color:' + h.color : ''}"
        >
          ${done ? '<i data-lucide="check" class="h-3.5 w-3.5"></i>' : ''}
        </button>`;
    }).join('');

    const freqLabel = getFrequencyLabel(h);
    const timeSlot = h.timeSlot ? `<span class="inline-flex items-center gap-1 rounded-[4px] bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"><i data-lucide="clock" class="h-2.5 w-2.5"></i>${escapeHtml(h.timeSlot)}</span>` : '';

    return `
      <div class="habit-row group flex items-center gap-3 rounded-xl border border-gray-200/80 bg-white px-3 py-2.5 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900 sm:px-4 sm:py-3" style="animation-delay:${idx * 40}ms">
        <div class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition hover:scale-105" style="background-color:${h.color}15; color:${h.color}" onclick="editHabit('${h.id}')" title="Edit habit">
          <i data-lucide="${h.icon}" class="h-[18px] w-[18px]"></i>
        </div>
        <div class="min-w-0 flex-1 cursor-pointer" onclick="editHabit('${h.id}')" title="Edit habit">
          <p class="truncate text-[13px] font-semibold leading-tight">${escapeHtml(h.name)}</p>
          <div class="mt-0.5 flex flex-wrap items-center gap-1">
            <span class="inline-flex items-center gap-0.5 rounded-[4px] bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <i data-lucide="${freqLabel.icon}" class="h-2.5 w-2.5"></i>${freqLabel.text}
            </span>
            ${timeSlot}
            <span class="text-[11px] text-gray-400">${getHabitCompletionText(h)}</span>
          </div>
        </div>
        <div class="flex items-center gap-1">${cells}</div>
        <div class="ml-0.5 flex flex-col gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button onclick="editHabit('${h.id}')" class="rounded-md p-1 text-gray-300 transition hover:bg-brand-50 hover:text-brand-600 dark:text-gray-600 dark:hover:bg-brand-900/30 dark:hover:text-brand-400" aria-label="Edit ${escapeHtml(h.name)}">
            <i data-lucide="pencil" class="h-3.5 w-3.5"></i>
          </button>
          <button onclick="deleteHabit('${h.id}')" class="rounded-md p-1 text-gray-300 transition hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-950 dark:hover:text-red-400" aria-label="Delete ${escapeHtml(h.name)}">
            <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
          </button>
        </div>
      </div>`;
  }).join('');
}

function getFrequencyLabel(habit) {
  const freq = habit.frequency || 'daily';
  if (freq === 'daily') return { text: 'Daily', icon: 'calendar' };
  if (freq === 'alternate') return { text: 'Alternate', icon: 'calendar-clock' };
  if (freq === 'custom') {
    const dayNames = (habit.customDays || []).map(i => DAYS[i].slice(0, 2)).join(', ');
    return { text: dayNames || 'Custom', icon: 'calendar-check' };
  }
  return { text: 'Daily', icon: 'calendar' };
}

function getHabitCompletionText(habit) {
  const week = getWeekDates();
  const scheduledDays = week.filter(d => isScheduledFor(habit, d));
  const done = scheduledDays.filter(d => isCompleted(habit.id, d)).length;
  return `${done}/${scheduledDays.length} this week`;
}

function renderHeatmap() {
  const container = document.getElementById('heatmap');
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 27);

  // Align to Monday
  const dayOfWeek = (startDate.getDay() + 6) % 7;
  startDate.setDate(startDate.getDate() - dayOfWeek);

  const total = state.habits.length || 1;
  let html = '';

  // Day headers
  DAYS.forEach(d => {
    html += `<div class="text-center text-[10px] font-medium text-gray-400 dark:text-gray-500">${d.charAt(0)}</div>`;
  });

  const numWeeks = 4;
  for (let w = 0; w < numWeeks; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + w * 7 + d);
      const key = dateKey(date);
      const isFuture = date > today;
      const done = state.habits.filter(h => isScheduledFor(h, date) && (state.completions[key] || []).includes(h.id)).length;
      const scheduled = state.habits.filter(h => isScheduledFor(h, date)).length;
      const ratio = scheduled > 0 ? done / scheduled : 0;

      let bgClass;
      if (isFuture) bgClass = 'bg-gray-50 dark:bg-gray-800/50';
      else if (ratio === 0) bgClass = 'bg-gray-100 dark:bg-gray-800';
      else if (ratio <= 0.25) bgClass = 'bg-emerald-200 dark:bg-emerald-900/40';
      else if (ratio <= 0.5) bgClass = 'bg-emerald-300 dark:bg-emerald-800/60';
      else if (ratio <= 0.75) bgClass = 'bg-emerald-400 dark:bg-emerald-700';
      else bgClass = 'bg-emerald-500 dark:bg-emerald-600';

      const delay = (w * 7 + d) * 15;
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      html += `<div class="heatmap-cell aspect-square rounded-md ${bgClass}" style="animation-delay:${delay}ms" data-tooltip="${label}: ${done}/${scheduled}"></div>`;
    }
  }
  container.innerHTML = html;
}

// Charts
let trendChart = null;
let habitsChart = null;

function renderCharts() {
  renderTrendChart();
  renderHabitsBarChart();
}

function renderTrendChart() {
  const ctx = document.getElementById('chart-trend');
  if (!ctx) return;

  const isDark = document.documentElement.classList.contains('dark');
  const labels = [];
  const data = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dateKey(d);
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    const scheduled = state.habits.filter(h => isScheduledFor(h, d));
    const done = scheduled.filter(h => (state.completions[key] || []).includes(h.id)).length;
    data.push(scheduled.length > 0 ? Math.round((done / scheduled.length) * 100) : 0);
  }

  if (trendChart) trendChart.destroy();

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Completion %',
        data,
        borderColor: '#6366F1',
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHitRadius: 10,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#6366F1',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#1E293B' : '#0F172A',
          titleFont: { size: 11, family: 'Inter' },
          bodyFont: { size: 12, family: 'Inter', weight: 600 },
          padding: 8,
          cornerRadius: 6,
          displayColors: false,
          callbacks: { label: (ctx) => `${ctx.parsed.y}% completed` },
        },
      },
      scales: {
        x: {
          display: true,
          grid: { display: false },
          ticks: { font: { size: 10, family: 'Inter' }, color: isDark ? '#64748B' : '#94A3B8', maxTicksLimit: 7 },
          border: { display: false },
        },
        y: {
          display: true,
          min: 0, max: 100,
          grid: { color: isDark ? '#1E293B' : '#F1F5F9', drawTicks: false },
          ticks: { font: { size: 10, family: 'Inter' }, color: isDark ? '#64748B' : '#94A3B8', stepSize: 25, callback: v => v + '%', padding: 8 },
          border: { display: false },
        },
      },
    },
  });
}

function renderHabitsBarChart() {
  const ctx = document.getElementById('chart-habits');
  if (!ctx) return;

  const isDark = document.documentElement.classList.contains('dark');
  const week = getWeekDates();
  const labels = [];
  const data = [];
  const colors = [];

  state.habits.forEach(h => {
    const scheduledDays = week.filter(d => isScheduledFor(h, d));
    const done = scheduledDays.filter(d => isCompleted(h.id, d)).length;
    const pct = scheduledDays.length > 0 ? Math.round((done / scheduledDays.length) * 100) : 0;
    labels.push(h.name.length > 14 ? h.name.slice(0, 13) + '…' : h.name);
    data.push(pct);
    colors.push(h.color);
  });

  if (habitsChart) habitsChart.destroy();

  habitsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Completion %',
        data,
        backgroundColor: colors.map(c => c + '30'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.7,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#1E293B' : '#0F172A',
          titleFont: { size: 11, family: 'Inter' },
          bodyFont: { size: 12, family: 'Inter', weight: 600 },
          padding: 8,
          cornerRadius: 6,
          displayColors: false,
          callbacks: { label: (ctx) => `${ctx.parsed.x}% this week` },
        },
      },
      scales: {
        x: {
          min: 0, max: 100,
          grid: { color: isDark ? '#1E293B' : '#F1F5F9', drawTicks: false },
          ticks: { font: { size: 10, family: 'Inter' }, color: isDark ? '#64748B' : '#94A3B8', stepSize: 25, callback: v => v + '%', padding: 4 },
          border: { display: false },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11, family: 'Inter', weight: 500 }, color: isDark ? '#CBD5E1' : '#475569', padding: 4 },
          border: { display: false },
        },
      },
    },
  });
}

// Modal
function openModal(editId) {
  const backdrop = document.getElementById('modal-backdrop');
  backdrop.classList.remove('hidden');

  const titleEl = document.getElementById('modal-title');
  const submitBtn = document.getElementById('modal-submit-btn');
  const editIdInput = document.getElementById('habit-edit-id');

  if (editId) {
    // Edit mode — pre-fill form
    const h = state.habits.find(h => h.id === editId);
    if (!h) return;
    titleEl.textContent = 'Edit Habit';
    submitBtn.textContent = 'Save Changes';
    editIdInput.value = editId;
    document.getElementById('habit-name').value = h.name;
    document.getElementById('habit-time').value = h.timeSlot || '';
    selectedIcon = h.icon;
    selectedColor = h.color;
    selectedFrequency = h.frequency || 'daily';
    selectedCustomDays = h.customDays ? [...h.customDays] : [0, 1, 2, 3, 4, 5, 6];
  } else {
    // Add mode — reset form
    titleEl.textContent = 'New Habit';
    submitBtn.textContent = 'Add Habit';
    editIdInput.value = '';
    document.getElementById('habit-form').reset();
    selectedIcon = ICONS[0];
    selectedColor = COLORS[0];
    selectedFrequency = 'daily';
    selectedCustomDays = [0, 1, 2, 3, 4, 5, 6];
  }

  renderIconPicker();
  renderColorPicker();
  renderFrequencyPicker();
  requestAnimationFrame(() => backdrop.classList.add('open'));
  document.getElementById('habit-name').focus();
  lucide.createIcons();
}

function editHabit(habitId) {
  openModal(habitId);
}

function closeModal() {
  const backdrop = document.getElementById('modal-backdrop');
  backdrop.classList.remove('open');
  setTimeout(() => backdrop.classList.add('hidden'), 200);
  document.getElementById('habit-form').reset();
}

function renderIconPicker() {
  const container = document.getElementById('icon-picker');
  container.innerHTML = ICONS.map(icon => `
    <button type="button" class="picker-option flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 ${icon === selectedIcon ? 'selected' : ''}"
      onclick="selectIcon('${icon}', this)" aria-label="${icon}">
      <i data-lucide="${icon}" class="h-4 w-4"></i>
    </button>
  `).join('');
}

function renderColorPicker() {
  const container = document.getElementById('color-picker');
  container.innerHTML = COLORS.map(color => `
    <button type="button" class="picker-option flex h-9 w-9 items-center justify-center rounded-lg ${color === selectedColor ? 'selected' : ''}"
      style="background-color:${color}" onclick="selectColor('${color}', this)" aria-label="Color ${color}">
      ${color === selectedColor ? '<i data-lucide="check" class="h-3.5 w-3.5 text-white"></i>' : ''}
    </button>
  `).join('');
}

function selectIcon(icon, el) {
  selectedIcon = icon;
  document.querySelectorAll('#icon-picker .picker-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

function selectColor(color, el) {
  selectedColor = color;
  renderColorPicker();
  lucide.createIcons();
}

function renderFrequencyPicker() {
  const container = document.getElementById('frequency-picker');
  container.innerHTML = FREQUENCIES.map(f => `
    <button type="button" class="picker-option flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] ${f.id === selectedFrequency ? 'selected bg-brand-50 text-brand-700 font-semibold dark:bg-brand-900/30 dark:text-brand-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}"
      onclick="selectFrequency('${f.id}')">
      <i data-lucide="${f.icon}" class="h-3.5 w-3.5"></i>${f.label}
    </button>
  `).join('');

  const customDaysPicker = document.getElementById('custom-days-picker');
  if (selectedFrequency === 'custom') {
    customDaysPicker.classList.remove('hidden');
    customDaysPicker.innerHTML = DAYS.map((day, i) => `
      <button type="button" class="flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-semibold transition ${
        selectedCustomDays.includes(i)
          ? 'bg-brand-600 text-white shadow-sm'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
      }" onclick="toggleCustomDay(${i})">${day.slice(0, 2)}</button>
    `).join('');
  } else {
    customDaysPicker.classList.add('hidden');
  }
}

function selectFrequency(freq) {
  selectedFrequency = freq;
  if (freq === 'custom') selectedCustomDays = [];
  renderFrequencyPicker();
  lucide.createIcons();
}

function toggleCustomDay(dayIdx) {
  const idx = selectedCustomDays.indexOf(dayIdx);
  if (idx >= 0) selectedCustomDays.splice(idx, 1);
  else selectedCustomDays.push(dayIdx);
  selectedCustomDays.sort();
  renderFrequencyPicker();
  lucide.createIcons();
}

function handleSaveHabit(e) {
  e.preventDefault();
  const name = document.getElementById('habit-name').value.trim();
  const timeSlot = document.getElementById('habit-time').value.trim();
  const editId = document.getElementById('habit-edit-id').value;
  if (!name) return;
  if (selectedFrequency === 'custom' && selectedCustomDays.length === 0) {
    alert('Please select at least one day for custom frequency.');
    return;
  }

  if (editId) {
    // Update existing habit
    const h = state.habits.find(h => h.id === editId);
    if (h) {
      h.name = name;
      h.icon = selectedIcon;
      h.color = selectedColor;
      h.frequency = selectedFrequency;
      h.timeSlot = timeSlot || undefined;
      if (selectedFrequency === 'custom') h.customDays = [...selectedCustomDays];
      else delete h.customDays;
    }
  } else {
    // Add new habit
    const habit = {
      id: 'h_' + Date.now(),
      name,
      icon: selectedIcon,
      color: selectedColor,
      frequency: selectedFrequency,
      createdAt: todayKey(),
    };
    if (timeSlot) habit.timeSlot = timeSlot;
    if (selectedFrequency === 'custom') habit.customDays = [...selectedCustomDays];
    state.habits.push(habit);
  }

  state.habits.push(habit);
  saveState();
  closeModal();
  selectedIcon = ICONS[0];
  selectedColor = COLORS[0];
  selectedFrequency = 'daily';
  selectedCustomDays = [0, 1, 2, 3, 4, 5, 6];
  render();
  return false;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Theme
function initTheme() {
  const saved = localStorage.getItem('habit-theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('habit-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  lucide.createIcons();
});

document.getElementById('add-habit-btn').addEventListener('click', openModal);

// Close modal on backdrop click
document.getElementById('modal-backdrop').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Seed user habits — version-controlled to allow re-seeding on update
const SEED_VERSION = 3;
function seedDemoData() {
  const seeded = localStorage.getItem('habit-seed-version');
  if (seeded === String(SEED_VERSION)) return;

  // Day index: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
  const myHabits = [
    {
      id: 'h_pooja', name: 'Pooja by 6 AM', icon: 'sparkles', color: '#D97706',
      frequency: 'daily', timeSlot: '5:30 – 6:00 AM',
      createdAt: todayKey(),
    },
    {
      id: 'h_office', name: 'Office 8:30–5:30', icon: 'briefcase', color: '#2563EB',
      frequency: 'custom', customDays: [0, 1, 2, 3, 4], timeSlot: '8:30 AM – 5:30 PM',
      createdAt: todayKey(),
    },
    {
      id: 'h_walking', name: 'Walking — 400 Cal', icon: 'footprints', color: '#059669',
      frequency: 'daily', timeSlot: '1 hr daily',
      createdAt: todayKey(),
    },
    {
      id: 'h_sysdesign', name: 'System Design', icon: 'book-open', color: '#7C3AED',
      frequency: 'custom', customDays: [1, 2, 3, 4], timeSlot: '1 hr · 45 day goal',
      createdAt: todayKey(),
    },
    {
      id: 'h_leetcode', name: 'LeetCode', icon: 'code', color: '#DB2777',
      frequency: 'custom', customDays: [1, 2, 3, 4], timeSlot: '45 min',
      createdAt: todayKey(),
    },
    {
      id: 'h_stockmarket', name: 'Stock Market Reading', icon: 'trending-up', color: '#CA8A04',
      frequency: 'custom', customDays: [5, 6], timeSlot: '2 hrs · Sat & Sun',
      createdAt: todayKey(),
    },
    {
      id: 'h_aiml', name: 'AI/ML Reading', icon: 'bot', color: '#4F46E5',
      frequency: 'custom', customDays: [0], timeSlot: '2 hrs · Monday',
      createdAt: todayKey(),
    },
    {
      id: 'h_sleep', name: 'Sleep by 10:30 PM', icon: 'bed-double', color: '#0891B2',
      frequency: 'daily', timeSlot: 'By 10:30 PM',
      createdAt: todayKey(),
    },
  ];

  state.habits = myHabits;
  state.completions = {};

  // Seed some sample completions for past 6 days
  const today = new Date();
  for (let i = 1; i <= 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dateKey(d);
    state.completions[key] = [];
    myHabits.forEach(h => {
      if (isScheduledFor(h, d) && Math.random() > 0.25) {
        state.completions[key].push(h.id);
      }
    });
  }

  saveState();
  localStorage.setItem('habit-seed-version', String(SEED_VERSION));
}

// Init
initTheme();
seedDemoData();
render();
