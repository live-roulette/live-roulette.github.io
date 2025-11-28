(function () {
  "use strict";

  // --- WHEEL SETUP WITH REAL EUROPEAN ORDER ---

  // European roulette wheel number sequence (clockwise starting from 0)
  const wheelNumbers = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34,
    6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
    24, 16, 33, 1, 20, 14, 31, 9, 22, 18,
    29, 7, 28, 12, 35, 3, 26
  ];

  const reds = new Set([
    1, 3, 5, 7, 9, 12, 14, 16, 18,
    19, 21, 23, 25, 27, 30, 32, 34, 36
  ]);

  function getColor(num) {
    if (num === 0) return "green";
    return reds.has(num) ? "red" : "black";
  }

  // --- DOM references ---

  const canvas = document.getElementById("roulette-wheel");
  if (!canvas) return; // safety

  const ctx = canvas.getContext("2d");

  const roundIdEl = document.getElementById("round-id");
  const phasePill = document.getElementById("phase-pill");
  const phaseLabel = document.getElementById("phase-label");
  const resultMain = document
    .getElementById("result-main")
    .querySelector("strong");
  const resultColorEl = document.getElementById("result-color");
  const lastResultsEl = document.getElementById("last-results");
  const wheelResultBadge = document.getElementById("wheel-result-badge");
  const wheelResultNumberEl = document.getElementById("wheel-result-number");
  const wheelResultTextEl = document.getElementById("wheel-result-text");

  const chipButtons = document.querySelectorAll(".chip-btn");
  const btnSpin = document.getElementById("btn-spin");
  const btnClear = document.getElementById("btn-clear");
  const btnRebet = document.getElementById("btn-rebet");
  const btnClearHistory = document.getElementById("btn-clear-history");
  const spinHint = document.getElementById("spin-hint");

  const zeroColumn = document.getElementById("zero-column");
  const insideBetsContainer = document.getElementById("inside-bets");
  const outsideBetsContainer = document.getElementById("outside-bets");
  const outsideBetsRow = document.getElementById("outside-bets-row");

  const balanceEl = document.getElementById("balance");
  const statWagered = document.getElementById("stat-wagered");
  const statProfit = document.getElementById("stat-profit");
  const statRtp = document.getElementById("stat-rtp");
  const historyEl = document.getElementById("history");

  // --- CANVAS / WHEEL STATE ---

  let canvasWidth = 0;
  let canvasHeight = 0;

  const segmentsCount = wheelNumbers.length;
  const pointerAngle = -Math.PI / 2; // top
  const angleStep = (Math.PI * 2) / segmentsCount;

  function centerAngleForIndex(i) {
    return pointerAngle + i * angleStep;
  }

  let ballAngle = pointerAngle; // starting position
  let isSpinning = false;
  let spinStartTime = 0;
  const spinDuration = 4000; // ms
  const baseSpinRotations = 8 * Math.PI * 2; // multiple full spins
  let spinAnimId = null;

  // --- BANKROLL / BET STATE ---

  let roundId = 1;
  let balanceBase = 1000;
  let balance = 1000;
  let totalWagered = 0;
  let totalReturned = 0;

  let selectedChip = 1;
  let bets = {}; // key -> {type, value, amount}
  let lastBets = null;

  let lastWinningCell = null;

  let lastResults = [];
  const maxLastResults = 12;

  // --- Helpers ---

  function formatMoney(v) {
    return "$" + v.toFixed(2);
  }

  function updateBalance() {
    balanceEl.textContent = formatMoney(balance);
    balanceEl.classList.remove("positive", "negative");
    if (balance > balanceBase) {
      balanceEl.classList.add("positive");
    } else if (balance < balanceBase) {
      balanceEl.classList.add("negative");
    }
  }

  function updateStats() {
    statWagered.textContent = formatMoney(totalWagered);
    const profit = balance - balanceBase;
    statProfit.textContent = formatMoney(profit);
    if (totalWagered > 0) {
      const rtp = (totalReturned / totalWagered) * 100;
      statRtp.textContent = rtp.toFixed(1) + "%";
    } else {
      statRtp.textContent = "–";
    }
  }

  function setPhase(name) {
    phasePill.className = "phase-pill";
    switch (name) {
      case "betting":
        phasePill.classList.add("phase-betting");
        phaseLabel.textContent = "Place your bets";
        break;
      case "spinning":
        phasePill.classList.add("phase-spinning");
        phaseLabel.textContent = "Spinning";
        break;
      case "result":
        phasePill.classList.add("phase-result");
        phaseLabel.textContent = "Result";
        break;
      default:
        phasePill.classList.add("phase-idle");
        phaseLabel.textContent = "Place your bets";
    }
  }

  function easingOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function normalizeAngle(angle) {
    const twoPi = Math.PI * 2;
    while (angle > Math.PI) angle -= twoPi;
    while (angle < -Math.PI) angle += twoPi;
    return angle;
  }

  // --- CANVAS DRAWING ---

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvasWidth = rect.width;
    canvasHeight = rect.height;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * ratio;
    canvas.height = canvasHeight * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawWheel();
  }

  function drawWheel() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;

    const outerR = Math.min(canvasWidth, canvasHeight) / 2 - 8;
    const innerR = outerR * 0.65;
    const centerR = innerR * 0.6;

    // segments in real wheel order
    for (let i = 0; i < segmentsCount; i++) {
      const num = wheelNumbers[i];
      const colorKey = getColor(num);

      const center = centerAngleForIndex(i);
      const start = center - angleStep / 2;
      const end = center + angleStep / 2;

      ctx.beginPath();
      ctx.arc(cx, cy, outerR, start, end);
      ctx.arc(cx, cy, innerR, end, start, true);
      ctx.closePath();

      let fillColor;
      if (num === 0) fillColor = "#0a5d3c";
      else if (colorKey === "red") fillColor = "#9b1420";
      else fillColor = "#15151b";

      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // center disc
    const gradient = ctx.createRadialGradient(
      cx - 5,
      cy - 5,
      5,
      cx,
      cy,
      centerR
    );
    gradient.addColorStop(0, "#fdf6cc");
    gradient.addColorStop(0.5, "#ffb800");
    gradient.addColorStop(1, "#5c3e02");
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // ball
    const ballR = outerR - 6;
    const bx = cx + Math.cos(ballAngle) * ballR;
    const by = cy + Math.sin(ballAngle) * ballR;

    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function startSpinAnimation(targetIndex, onComplete) {
    isSpinning = true;
    setPhase("spinning");
    spinStartTime = performance.now();

    const startAngle = ballAngle;
    const targetAngle = centerAngleForIndex(targetIndex);
    const deltaAngle = normalizeAngle(targetAngle - startAngle);
    const totalRotation = baseSpinRotations + deltaAngle;

    function step(now) {
      const elapsed = now - spinStartTime;
      let t = elapsed / spinDuration;
      if (t > 1) t = 1;
      const eased = easingOutCubic(t);
      ballAngle = startAngle + totalRotation * eased;
      drawWheel();

      if (t < 1) {
        spinAnimId = requestAnimationFrame(step);
      } else {
        isSpinning = false;
        if (typeof onComplete === "function") onComplete();
      }
    }

    if (spinAnimId) cancelAnimationFrame(spinAnimId);
    spinAnimId = requestAnimationFrame(step);
  }

  // --- BET LAYOUT ---

  function createBetCell(parent, label, classes, type, value) {
    const cell = document.createElement("div");
    cell.className = "cell " + (classes || "");
    cell.textContent = label;
    cell.dataset.betType = type;
    cell.dataset.value = value;
    parent.appendChild(cell);
    return cell;
  }

  function buildLayout() {
    // 0 column
    const zeroCell = createBetCell(zeroColumn, "0", "zero", "straight", "0");
    zeroCell.style.height = "100%";

    // inside numbers 1–36 in standard 3-column layout:
    // visually rows: 3/2/1, 6/5/4, ... 36/35/34
    for (let row = 0; row < 12; row++) {
      const numbers = [3 * row + 3, 3 * row + 2, 3 * row + 1];
      numbers.forEach((num) => {
        const color = getColor(num);
        const classes = color === "red" ? "red" : "black";
        createBetCell(
          insideBetsContainer,
          String(num),
          classes,
          "straight",
          String(num)
        );
      });
    }

    // outside bets top row: RED, BLACK, EVEN, ODD
    const outsideConfigs = [
      {
        label: "RED",
        classes: "outside outside-red",
        type: "color",
        value: "red"
      },
      {
        label: "BLACK",
        classes: "outside outside-black",
        type: "color",
        value: "black"
      },
      { label: "EVEN", classes: "outside", type: "parity", value: "even" },
      { label: "ODD", classes: "outside", type: "parity", value: "odd" }
    ];
    outsideConfigs.forEach((cfg) =>
      createBetCell(
        outsideBetsContainer,
        cfg.label,
        cfg.classes,
        cfg.type,
        cfg.value
      )
    );

    // second row: 1–18, 19–36, and three dozens
    const rowConfigs = [
      { label: "1–18", type: "range", value: "low" },
      { label: "19–36", type: "range", value: "high" },
      { label: "1st 12", type: "dozen", value: "1" },
      { label: "2nd 12", type: "dozen", value: "2" },
      { label: "3rd 12", type: "dozen", value: "3" }
    ];
    rowConfigs.forEach((cfg) =>
      createBetCell(
        outsideBetsRow,
        cfg.label,
        "outside",
        cfg.type,
        cfg.value
      )
    );
  }

  // --- BET LOGIC ---

  function getTotalPlannedBet() {
    return Object.values(bets).reduce((sum, b) => sum + b.amount, 0);
  }

  function updateBetBadge(cell, amount) {
    let badge = cell.querySelector(".bet-chip-badge");
    if (!badge && amount > 0) {
      badge = document.createElement("div");
      badge.className = "bet-chip-badge";
      cell.appendChild(badge);
    }
    if (badge) {
      badge.textContent = amount;
      if (amount <= 0) {
        badge.remove();
      }
    }
  }

  function refreshBetClasses() {
    document
      .querySelectorAll(".cell.bet-active")
      .forEach((c) => c.classList.remove("bet-active"));
    Object.keys(bets).forEach((key) => {
      const bet = bets[key];
      const selector =
        '.cell[data-bet-type="' +
        bet.type +
        '"][data-value="' +
        bet.value +
        '"]';
      const cell = document.querySelector(selector);
      if (cell && bet.amount > 0) {
        cell.classList.add("bet-active");
        updateBetBadge(cell, bet.amount);
      }
    });
  }

  function clearBets() {
    bets = {};
    document.querySelectorAll(".cell.bet-active").forEach((cell) => {
      cell.classList.remove("bet-active");
      const badge = cell.querySelector(".bet-chip-badge");
      if (badge) badge.remove();
    });
  }

  function attachBetHandlers() {
    document
      .querySelectorAll(".cell[data-bet-type]")
      .forEach((cell) => {
        cell.addEventListener("click", () => {
          if (isSpinning) return;
          const type = cell.dataset.betType;
          const value = cell.dataset.value;
          const key = type + ":" + value;
          const currentTotal = getTotalPlannedBet();

          if (currentTotal + selectedChip > balance) {
            alert("Planned bets exceed your current balance.");
            return;
          }

          if (!bets[key]) {
            bets[key] = { type, value, amount: 0 };
          }
          bets[key].amount += selectedChip;
          refreshBetClasses();
        });
      });
  }

  // --- CHIP SELECTION ---

  function attachChipHandlers() {
    chipButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        chipButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedChip = parseInt(btn.dataset.chip, 10);
      });
    });
  }

  // --- RESULTS / HISTORY ---

  function pushResultChip(num, color) {
    lastResults.unshift({ num, color });
    if (lastResults.length > maxLastResults) lastResults.pop();
    lastResultsEl.innerHTML = "";

    lastResults.forEach((res) => {
      const chip = document.createElement("span");
      chip.className = "result-chip";
      if (res.color === "red") chip.classList.add("chip-red");
      else if (res.color === "black") chip.classList.add("chip-black");
      else chip.classList.add("chip-green");
      chip.textContent = res.num;
      lastResultsEl.appendChild(chip);
    });
  }

  function addHistoryRow(num, color, netChange, betSummary) {
    const row = document.createElement("div");
    row.className = "history-row";

    const numberSpan = document.createElement("span");
    numberSpan.className = "history-number";
    numberSpan.textContent = num + " (" + color + ")";

    const changeSpan = document.createElement("span");
    changeSpan.className = "history-change";
    if (netChange >= 0) {
      changeSpan.classList.add("history-win");
      changeSpan.textContent = "+" + formatMoney(netChange);
    } else {
      changeSpan.classList.add("history-loss");
      changeSpan.textContent = formatMoney(netChange);
    }

    const betsSpan = document.createElement("span");
    betsSpan.className = "history-bets";
    betsSpan.textContent = betSummary;

    row.appendChild(numberSpan);
    row.appendChild(changeSpan);
    row.appendChild(betsSpan);

    historyEl.insertBefore(row, historyEl.firstChild);
    while (historyEl.children.length > 80) {
      historyEl.removeChild(historyEl.lastChild);
    }
  }

  function showWheelBadge(resultNumber, colorLabel, colorKey, net) {
    wheelResultBadge.classList.add("visible");
    wheelResultBadge.classList.remove(
      "badge-red",
      "badge-black",
      "badge-green"
    );
    if (colorKey === "red") {
      wheelResultBadge.classList.add("badge-red");
    } else if (colorKey === "black") {
      wheelResultBadge.classList.add("badge-black");
    } else {
      wheelResultBadge.classList.add("badge-green");
    }

    wheelResultNumberEl.textContent = resultNumber;
    let suffix = colorLabel;
    if (net > 0) {
      suffix += " • Win " + formatMoney(net);
    } else if (net < 0) {
      suffix += " • Loss " + formatMoney(-net);
    } else {
      suffix += " • No net win";
    }
    wheelResultTextEl.textContent = suffix;
  }

  // --- RESOLVE BETS ---

  function resolveBets(resultNumber, resultColor, activeBets) {
    let totalBet = 0;
    let totalReturn = 0;
    const betSummaryParts = [];

    Object.values(activeBets).forEach((bet) => {
      const amount = bet.amount;
      if (amount <= 0) return;
      totalBet += amount;
      betSummaryParts.push(bet.type + ":" + bet.value + " $" + amount);

      let win = 0;
      switch (bet.type) {
        case "straight": {
          const target = parseInt(bet.value, 10);
          if (target === resultNumber) {
            win = amount * 36; // 35:1 + stake
          }
          break;
        }
        case "color": {
          if (resultNumber !== 0 && bet.value === resultColor) {
            win = amount * 2;
          }
          break;
        }
        case "parity": {
          if (resultNumber !== 0) {
            if (bet.value === "even" && resultNumber % 2 === 0) {
              win = amount * 2;
            } else if (bet.value === "odd" && resultNumber % 2 === 1) {
              win = amount * 2;
            }
          }
          break;
        }
        case "range": {
          if (resultNumber !== 0) {
            if (
              bet.value === "low" &&
              resultNumber >= 1 &&
              resultNumber <= 18
            ) {
              win = amount * 2;
            } else if (
              bet.value === "high" &&
              resultNumber >= 19 &&
              resultNumber <= 36
            ) {
              win = amount * 2;
            }
          }
          break;
        }
        case "dozen": {
          if (
            resultNumber >= 1 &&
            resultNumber <= 12 &&
            bet.value === "1"
          ) {
            win = amount * 3;
          } else if (
            resultNumber >= 13 &&
            resultNumber <= 24 &&
            bet.value === "2"
          ) {
            win = amount * 3;
          } else if (
            resultNumber >= 25 &&
            resultNumber <= 36 &&
            bet.value === "3"
          ) {
            win = amount * 3;
          }
          break;
        }
      }
      totalReturn += win;
    });

    const net = totalReturn - totalBet;
    balance += totalReturn;
    totalReturned += totalReturn;
    totalWagered += totalBet;

    updateBalance();
    updateStats();

    const colorLabel =
      resultColor === "red"
        ? "Red"
        : resultColor === "black"
        ? "Black"
        : "Green";
    const summary =
      betSummaryParts.length > 0 ? betSummaryParts.join(", ") : "—";

    addHistoryRow(resultNumber, colorLabel, net, summary);
    pushResultChip(resultNumber, resultColor);

    // update main result display
    resultMain.textContent = resultNumber;
    resultColorEl.textContent = colorLabel;
    resultColorEl.className = "result-color";
    if (resultColor === "red") resultColorEl.classList.add("result-red");
    else if (resultColor === "black")
      resultColorEl.classList.add("result-black");
    else resultColorEl.classList.add("result-green");

    // highlight last winning straight number on table
    if (lastWinningCell) {
      lastWinningCell.classList.remove("recent-win");
      lastWinningCell = null;
    }
    const winningCell = document.querySelector(
      '.cell[data-bet-type="straight"][data-value="' + resultNumber + '"]'
    );
    if (winningCell) {
      winningCell.classList.add("recent-win");
      lastWinningCell = winningCell;
    }

    showWheelBadge(resultNumber, colorLabel, resultColor, net);

    if (net > 0) {
      spinHint.innerHTML =
        "You won <strong>" +
        formatMoney(net) +
        "</strong> on this spin. Place your next bets or press <strong>Rebet</strong>.";
    } else if (net < 0) {
      spinHint.innerHTML =
        "You lost <strong>" +
        formatMoney(-net) +
        "</strong> this round. Adjust your bets or try a different pattern.";
    } else {
      spinHint.innerHTML =
        "No net win this spin. You can change the bet mix or rebet the same pattern.";
    }

    setPhase("result");
  }

  // --- SPIN LOGIC ---

  function randomIndex() {
    return Math.floor(Math.random() * segmentsCount);
  }

  function handleSpin() {
    if (isSpinning) return;
    const totalBet = getTotalPlannedBet();
    if (totalBet <= 0) {
      alert("Place at least one bet before spinning.");
      return;
    }
    if (totalBet > balance) {
      alert("Total bet exceeds current balance.");
      return;
    }

    const activeBets = JSON.parse(JSON.stringify(bets));
    lastBets = JSON.parse(JSON.stringify(bets));
    btnRebet.disabled = false;

    balance -= totalBet;
    updateBalance();

    spinHint.innerHTML =
      "Wheel spinning… watch the ball and wait for the outcome.";
    setPhase("spinning");

    roundId += 1;
    roundIdEl.textContent = "#" + roundId;

    const idx = randomIndex();
    const resultNumber = wheelNumbers[idx];
    const resultColor = getColor(resultNumber);

    startSpinAnimation(idx, () => {
      resolveBets(resultNumber, resultColor, activeBets);
    });
  }

  // --- CONTROL BUTTONS ---

  function attachControlHandlers() {
    btnSpin.addEventListener("click", handleSpin);

    btnClear.addEventListener("click", () => {
      if (isSpinning) return;
      clearBets();
      spinHint.innerHTML =
        "All bets cleared. Click on inside or outside fields to place new chips.";
    });

    btnRebet.addEventListener("click", () => {
      if (isSpinning) return;
      if (!lastBets) return;
      clearBets();
      bets = JSON.parse(JSON.stringify(lastBets));
      const totalBet = getTotalPlannedBet();
      if (totalBet > balance) {
        bets = {};
        refreshBetClasses();
        alert("Not enough balance to rebet the last stake pattern.");
        return;
      }
      refreshBetClasses();
      spinHint.innerHTML =
        "Previous pattern restored. Adjust if needed, then press <strong>Spin</strong>.";
    });

    btnClearHistory.addEventListener("click", () => {
      historyEl.innerHTML = "";
      lastResults = [];
      lastResultsEl.innerHTML = "";
    });
  }

  // --- INIT ---

  function init() {
    buildLayout();
    attachBetHandlers();
    attachChipHandlers();
    attachControlHandlers();
    updateBalance();
    updateStats();
    setPhase("betting");
    resizeCanvas();
    drawWheel();
  }

  window.addEventListener("resize", resizeCanvas);
  init();
})();
