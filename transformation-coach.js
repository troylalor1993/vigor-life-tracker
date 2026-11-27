/* Transformation coaching uses the private tracker backup and manual sharing. */
(() => {
  'use strict';

  const liftInstructions = 'Two working sets per exercise; leave 1–3 reps in reserve. On busy days use a short version. Do not make up missed sessions at the expense of recovery.';
  const routines = [["Bench Press|DB Floor Press|6–12","Back Squat|Goblet Squat|6–15","Overhead Press|DB Overhead Press|6–12","Bent-Over Row|DB Bent-Over Row|8–12","Romanian Deadlift|DB Romanian Deadlift|8–15","Incline Curl|Standing DB Curl|10–15","Overhead Triceps Extension|DB Overhead Extension|10–15","Cable Crunch|Weighted Crunch|12–15"],["Front Squat|Double DB Front Squat|6–15","Deadlift|DB Deadlift|4–15","Incline DB Press|DB Floor Press|8–15","Shoulder Press|Arnold Press|8–12","Assisted Pull-Ups|Single-Arm DB Row|6–15","Preacher Curl|Concentration Curl|10–15","Rope Pushdown|DB Kickback|10–15","Hanging Knee Raise|Reverse Crunch|8–15"],["Bulgarian Split Squat|Stationary Split Squat|8–12/leg","Machine Hip Thrust|DB Glute Bridge|8–20","Landmine Row|Neutral-Grip DB Row|8–15","Lateral Raise|DB Lateral Raise|12–20","Machine Chest Press|DB Squeeze Floor Press|8–15","Hammer Curl|DB Hammer Curl|10–15","Skull Crusher|DB Floor Skull Crusher|10–15","Pallof Press|Bird Dog|8–12/side"],["Reverse Lunges|DB Reverse Lunges|8–12/leg","Seated Leg Curl|Hamstring Walkouts|8–15","Chest Fly|DB Floor Fly|10–15","Chest-Supported Row|Thigh-Supported DB Row|8–15","Reverse Pec Deck|DB Reverse Fly|12–20","Assisted Dips|Close-Grip DB Floor Press|6–15","EZ-Bar Curl|DB Supinated Curl|8–15","Farmer's Walk|DB Farmer's Walk|30–60 sec"]];
  const athletic = ['World’s Greatest Stretch · 1 × 5/side','Supported squat hold · 30 sec','90/90 hip switches · 10','Wall slides · 10','Knee-to-wall ankle mobility · 10/side','Squat to calf raise · 2 × 6–8','Light DB high pull · 2 × 6–8','Wall sprint march · 2 × 10/side','Single-leg reach · 2 × 5/leg','Lateral lunge · 2 × 6/side','Multidirectional steps · 2 × 30 sec','Rotational reach · 2 × 8/side','Dead bug · 2 × 8/side','Bird dog · 2 × 8/side','Modified side plank · 2 × 15–30 sec/side'];
  const $ = id => document.getElementById(id);
  const card = $('transformationCoach');
  const form = $('transformationForm');
  const status = $('transformationStatus');
  const fallback = $('transformationCopy');
  const dayMs = 86400000;
  const period = $('transformationPeriod');
  const library = document.createElement('details');
  const libraryTitle = document.createElement('summary');
  libraryTitle.textContent = 'Training library · Gym and home';
  library.append(libraryTitle);
  const mode = document.createElement('select');
  mode.setAttribute('aria-label','Training location');
  for(const name of ['Gym','Home']){const o=document.createElement('option');o.textContent=name;mode.append(o)}
  library.append(mode);
  const list = document.createElement('div');library.append(list);
  function completionButtons(section,routine){
    const status=document.createElement('p');status.setAttribute('role','status');
    for(const [label,effort] of [['Record completed workout','full'],['Record short version','minimum']]){
      const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=label;
      button.onclick=()=>{try{status.textContent=window.vigorCloudBridge.recordTrainingRoutine(routine,mode.value,effort)}catch(e){status.textContent=e.message}};
      section.append(button);
    }
    section.append(status);
  }
  function showLibrary(){
    list.replaceChildren();
    routines.forEach((routine,i)=>{
      const section=document.createElement('details'), heading=document.createElement('summary');
      heading.textContent='Full Body '+['A','B','C','D'][i]+' · 16 working sets';section.append(heading);
      routine.forEach(row=>{const [gym,home,reps]=row.split('|');const p=document.createElement('p');p.textContent=(mode.value==='Home'?home:gym)+' · 2 × '+reps;section.append(p)});
      completionButtons(section,['A','B','C','D'][i]);list.append(section);
    });
    const section=document.createElement('details'), heading=document.createElement('summary');heading.textContent='Athletic performance · Home';section.append(heading);
    athletic.forEach(row=>{const p=document.createElement('p');p.textContent=row;section.append(p)});completionButtons(section,'athletic');list.append(section);
    const p=document.createElement('p');p.textContent='Conditioning: start with 6 rounds of 30 seconds brisk walking and 90 seconds easy walking. Progress to jogging only as tolerated. No maximal sprints.';list.append(p);completionButtons(list,'interval');
  }
  mode.addEventListener('change',showLibrary);showLibrary();card.append(library);
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
    const lifts = [records[0], records[2], records[5], records[7]];
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
      'Lifts: ' + fullLifts + ' full, ' + shortLifts + ' short (4 planned; assignment check-ins, not workout logs)',
      'Post-meal walks: ' + walks + '/4 of at least 10 min · ' + walkMinutes + ' min total',
      'Average weight: ' + average(weights) + (weights.length ? ' lb (' + weights.length + ' recorded)' : ''),
      'Latest waist: ' + (waist ? waist + ' in' : '—'),
      'Average sleep: ' + average(sleep) + (sleep.length ? ' h' : ''),
      ...lifts.flatMap((entry, index) => entry.notes && ['Done', 'Short version'].includes(entry.effort)
        ? ['Lift ' + (['A','B','C','D'][index]) + ' log: ' + entry.notes] : [])
    ].join('\n');
  }

  function reviewDates(rotation) {
    if (period.value === 'current') return rotation.dates;
    return rotation.dates.map(date => new Date(Date.parse(date) - 8 * dayMs).toISOString().slice(0, 10));
  }

  function assignmentFor(data,date,rotation,record){
    const index=rotation.index;
    const sleep=record.sleep===''||record.sleep==null?null:Number(record.sleep);
    const energy=record.energy;
    if(record.pain==='Concerning')return 'Recovery only · Stop painful activity. Seek medical advice for new, severe or persistent symptoms.';
    if(data.discipline?.restDays?.[date]||record.pain==='Mild'||(sleep!==null&&sleep<5)||energy==='Low')return 'Recovery day · Rest or easy pain-free walking and mobility. No hard intervals or heavy lifting.';
    const rows=window.VigorRotationReview?.trainingSummary?.(data,rotation.dates[0],8)?.rows;
    const strength=rows?.[0], athletic=rows?.[1], interval=rows?.[2];
    const todayDone=(data.completions||[]).some(c=>c.date===date&&(/^(?:vigor-routine-|fullbody|speed)/.test(c.activityId)||/full[ -]?body|athletic|interval|sprint/i.test((data.activities||[]).find(a=>a.id===c.activityId)?.name||'')));
    if(todayDone)return 'Training recorded today · Optional easy movement or recovery. No need to repeat the session.';
    const planned=window.vigorCloudBridge?.plannedTrainingDay(index)||'';
    if(sleep===null||!energy)return planned+' · Record sleep and energy before choosing intensity.';
    const short=sleep<7||energy==='Okay';
    if([1,2,5,7].includes(index)){
      if(strength&&strength[1]>=strength[2])return 'Strength target reached · Easy cardio or recovery.';
      return planned+' · '+(short?'Short version: one set per exercise, easy effort.':'Gym or home · '+liftInstructions);
    }
    if(index===6){
      if(athletic&&athletic[1]>=athletic[2])return interval&&interval[1]<interval[2]&&!short?'Controlled low-impact intervals if cleared and pain-free.':'Easy cardio or recovery.';
      return planned+' · '+(short?'One easy set per drill; skip intervals.':'Controlled drills; optional low-impact intervals if pain-free and cleared.');
    }
    return planned;
  }
  const painLabel=document.createElement('label');painLabel.textContent='Pain or symptoms';
  const painSelect=document.createElement('select');painSelect.name='pain';
  for(const [value,label] of [['','Not assessed'],['None','None'],['Mild','Mild discomfort'],['Concerning','New, severe or concerning symptoms']]){
    const option=document.createElement('option');option.value=value;option.textContent=label;painSelect.append(option);
  }
  painLabel.append(painSelect);form.elements.notes.closest('label').before(painLabel);
  function render() {
    const {data, date, rotation} = getContext();
    card.hidden = !rotation;
    if (!rotation) return;
    const index = rotation.index;
    $('transformationAssignment').textContent = 'Day ' + (index + 1) + ' of 8 · ' + assignmentFor(data,date,rotation,data.transformationCheckins?.[date]||{});
    const dates = reviewDates(rotation);
    const training = window.VigorRotationReview?.trainingSummary?.(data, dates[0], 8);
    $('transformationReview').textContent = summarize(data, dates) + (training ? '\nTraining score: '+training.score+'%\n'+training.rows.map(r=>r[0]+': '+r[1]+'/'+r[2]+' '+r[3]).join('\n') : '');
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
      assignmentFor(data,date,rotation,entry),
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
