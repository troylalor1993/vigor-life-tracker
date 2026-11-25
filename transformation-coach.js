/* Transformation coaching uses the private tracker backup and manual sharing. */
(() => {
  'use strict';

  const assignments = [
    'Day shift · 10-minute walk after a meal.',
    'Day shift · 5 minutes of mobility. Optional 10-minute post-meal walk.',
    'First night · 15–20 minutes of conversational walking or cycling before work. Extend to 25 minutes if rested.',
    'Second night · 5 minutes of mobility or an easy post-meal walk.',
    'First day off · Protect recovery sleep. Walk for up to 10 minutes after a meal if you feel up to it.',
    'Lift A · Leg press or box squat, dumbbell bench press, chest-supported row, dumbbell Romanian deadlift.',
    'Day off · 20–25 minutes of conversational cardio, split if needed. Add 5–10 minutes if rested.',
    'Lift B · Leg press or supported split squat, incline dumbbell press, lat pulldown, hip thrust.'
  ];
  const liftInstructions = 'Allow 25–30 minutes. Do 2 sets of 8–12 reps per movement with about 3 reps left. In 15 minutes, do 1 set per movement after warming up. If rested, add 10–15 minutes of easy cardio.';
  const $ = id => document.getElementById(id);
  const card = $('transformationCoach');
  const form = $('transformationForm');
  const status = $('transformationStatus');
  const fallback = $('transformationCopy');
  const dayMs = 86400000;
  const period = $('transformationPeriod');
  let loadedDate;
  let savedRecord;

  function localDate() {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function rotationFor(date, anchor) {
    const timestamp = Date.parse(date);
    const delta = Math.round((timestamp - Date.parse(anchor)) / dayMs);
    if (!Number.isFinite(delta)) return null;
    const index = ((delta % 8) + 8) % 8;
    return {
      index,
      dates: Array.from({length: 8}, (_, day) => new Date(timestamp + (day - index) * dayMs).toISOString().slice(0, 10))
    };
  }

  function getContext() {
    const data = window.vigorCloudBridge?.read();
    const date = localDate();
    const rotation = data && data.cycleLength !== 7 ? rotationFor(date, data.anchor) : null;
    return {data, date, rotation};
  }

  function average(values) {
    return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : '—';
  }

  function summarize(data, dates) {
    const records = dates.map(date => data.transformationCheckins?.[date] || {});
    const lifts = [records[5], records[7]];
    const fullLifts = lifts.filter(entry => entry.effort === 'Done').length;
    const shortLifts = lifts.filter(entry => entry.effort === 'Short version').length;
    const walks = records.filter(entry => Number(entry.walk) >= 10).length;
    const walkMinutes = records.reduce((minutes, entry) => minutes + (Number(entry.walk) || 0), 0);
    const weighIns = (data.measurements || []).filter(entry => dates.includes(entry.date));
    const weights = weighIns.map(entry => Number(entry.weight)).filter(weight => weight > 0);
    const waist = weighIns.filter(entry => Number(entry.waist) > 0).sort((a, b) => b.date.localeCompare(a.date))[0]?.waist;
    const sleep = records.filter(entry => entry.sleep != null && entry.sleep !== '').map(entry => Number(entry.sleep));
    return [
      dates[0] + ' to ' + dates[7],
      'Lifts: ' + fullLifts + ' full, ' + shortLifts + ' short (2 planned)',
      'Post-meal walks: ' + walks + '/4 of at least 10 min · ' + walkMinutes + ' min total',
      'Average weight: ' + average(weights) + (weights.length ? ' lb (' + weights.length + ' recorded)' : ''),
      'Latest waist: ' + (waist ? waist + ' in' : '—'),
      'Average sleep: ' + average(sleep) + (sleep.length ? ' h' : ''),
      ...lifts.flatMap((entry, index) => entry.notes && ['Done', 'Short version'].includes(entry.effort)
        ? ['Lift ' + (index ? 'B' : 'A') + ' log: ' + entry.notes] : [])
    ].join('\n');
  }

  function reviewDates(rotation) {
    if (period.value === 'current') return rotation.dates;
    return rotation.dates.map(date => new Date(Date.parse(date) - 8 * dayMs).toISOString().slice(0, 10));
  }

  function render() {
    const {data, date, rotation} = getContext();
    card.hidden = !rotation;
    if (!rotation) return;
    const index = rotation.index;
    $('transformationAssignment').textContent = 'Day ' + (index + 1) + ' of 8 · ' + assignments[index] +
      ([5, 7].includes(index) ? ' ' + liftInstructions : '');
    $('transformationReview').textContent = summarize(data, reviewDates(rotation));
    const record = data.transformationCheckins?.[date] || {};
    const serialized = JSON.stringify(record);
    if (date !== loadedDate || serialized !== savedRecord) {
      for (const input of form.elements) {
        if (input.name) input.value = record[input.name] ?? '';
      }
      fallback.hidden = true;
      status.textContent = '';
      loadedDate = date;
      savedRecord = serialized;
    }
  }

  function fields() {
    return Object.fromEntries(new FormData(form));
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      fallback.hidden = true;
      status.textContent = 'Copied. Paste it into your coaching chat.';
    } catch {
      fallback.value = text;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      status.textContent = 'Select and copy the update below.';
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const entry = fields();
    if (entry.effort === 'Missed' && !entry.next.trim()) {
      status.textContent = 'Choose a next time for your missed assignment.';
      form.elements.next.focus();
      return;
    }
    try {
      window.vigorCloudBridge.saveTransformationCheckin(loadedDate, entry);
      status.textContent = 'Check-in saved on this device.';
    } catch (error) {
      status.textContent = error.message;
    }
  });
  $('copyCoachUpdate').addEventListener('click', () => {
    const {data, date, rotation} = getContext();
    if (!rotation || date !== loadedDate || !form.reportValidity()) return;
    const entry = fields();
    const lastDate = Object.keys(data.transformationCheckins || {}).filter(day => day < date).sort().at(-1);
    const lastCommitment = data.transformationCheckins?.[lastDate]?.next;
    copy([
      'Vigor Life · ' + date + ' · Day ' + (rotation.index + 1) + '/8',
      assignments[rotation.index],
      ...(lastCommitment ? ['Previous commitment (' + lastDate + '): ' + lastCommitment] : []),
      'Sleep: ' + (entry.sleep === '' ? '—' : entry.sleep + ' h') + ' | Energy: ' + (entry.energy || '—'),
      'Assignment: ' + (entry.effort || '—') + ' | Post-meal walk: ' + (entry.walk === '' ? '—' : entry.walk + ' min'),
      'Food plan: ' + (entry.food || '—'),
      'Pain, training or obstacle: ' + (entry.notes || '—'),
      'Next commitment: ' + (entry.next || '—')
    ].join('\n'));
  });
  $('copyCoachReview').addEventListener('click', () => {
    const {data, rotation} = getContext();
    if (rotation) copy('Vigor Life · Rotation review\n' + summarize(data, reviewDates(rotation)));
  });
  period.addEventListener('change', render);
  window.addEventListener('vigor-local-changed', render);
  window.addEventListener('vigor-sync-status', render);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  });
  render();
})();
