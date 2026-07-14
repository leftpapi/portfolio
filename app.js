(function(){
  "use strict";

  const OBTAIN_LABEL = {
    Free: "Free",
    Shop: "Shop",
    BattlePass: "Battle Pass",
    PlayerLevel: "Player Level",
    Bundle: "Bundle"
  };

  const byName = new Map(KITS.map(k => [k.name.toLowerCase(), k]));
  const names = KITS.map(k => k.name).sort((a,b)=>a.localeCompare(b));

  function todayStr(){
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }
  function hashStr(str){
    let h = 0;
    for (let i=0;i<str.length;i++){ h = (Math.imul(31,h) + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function dailyTarget(){
    const idx = hashStr(todayStr()) % KITS.length;
    return KITS[idx];
  }
  function randomTarget(exclude){
    let t;
    do { t = KITS[Math.floor(Math.random()*KITS.length)]; }
    while (exclude && t.name === exclude);
    return t;
  }

  const LS = {
    get(k, fallback){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } },
    set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  };

  let state = { mode: "daily", target: null, guesses: [], over: false, won: false };

  function loadDaily(){
    const today = todayStr();
    const saved = LS.get("kitdle_daily", null);
    if (saved && saved.date === today){
      state.target = byName.get(saved.targetName.toLowerCase());
      state.guesses = saved.guesses.map(n => byName.get(n.toLowerCase()));
      state.over = saved.over;
      state.won = saved.won;
    } else {
      state.target = dailyTarget();
      state.guesses = [];
      state.over = false;
      state.won = false;
      persistDaily();
    }
  }
  function persistDaily(){
    LS.set("kitdle_daily", {
      date: todayStr(),
      targetName: state.target.name,
      guesses: state.guesses.map(g=>g.name),
      over: state.over,
      won: state.won
    });
  }

  function startUnlimited(){
    state.target = randomTarget();
    state.guesses = [];
    state.over = false;
    state.won = false;
  }

  function getStreak(){ return LS.get("kitdle_streak", 0); }
  function bumpStreak(won){
    const today = todayStr();
    const last = LS.get("kitdle_streak_date", null);
    let streak = getStreak();
    if (won){
      if (last !== today){
        streak = streak + 1;
        LS.set("kitdle_streak", streak);
        LS.set("kitdle_streak_date", today);
      }
    } else {
      LS.set("kitdle_streak", 0);
    }
  }

  const $ = sel => document.querySelector(sel);
  const input = $("#guessInput");
  const guessBtn = $("#guessBtn");
  const suggestionsEl = $("#suggestions");
  const rowsEl = $("#rows");
  const attemptsLabel = $("#attemptsLabel");
  const pipsEl = $("#pips");
  const streakLabel = $("#streakLabel");
  const winPanel = $("#winPanel");
  const winTitle = $("#winTitle");
  const winImg = $("#winImg");
  const winSub = $("#winSub");
  const shareBtn = $("#shareBtn");
  const newGameBtn = $("#newGameBtn");
  const nextDailyEl = $("#nextDaily");
  const intro = $("#intro");

  function cellResult(guess, target, field){
    if (field === "class"){
      return { grade: guess.class === target.class ? "green" : "gray", text: guess.class };
    }
    if (field === "obtain"){
      return { grade: guess.obtain === target.obtain ? "green" : "gray", text: OBTAIN_LABEL[guess.obtain] };
    }
    if (field === "length"){
      const diff = guess.length - target.length;
      let grade;
      if (diff === 0) grade = "green";
      else if (Math.abs(diff) <= 2) grade = "yellow";
      else grade = "gray";
      const arrow = diff === 0 ? "" : (diff < 0 ? " ↑" : " ↓");
      return { grade, text: guess.length + arrow };
    }
    if (field === "words"){
      const diff = guess.words - target.words;
      const grade = diff === 0 ? "green" : "gray";
      const arrow = diff === 0 ? "" : (diff < 0 ? " ↑" : " ↓");
      return { grade, text: guess.words + arrow };
    }
  }

  const FIELDS = ["class","obtain","length","words"];
  const MAX_GUESSES = 5;

  function renderRows(animateLast){
    rowsEl.innerHTML = "";
    state.guesses.forEach((g, rowIdx) => {
      const isLast = animateLast && rowIdx === state.guesses.length - 1;
      const row = document.createElement("div");
      row.className = "row";
      const kitCell = document.createElement("div");
      kitCell.className = "cell cell-kit" + (isLast ? " pop" : "");
      kitCell.textContent = g.name;
      row.appendChild(kitCell);

      FIELDS.forEach((field, colIdx)=>{
        const res = cellResult(g, state.target, field);
        const cell = document.createElement("div");
        cell.textContent = res.text;
        if (isLast){
          cell.className = "cell pre-flip";
          row.appendChild(cell);
          setTimeout(()=>{
            cell.classList.add("flip-down");
            setTimeout(()=>{
              cell.className = "cell " + res.grade + " flip-up";
            }, 190);
          }, colIdx*180);
        } else {
          cell.className = "cell " + res.grade;
          row.appendChild(cell);
        }
      });
      rowsEl.appendChild(row);
    });
    attemptsLabel.textContent = state.guesses.length + " / " + MAX_GUESSES + " guesses";
    streakLabel.textContent = "🔥 streak: " + getStreak();
    renderPips();
  }

  function renderPips(){
    pipsEl.innerHTML = "";
    for (let i=0; i<MAX_GUESSES; i++){
      const dot = document.createElement("span");
      dot.className = "pip";
      if (i < state.guesses.length){
        const g = state.guesses[i];
        dot.classList.add(g.name === state.target.name ? "pip-hit" : "pip-used");
      }
      pipsEl.appendChild(dot);
    }
  }

  function showWin(){
    winPanel.classList.remove("hidden");
    winImg.src = state.target.img;
    winImg.alt = state.target.name;
    winTitle.textContent = state.won ? "BED BROKEN!" : "BED SURVIVED";
    winSub.textContent = state.won
      ? `You found ${state.target.name} in ${state.guesses.length} ${state.guesses.length===1?"guess":"guesses"}.`
      : `The kit was ${state.target.name}.`;
    if (state.mode === "unlimited"){
      newGameBtn.classList.remove("hidden");
      nextDailyEl.classList.add("hidden");
    } else {
      newGameBtn.classList.add("hidden");
      nextDailyEl.classList.remove("hidden");
      nextDailyEl.textContent = "Come back tomorrow for a new daily kit.";
    }
    input.disabled = true;
    guessBtn.disabled = true;
  }
  function hideWin(){
    winPanel.classList.add("hidden");
    input.disabled = false;
    guessBtn.disabled = false;
  }

  function submitGuess(name){
    const kit = byName.get(name.trim().toLowerCase());
    if (!kit) return;
    if (state.over) return;
    if (state.guesses.some(g=>g.name === kit.name)) { input.value=""; return; }

    state.guesses.push(kit);
    const won = kit.name === state.target.name;
    const outOfGuesses = !won && state.guesses.length >= MAX_GUESSES;
    if (won){ state.over = true; state.won = true; }
    else if (outOfGuesses){ state.over = true; state.won = false; }
    if (state.mode === "daily") persistDaily();
    renderRows(true);
    input.value = "";
    suggestionsEl.classList.remove("show");

    if (won || outOfGuesses){
      if (state.mode === "daily") bumpStreak(won);
      const delay = FIELDS.length * 180 + 400;
      setTimeout(showWin, delay);
    }
  }

  function renderSuggestions(query){
    const q = query.trim().toLowerCase();
    if (!q){ suggestionsEl.classList.remove("show"); suggestionsEl.innerHTML=""; return; }
    const guessedNames = new Set(state.guesses.map(g=>g.name));
    const matches = names.filter(n => n.toLowerCase().includes(q)).slice(0, 8);
    if (!matches.length){ suggestionsEl.classList.remove("show"); suggestionsEl.innerHTML=""; return; }
    suggestionsEl.innerHTML = "";
    matches.forEach(n=>{
      const kit = byName.get(n.toLowerCase());
      const item = document.createElement("div");
      item.className = "suggestion-item" + (guessedNames.has(n) ? " guessed" : "");
      item.innerHTML = `<span>${n}</span><span class="tag">${kit.class}</span>`;
      item.addEventListener("click", ()=> submitGuess(n));
      suggestionsEl.appendChild(item);
    });
    suggestionsEl.classList.add("show");
  }

  input.addEventListener("input", e => renderSuggestions(e.target.value));
  input.addEventListener("keydown", e=>{
    if (e.key === "Enter"){
      const exact = names.find(n=>n.toLowerCase() === input.value.trim().toLowerCase());
      if (exact) submitGuess(exact);
    }
  });
  guessBtn.addEventListener("click", ()=>{
    const exact = names.find(n=>n.toLowerCase() === input.value.trim().toLowerCase());
    if (exact) submitGuess(exact);
  });
  document.addEventListener("click", e=>{
    if (!e.target.closest(".autocomplete-wrap")) suggestionsEl.classList.remove("show");
  });

  function buildShareText(){
    const n = state.guesses.length;
    const lines = state.guesses.map(g=>{
      return FIELDS.map(f=>{
        const r = cellResult(g, state.target, f);
        return r.grade === "green" ? "🟩" : r.grade === "yellow" ? "🟨" : "⬛";
      }).join("");
    });
    const header = state.mode === "daily"
      ? `GUESS THE KIT ${todayStr()} — ${state.won ? n : "X"}/∞`
      : `GUESS THE KIT (Unlimited) — ${state.won ? n : "X"} guesses`;
    return header + "\n" + lines.join("\n");
  }
  shareBtn.addEventListener("click", ()=>{
    const text = buildShareText();
    if (navigator.clipboard){
      navigator.clipboard.writeText(text).then(()=>{
        shareBtn.textContent = "Copied!";
        setTimeout(()=> shareBtn.textContent = "Copy Result", 1500);
      });
    }
  });

  newGameBtn.addEventListener("click", ()=>{
    startUnlimited();
    hideWin();
    renderRows(false);
  });

  document.querySelectorAll(".mode-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".mode-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      state.mode = btn.dataset.mode;
      hideWin();
      if (state.mode === "daily"){
        loadDaily();
        intro.querySelector("p").innerHTML = "<strong>Guess today's BedWars kit.</strong> Same kit for everyone, every day.";
      } else {
        startUnlimited();
        intro.querySelector("p").innerHTML = "<strong>Unlimited mode.</strong> Random kit every round.";
      }
      renderRows(false);
      if (state.over) showWin();
    });
  });

  $("#helpBtn").addEventListener("click", ()=> $("#helpModal").classList.remove("hidden"));
  $("#closeHelp").addEventListener("click", ()=> $("#helpModal").classList.add("hidden"));
  $("#helpModal").addEventListener("click", e=>{ if (e.target.id === "helpModal") $("#helpModal").classList.add("hidden"); });

  loadDaily();
  renderRows(false);
  if (state.over) showWin();
})();
