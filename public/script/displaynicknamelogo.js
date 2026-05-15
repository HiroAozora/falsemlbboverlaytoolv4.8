// public/script/displaynicknamelogo.js

// 1. Inisialisasi WebSocket ke Server
const socket = new WebSocket(`ws://${window.location.host}`);

// 2. Fungsi untuk mengambil data dari Server (matchdatateam.json)
async function fetchDataAndUpdate() {
  try {
    const response = await fetch("/api/matchdata");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    updateUI(data);
  } catch (error) {
    console.error("Gagal mengambil data match:", error);
  }
}

// 3. Fungsi Mapping Data JSON ke HTML
function updateUI(data) {
  if (!data || !data.teamdata) return;

  const blue = data.teamdata.blueteam;
  const red = data.teamdata.redteam;

  // Ambil setting Best Of (default BO3)
  const bestOf =
    data.teamdata.config && data.teamdata.config.bestOf
      ? data.teamdata.config.bestOf
      : "3";

  // --- TIM BIRU ---
  // Pastikan ID ini ada di HTML (misal: teamnameblue diberi id="name-box-1")
  setText("name-box-1", blue.teamname);
  renderScoreBars("name-box-2", blue.score, bestOf, "blue");
  setImage("displayImage1", blue.logo, "Logo Biru");
  setCoach("coach-display-blue", blue.coach);

  if (blue.playerlist) {
    blue.playerlist.forEach((player, index) => {
      const htmlId = 3 + index;
      setText(`name-box-${htmlId}`, player.name);
      setMugshot(`name-image-box-${htmlId}`, player.name);
    });
  }

  // --- TIM MERAH ---
  setText("name-box-8", red.teamname);
  renderScoreBars("name-box-9", red.score, bestOf, "red");
  setImage("displayImage2", red.logo, "Logo Merah");
  setCoach("coach-display-red", red.coach);

  if (red.playerlist) {
    red.playerlist.forEach((player, index) => {
      const htmlId = 10 + index;
      setText(`name-box-${htmlId}`, player.name);
      setMugshot(`name-image-box-${htmlId}`, player.name);
    });
  }

  // --- LOGIC FALLBACK NO-LOGO & SHADOW ---
  const config = data.teamdata.config || {};
  const useShadow = !!config.useLogoShadow;

  // Render Match Info ke area Tournament Logo
  const titleEl = document.getElementById('match-title-display');
  const numberEl = document.getElementById('match-number-display');
  
  if (titleEl) titleEl.textContent = (config.matchTitle || "TOURNAMENT").toUpperCase();
  if (numberEl) numberEl.textContent = (config.matchNumber || "MATCH").toUpperCase();

  // Biru
  const hasBlueLogo = blue.logo && blue.logo.trim() !== "";
  const blueTeamCol = document.getElementById("displayImage1")
    ? document.getElementById("displayImage1").closest(".team-info-col")
    : null;
  if (blueTeamCol) {
    if (hasBlueLogo) {
      blueTeamCol.classList.remove("no-logo");
    } else {
      blueTeamCol.classList.add("no-logo");
    }
  }
  const img1 = document.getElementById("displayImage1");
  if (img1) {
    if (useShadow && hasBlueLogo) img1.classList.add("logo-shadow");
    else img1.classList.remove("logo-shadow");
  }

  // Merah
  const hasRedLogo = red.logo && red.logo.trim() !== "";
  const redTeamCol = document.getElementById("displayImage2")
    ? document.getElementById("displayImage2").closest(".team-info-col")
    : null;
  if (redTeamCol) {
    if (hasRedLogo) {
      redTeamCol.classList.remove("no-logo");
    } else {
      redTeamCol.classList.add("no-logo");
    }
  }
  const img2 = document.getElementById("displayImage2");
  if (img2) {
    if (useShadow && hasRedLogo) img2.classList.add("logo-shadow");
    else img2.classList.remove("logo-shadow");
  }
}

// --- FUNGSI BANTUAN (HELPER) ---

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) {
    if (el.textContent !== text) {
      el.textContent = text || "";
      autoResizeText(el);
    } else {
      autoResizeText(el);
    }
  }
}

function autoResizeText(element) {
  if (!element || element.clientWidth === 0) return;

  // 1. Set Base Font Size berdasarkan panjang karakter (Khusus Nama Tim)
  if (element.id === "name-box-1" || element.id === "name-box-8") {
    const textLength = element.textContent.trim().length;
    if (textLength <= 5) {
      element.style.fontSize = "20px";
    } else {
      element.style.fontSize = "14px";
    }
  } else {
    // Untuk element lain (nama player, dll), reset ke font-size di CSS
    element.style.fontSize = "";
  }

  // Ambil style setelah base size ditentukan
  const style = window.getComputedStyle(element);
  // Cek apakah elemen ini diset untuk membungkus teks (seperti nama tim)
  const isWrapping =
    style.display === "-webkit-box" ||
    style.whiteSpace === "normal" ||
    style.whiteSpace === "pre-wrap";

  let currentSize = parseFloat(style.fontSize);
  const minSize = 8;

  // Fungsi cek apakah teks "tumpah" (overflow)
  const checkOverflow = () => {
    if (isWrapping) {
      // Jika wrap, cek apakah tingginya melampaui wadah (clientHeight)
      return element.scrollHeight > element.clientHeight;
    } else {
      // Jika nowrap, cek apakah lebarnya melampaui wadah
      return element.scrollWidth > element.clientWidth;
    }
  };

  // 2. Loop Pengecilan (Hanya jika masih overflow setelah base size diset)
  while (checkOverflow() && currentSize > minSize) {
    currentSize -= 0.5;
    element.style.fontSize = `${currentSize}px`;
  }
}

function setImage(id, base64Data, altText) {
  const img = document.getElementById(id);
  const defaultLogo = "Assets/other/nologo.png";

  if (img) {
    if (base64Data && base64Data.trim() !== "") {
      img.src = base64Data;
    } else {
      img.src = defaultLogo;
    }

    img.onerror = function () {
      this.onerror = null;
      this.src = defaultLogo;
    };

    img.style.display = "block";
    img.alt = altText;
  }
}

function setCoach(containerId, coachName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (coachName && coachName.trim() !== "") {
    container.style.display = "flex";
    const nameEl = container.querySelector(".coach-name");
    if (nameEl) nameEl.textContent = coachName;
  } else {
    container.style.display = "none";
  }
}

// === FUNGSI RENDER SCORE BARS ===
function renderScoreBars(containerId, scoreStr, bestOf, side) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Tentukan poin kemenangan dari Best Of
  let pointsToWin = 2; // Default BO3
  if (bestOf === "1") pointsToWin = 1;
  else if (bestOf === "3") pointsToWin = 2;
  else if (bestOf === "5") pointsToWin = 3;
  else if (bestOf === "7") pointsToWin = 4;

  const currentScore = parseInt(scoreStr) || 0;

  let html = '<div class="score-bars-container">';

  // Looping merender baris skor
  for (let i = 0; i < pointsToWin; i++) {
    let isFilled = false;

    if (side === "blue") {
      isFilled = i < currentScore;
    } else {
      isFilled = i < currentScore;
    }

    const colorClass = isFilled
      ? side === "blue"
        ? "filled blue"
        : "filled red"
      : "";
    html += `<div class="score-bar ${colorClass}"></div>`;
  }

  html += "</div>";
  container.innerHTML = html;
}

function setMugshot(containerId, playerName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Cek agar tidak redraw jika gambar player sama (opsional, untuk performa)
  // Tapi karena mugshot sering berubah pose, kita redraw saja:
  container.innerHTML = "";
  const img = document.createElement("img");

  if (playerName && playerName.trim() !== "") {
    img.src = `Assets/player/${encodeURIComponent(playerName)}.png`;
  } else {
    img.src = "Assets/player/noplayer.png";
  }

  img.onerror = function () {
    this.onerror = null;
    this.src = "Assets/player/noplayer.png";
  };

  container.appendChild(img);
}

// --- LOGIKA KONEKSI REALTIME ---

socket.onopen = () => {
  console.log("Terhubung ke Server Overlay via WebSocket");
  fetchDataAndUpdate();
};

socket.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);
    if (msg.type === "matchdata_update") {
      fetchDataAndUpdate();
    }
  } catch (e) {
    console.error("Error parsing WebSocket message:", e);
  }
};

socket.onclose = () => {
  console.log("Terputus dari server.");
  setTimeout(() => {
    window.location.reload();
  }, 3000);
};
