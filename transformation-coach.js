/* Gym and home workouts with the existing workout logging controls. */
(() => {
  'use strict';

  const routines = [["Bench Press|DB Floor Press|6–12","Back Squat|Goblet Squat|6–15","Overhead Press|DB Overhead Press|6–12","Bent-Over Row|DB Bent-Over Row|8–12","Romanian Deadlift|DB Romanian Deadlift|8–15","Incline Curl|Standing DB Curl|10–15","Overhead Triceps Extension|DB Overhead Extension|10–15","Cable Crunch|Weighted Crunch|12–15"],["Front Squat|Double DB Front Squat|6–15","Deadlift|DB Deadlift|4–15","Incline DB Press|DB Floor Press|8–15","Shoulder Press|Arnold Press|8–12","Assisted Pull-Ups|Single-Arm DB Row|6–15","Preacher Curl|Concentration Curl|10–15","Rope Pushdown|DB Kickback|10–15","Hanging Knee Raise|Reverse Crunch|8–15"],["Bulgarian Split Squat|Stationary Split Squat|8–12/leg","Machine Hip Thrust|DB Glute Bridge|8–20","Landmine Row|Neutral-Grip DB Row|8–15","Lateral Raise|DB Lateral Raise|12–20","Machine Chest Press|DB Squeeze Floor Press|8–15","Hammer Curl|DB Hammer Curl|10–15","Skull Crusher|DB Floor Skull Crusher|10–15","Pallof Press|Bird Dog|8–12/side"],["Reverse Lunges|DB Reverse Lunges|8–12/leg","Seated Leg Curl|Hamstring Walkouts|8–15","Chest Fly|DB Floor Fly|10–15","Chest-Supported Row|Thigh-Supported DB Row|8–15","Reverse Pec Deck|DB Reverse Fly|12–20","Assisted Dips|Close-Grip DB Floor Press|6–15","EZ-Bar Curl|DB Supinated Curl|8–15","Farmer's Walk|DB Farmer's Walk|30–60 sec"]];
  const athletic = ['World’s Greatest Stretch · 1 × 5/side','Supported squat hold · 30 sec','90/90 hip switches · 10','Wall slides · 10','Knee-to-wall ankle mobility · 10/side','Squat to calf raise · 2 × 6–8','Light DB high pull · 2 × 6–8','Wall sprint march · 2 × 10/side','Single-leg reach · 2 × 5/leg','Lateral lunge · 2 × 6/side','Multidirectional steps · 2 × 30 sec','Rotational reach · 2 × 8/side','Dead bug · 2 × 8/side','Bird dog · 2 × 8/side','Modified side plank · 2 × 15–30 sec/side'];
  const fitness = document.getElementById('vigorFitnessScreen');
  if (!fitness) return;
  const library = document.createElement('details');
  library.className = 'compact-details';
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
  mode.addEventListener('change',showLibrary);
  showLibrary();
  fitness.append(library);
})();
