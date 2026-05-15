let allHeroes = [];
let lastPlayed = {};
let currentDraftData = null;
let timerAnimationTimeout = null;
let ws = null; // Variabel global WS
let reconnectInterval = null;

// --- STATE TRACKING ---
let lastRunningState = false; 
let lastPhaseIndex = -1;

// --- 1. LOAD HERO DATA ---
async function loadHeroes() {
    try {
        const response = await fetch('/database/herolist.json');
        allHeroes = await response.json();
    } catch (e) { console.error("Error loading herolist", e); }
}

function getVoiceByImg(imgSrc) {
    if (!imgSrc || !allHeroes.length) return null;
    const hero = allHeroes.find(h => h.img === imgSrc);
    return hero ? hero.voice : null;
}

// --- 2. WEBSOCKET MANAGER (AUTO RECONNECT) ---

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${window.location.host}`);

    ws.onopen = () => {
        console.log('Connected to Server');
        fetchDraftData(); 
        
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            
            // 1. UPDATE DATA FULL (Phase ganti, Pick/Ban Hero)
            if (msg.type === 'draftdata_update' && msg.data) {
                console.log("Menerima update full langsung via Socket");
                processData(msg.data);
            } 
            else if (msg.type === 'draftdata_update') {
                fetchDraftData();
            }
            // 2. TANGKAP DETAK TIMER TERISOLASI DARI CONTROLLER (Tick / Detik)
            else if (msg.type === 'update' && msg.data && msg.data.draftdata) {
                // Jangan timpa seluruh data, cukup update angka dan barnya saja
                syncTimerTick(msg.data.draftdata.timer, msg.data.draftdata.timer_running, false);
            }
            // 3. UPDATE MAP dari drawcontrol
            else if (msg.type === 'mapdraw_update' && msg.data) {
                updateMapDisplay(msg.data);
            }
        } catch (e) {
            console.error("WS Parse Error", e);
        }
    };

    ws.onclose = () => {
        console.log('Koneksi terputus. Mencoba reconnect dalam 3 detik...');
        if (!reconnectInterval) {
            reconnectInterval = setInterval(connectWebSocket, 3000);
        }
    };

    ws.onerror = (err) => {
        console.error('Socket error:', err);
        ws.close();
    };
}

async function fetchDraftData() {
    try {
        const response = await fetch('/api/matchdraft');
        const data = await response.json();
        if (data && data.draftdata) {
            processData(data.draftdata);
        }
    } catch (error) {
        console.error("Error fetch draft data:", error);
    }
}

function processData(newDraftData) {
    const prevPhase = currentDraftData ? parseInt(currentDraftData.current_phase) : -1;
    const newPhase  = parseInt(newDraftData.current_phase) || 0;

    // Jika draft direset (phase balik ke 0 dari phase > 0), clear animasi pick
    if (newPhase === 0 && prevPhase > 0) {
        resetPickAnimationState();
    }

    currentDraftData = newDraftData;
    updateDisplay(newDraftData);
    updateGameLogic(newDraftData);
}

// --- INITIALIZE ---
loadHeroes().then(() => connectWebSocket());

// --- MAP DATA ---
async function fetchMapData() {
    try {
        const res = await fetch('/api/mapdraw');
        const data = await res.json();
        if (data && data.drawdata) {
            updateMapDisplay(data.drawdata);
        }
    } catch(e) { console.warn('Map data not available:', e); }
}

function updateMapDisplay(drawData) {
    const nameEl = document.getElementById('map-name-display');
    const placeholderEl = document.getElementById('map-icon-placeholder');
    if (!nameEl) return;
    
    if (drawData && drawData.result) {
        const mapName = drawData.result;
        nameEl.textContent = mapName.toUpperCase();
        
        // Render icon map
        if (placeholderEl) {
            let imgEl = placeholderEl.querySelector('img');
            if (!imgEl) {
                imgEl = document.createElement('img');
                placeholderEl.innerHTML = ''; // Hapus fallback text "MAP"
                placeholderEl.appendChild(imgEl);
            }
            
            // URL file map icon khusus (harus sama persis dengan nama map + .png)
            // Menggunakan folder 'mapicon' agar tidak merusak background HD di drawdisplay
            const mapIconUrl = `Assets/mapicon/${mapName}.png`;
            
            // Error handling kalau file tidak ada
            imgEl.onerror = function() {
                this.onerror = null;
                placeholderEl.innerHTML = '<span class="map-icon-text">MAP</span>';
            };
            
            imgEl.src = mapIconUrl;
        }
    } else {
        nameEl.textContent = '-';
        if (placeholderEl) {
            placeholderEl.innerHTML = '<span class="map-icon-text">MAP</span>';
        }
    }
}

// Fetch map on init
fetchMapData();
// Periodically re-check map (setiap 5 detik)
setInterval(fetchMapData, 5000);


// --- 3. DISPLAY UPDATE LOGIC ---

function playVoice(voiceSrc, index) {
    if (!voiceSrc) return;
    let audio = document.getElementById("hero-voice");
    let phaseIdx = (currentDraftData && currentDraftData.current_phase) ? parseInt(currentDraftData.current_phase) : 0;
    
    if (phaseIdx >= phases.length - 1) {
        audio.volume = 0;
    } else {
        audio.volume = 1;
    }
    
    audio.pause();
    audio.currentTime = 0;
    audio.src = voiceSrc;
    var playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.log('Auto-play prevented (User must interact first)');
        });
    }
}

function updateDisplay(newData) {
    if (!newData) return;

    const map = [];
    const safePickBlue = newData.blueside.pick || [];
    const safePickRed = newData.redside.pick || [];
    const safeBanBlue = newData.blueside.ban || [];
    const safeBanRed = newData.redside.ban || [];

    safePickBlue.forEach((p, i) => map[1+i] = p.hero);
    safePickRed.forEach((p, i) => map[6+i] = p.hero);
    safeBanBlue.forEach((p, i) => map[11+i] = p.hero);
    safeBanRed.forEach((p, i) => map[16+i] = p.hero);

    for (let i = 1; i <= 20; i++) {
        let imgSrc = map[i];
        let imgElement = document.getElementById(`image-display-${i}`);
        let boxElement = document.getElementById(`image-box-${i}`);
        
        if (imgElement && boxElement) { 
            if (imgSrc) {
                if (!imgElement.src.endsWith(imgSrc)) {
                     imgElement.src = imgSrc;
                     const voiceSrc = getVoiceByImg(imgSrc);
                     if (voiceSrc && lastPlayed[i] !== imgSrc) {
                         playVoice(voiceSrc, i);
                         lastPlayed[i] = imgSrc;
                     }
                }
                imgElement.style.opacity = "1";
                boxElement.classList.add("show");
            } else {
                imgElement.src = ""; 
                imgElement.style.opacity = "0";
                boxElement.classList.remove("show");
                lastPlayed[i] = null;
            }
        }
    }
}

// --- 4. TIMER & PHASE UI LOGIC ---

const phaseElement = document.getElementById('phase');
const arrowElement = document.getElementById('arrow');
const timerElement = document.getElementById('timer');
const timerBarLeft = document.getElementById('timer-bar-left');
const timerBarRight = document.getElementById('timer-bar-right');
const timerBarFull = document.getElementById('timer-bar-full');

const phases = [
    { type: "", direction: "/Assets/Other/LeftBanning.gif" },
    { type: "", direction: "/Assets/Other/RightBanning.gif" },
    { type: "", direction: "/Assets/Other/LeftBanning.gif" },
    { type: "", direction: "/Assets/Other/RightBanning.gif" },
    { type: "", direction: "/Assets/Other/LeftPicking.gif" },
    { type: "", direction: "/Assets/Other/RightPicking.gif" },
    { type: "", direction: "/Assets/Other/LeftPicking.gif" },
    { type: "", direction: "/Assets/Other/RightPicking.gif" },
    { type: "", direction: "/Assets/Other/RightBanning.gif" },
    { type: "", direction: "/Assets/Other/LeftBanning.gif" },
    { type: "", direction: "/Assets/Other/RightPicking.gif" },
    { type: "", direction: "/Assets/Other/LeftPicking.gif" },
    { type: "", direction: "/Assets/Other/RightPicking.gif" },
    { type: "", direction: "/Assets/Other/Adjustment.gif" }
];

const phasesActiveBoxes = [
    ["ban-left-1"],
    ["ban-right-1"],
    ["ban-left-2"],
    ["ban-right-2"],
    ["pick-left-1"],
    ["pick-right-1", "pick-right-2"],
    ["pick-left-2", "pick-left-3"],
    ["pick-right-3"],
    ["ban-right-3"],
    ["ban-left-3"],
    ["pick-right-4"],
    ["pick-left-4", "pick-left-5"],
    ["pick-right-5"],
    []
];

function updateGameLogic(data) {
    if (!data) return;

    let currentPhaseIndex = parseInt(data.current_phase) || 0;
    
    // Deteksi active side
    let activeSide = "both";
    if (currentPhaseIndex < phases.length) {
        let dir = phases[currentPhaseIndex].direction;
        if (dir.includes("Left")) activeSide = "left";
        else if (dir.includes("Right")) activeSide = "right";
    }

    // Deteksi apakah fase berpindah
    let phaseChanged = (currentPhaseIndex !== lastPhaseIndex);
    lastPhaseIndex = currentPhaseIndex;

    // Sinkronkan Timer dari Full Update (Reset & Restart Bar jika perlu)
    syncTimerTick(data.timer, data.timer_running, phaseChanged, activeSide);

    // Logic Tampilan Phase
    if (phaseElement && arrowElement) {
        if (currentPhaseIndex < phases.length) {
            const currentPhase = phases[currentPhaseIndex];
            phaseElement.textContent = currentPhase.type;
            
            if (!arrowElement.src.endsWith(currentPhase.direction)) {
                arrowElement.src = currentPhase.direction;
            }
        } else {
            phaseElement.textContent = "ADJUSTMENT";
            arrowElement.src = "";
        }
    }

    // Logic Active Box
    document.querySelectorAll(".box").forEach(box => {
        box.classList.remove("active-ban", "active-pick");
    });

    if (currentPhaseIndex < phasesActiveBoxes.length) {
        phasesActiveBoxes[currentPhaseIndex].forEach(boxId => {
            const phaseBox = document.getElementById(boxId);
            if (phaseBox) {
                const isBanPhase = (currentPhaseIndex < 4) || (currentPhaseIndex >= 8 && currentPhaseIndex <= 9);
                phaseBox.classList.add(isBanPhase ? "active-ban" : "active-pick");
            }
        });
    }

    // Animasi Expand/Collapse Heropick
    updatePickAnimation(data, currentPhaseIndex);
}

// --- PICK ANIMATION STATE ---
// Track state sebelumnya untuk deteksi pick baru
let prevPickStateBlue = {};  // { slotNum: boolean (filled?) }
let prevPickStateRed  = {};
// Track slot yang sedang dalam fase "reveal" (hero baru di-pick, belum collapse)
let revealingSlots = { blue: {}, red: {} };
// setTimeout handles supaya bisa di-cancel kalau draft di-reset
let revealTimeouts = { blue: {}, red: {} };

function setSlotClass(side, slot, cls) {
    const pickEl = document.getElementById(`heropick-${side}-${slot}`);
    const nameEl = document.getElementById(`playername-${side}-${slot}`);
    if (pickEl) {
        pickEl.classList.remove('picking-active', 'picking-done');
        if (cls) pickEl.classList.add(cls);
    }
    if (nameEl) {
        nameEl.classList.remove('picking-active', 'picking-done');
        if (cls) nameEl.classList.add(cls);
    }
}

// Mapping phase index -> slot yang aktif picking
// Slot numbering: blue 1-5, red 1-5
// ban6 mode: fase pick ada di index 4-12 (sesuai phasesActiveBoxes di atas)
const pickPhaseToSlots = {
    4:  { blue: [1], red: [] },
    5:  { blue: [], red: [1, 2] },
    6:  { blue: [2, 3], red: [] },
    7:  { blue: [], red: [3] },
    8:  { blue: [], red: [] }, // ban phase
    9:  { blue: [], red: [] }, // ban phase
    10: { blue: [], red: [4] },
    11: { blue: [4, 5], red: [] },
    12: { blue: [], red: [5] },
};

function updatePickAnimation(data, phaseIdx) {
    const safePickBlue = (data.blueside && data.blueside.pick) ? data.blueside.pick : [];
    const safePickRed  = (data.redside  && data.redside.pick)  ? data.redside.pick  : [];

    const activeSlots = pickPhaseToSlots[phaseIdx] || { blue: [], red: [] };

    const isBlueSlotFilled = (slot) => !!(safePickBlue[slot - 1] && safePickBlue[slot - 1].hero);
    const isRedSlotFilled  = (slot) => !!(safePickRed[slot - 1]  && safePickRed[slot - 1].hero);

    // -- BLUE SIDE --
    for (let s = 1; s <= 5; s++) {
        const nowFilled = isBlueSlotFilled(s);
        const wasFilled = !!prevPickStateBlue[s];
        const pickEl = document.getElementById(`heropick-blue-${s}`);

        // has-hero: ditambah saat hero dikonfirm, langsung geser icon ke pojok
        if (pickEl) {
            if (nowFilled) pickEl.classList.add('has-hero');
            else           pickEl.classList.remove('has-hero');
        }

        if (nowFilled && !wasFilled && !revealingSlots.blue[s]) {
            // === PICK BARU! ===
            // 1. Langsung melebar (active) sambil hero reveal
            setSlotClass('blue', s, 'picking-active');
            revealingSlots.blue[s] = true;

            // 2. Setelah 2.6s (hero reveal animation selesai), baru collapse
            if (revealTimeouts.blue[s]) clearTimeout(revealTimeouts.blue[s]);
            revealTimeouts.blue[s] = setTimeout(() => {
                revealingSlots.blue[s] = false;
                setSlotClass('blue', s, 'picking-done');
            }, 2600);

        } else if (revealingSlots.blue[s]) {
            // Masih dalam fase reveal -> pertahankan active (lebar)
            setSlotClass('blue', s, 'picking-active');

        } else if (nowFilled) {
            // Sudah selesai reveal sebelumnya -> done (sempit)
            setSlotClass('blue', s, 'picking-done');

        } else if (activeSlots.blue.includes(s)) {
            // Giliran pick tapi belum ada hero -> active (lebar, menunggu)
            setSlotClass('blue', s, 'picking-active');

        } else {
            // Belum giliran & belum filled -> normal
            setSlotClass('blue', s, null);
        }

        prevPickStateBlue[s] = nowFilled;
    }

    // -- RED SIDE --
    for (let s = 1; s <= 5; s++) {
        const nowFilled = isRedSlotFilled(s);
        const wasFilled = !!prevPickStateRed[s];
        const pickEl = document.getElementById(`heropick-red-${s}`);

        // has-hero: langsung geser icon ke pojok saat hero dikonfirm
        if (pickEl) {
            if (nowFilled) pickEl.classList.add('has-hero');
            else           pickEl.classList.remove('has-hero');
        }

        if (nowFilled && !wasFilled && !revealingSlots.red[s]) {
            // === PICK BARU! ===
            setSlotClass('red', s, 'picking-active');
            revealingSlots.red[s] = true;

            if (revealTimeouts.red[s]) clearTimeout(revealTimeouts.red[s]);
            revealTimeouts.red[s] = setTimeout(() => {
                revealingSlots.red[s] = false;
                setSlotClass('red', s, 'picking-done');
            }, 2600);

        } else if (revealingSlots.red[s]) {
            setSlotClass('red', s, 'picking-active');

        } else if (nowFilled) {
            setSlotClass('red', s, 'picking-done');

        } else if (activeSlots.red.includes(s)) {
            setSlotClass('red', s, 'picking-active');

        } else {
            setSlotClass('red', s, null);
        }

        prevPickStateRed[s] = nowFilled;
    }
}

// Reset animasi state (dipanggil saat draft di-reset)
function resetPickAnimationState() {
    prevPickStateBlue = {};
    prevPickStateRed  = {};
    revealingSlots = { blue: {}, red: {} };
    // Cancel semua reveal timeouts
    for (let s = 1; s <= 5; s++) {
        if (revealTimeouts.blue[s]) clearTimeout(revealTimeouts.blue[s]);
        if (revealTimeouts.red[s])  clearTimeout(revealTimeouts.red[s]);
    }
    revealTimeouts = { blue: {}, red: {} };
    // Reset semua class termasuk has-hero
    for (let s = 1; s <= 5; s++) {
        setSlotClass('blue', s, null);
        setSlotClass('red', s, null);
        // Hapus has-hero
        const blueEl = document.getElementById(`heropick-blue-${s}`);
        const redEl  = document.getElementById(`heropick-red-${s}`);
        if (blueEl) blueEl.classList.remove('has-hero');
        if (redEl)  redEl.classList.remove('has-hero');
    }
}


// --- MURNI DIKONTROL SERVER (TANPA setInterval LOKAL) ---
function syncTimerTick(timerValue, isRunning, phaseChanged = false, activeSide = "both") {
    if (currentDraftData) {
        currentDraftData.timer = timerValue;
        currentDraftData.timer_running = isRunning;
    }

    let timerNum = parseInt(timerValue);
    if (isNaN(timerNum)) timerNum = 60;

    // 1. Update Teks Detik Langsung (Anti drift)
    if (timerElement) {
        timerElement.textContent = String(timerNum).padStart(2, '0');
    }

    // 2. Logic Animasi CSS Bar
    // Hanya picu animasi kalau baru di-start (false -> true) atau pindah fase
    if ((isRunning && !lastRunningState) || (isRunning && phaseChanged)) {
        animateTimerBar(timerNum, activeSide);
    } 
    // Reset bar kalau di-stop (true -> false)
    else if (!isRunning && lastRunningState) {
        stopTimerBar(activeSide);
    }
    
    lastRunningState = isRunning;
}

function animateTimerBar(duration, side = "both") {
    if (timerAnimationTimeout) clearTimeout(timerAnimationTimeout);

    // Kembalikan ke penuh secara instant
    if (timerBarLeft) {
        timerBarLeft.style.transition = "none"; 
        timerBarLeft.style.width = (side === "left") ? "100%" : "0%";
    }
    if (timerBarRight) {
        timerBarRight.style.transition = "none"; 
        timerBarRight.style.width = (side === "right") ? "100%" : "0%";
    }
    if (timerBarFull) {
        timerBarFull.style.transition = "none";
        timerBarFull.style.width = (side === "both") ? "100%" : "0%";
    }
    
    // Mulai animasi menyusut sesuai durasi yang tersisa
    timerAnimationTimeout = setTimeout(() => {
        if (timerBarLeft && side === "left") {
            void timerBarLeft.offsetWidth; // Force Reflow
            timerBarLeft.style.transition = `width ${duration}s linear`;
            timerBarLeft.style.width = "0%";
        }
        if (timerBarRight && side === "right") {
            void timerBarRight.offsetWidth; // Force Reflow
            timerBarRight.style.transition = `width ${duration}s linear`;
            timerBarRight.style.width = "0%";
        }
        if (timerBarFull && side === "both") {
            void timerBarFull.offsetWidth; // Force Reflow
            timerBarFull.style.transition = `width ${duration}s linear`;
            timerBarFull.style.width = "0%";
        }
    }, 50); // Delay sangat singkat agar DOM sempat merespon 'width 100%'
}

function stopTimerBar(side = "both") {
    if (timerAnimationTimeout) clearTimeout(timerAnimationTimeout);
    
    // Bekukan bar kembali ke 100% jika dihentikan/reset (hanya yang aktif)
    if (timerBarLeft) {
        timerBarLeft.style.transition = 'width 0.5s ease';
        timerBarLeft.style.width = (side === "left") ? "100%" : "0%";
    }
    if (timerBarRight) {
        timerBarRight.style.transition = 'width 0.5s ease';
        timerBarRight.style.width = (side === "right") ? "100%" : "0%";
    }
    if (timerBarFull) {
        timerBarFull.style.transition = 'width 0.5s ease';
        timerBarFull.style.width = (side === "both") ? "100%" : "0%";
    }
}