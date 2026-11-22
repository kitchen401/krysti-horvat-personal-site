(function () {
  "use strict";

  var GOOD_ITEMS = [
    { emoji: "💡", points: 10 }, // 💡
    { emoji: "🎯", points: 15 }, // 🎯
    { emoji: "🚀", points: 20 }  // 🚀
  ];
  var BAD_ITEM = { emoji: "💩" }; // 💩
  var BAD_CHANCE = 0.22;
  var START_LIVES = 3;
  var HIGH_SCORE_KEY = "catchTheBigIdeaHighScore";
  var BASKET_COLOR_KEY = "catchTheBigIdeaBasketColor";
  var DEFAULT_BASKET_COLOR = "#7a5cff";
  var SHAKE_DURATION = 1;
  var SHAKE_MAGNITUDE = 7;

  var canvas = document.getElementById("gameCanvas");
  var ctx = canvas.getContext("2d");
  var scoreEl = document.getElementById("score");
  var livesEl = document.getElementById("lives");
  var bestEl = document.getElementById("best");
  var startPanel = document.getElementById("startPanel");
  var overPanel = document.getElementById("overPanel");
  var pausePanel = document.getElementById("pausePanel");
  var finalScoreText = document.getElementById("finalScoreText");
  var startButton = document.getElementById("startButton");
  var retryButton = document.getElementById("retryButton");
  var resumeButton = document.getElementById("resumeButton");
  var pauseButton = document.getElementById("pauseButton");

  var colorPicker = document.getElementById("colorPicker");
  var swatches = colorPicker ? colorPicker.querySelectorAll(".swatch") : [];

  var width = 0;
  var height = 0;
  var basket = { x: 0, width: 70, height: 36, speed: 420, color: DEFAULT_BASKET_COLOR };
  var items = [];
  var popups = [];
  var score = 0;
  var lives = START_LIVES;
  var spawnTimer = 0;
  var spawnInterval = 1.1;
  var fallSpeed = 140;
  var elapsed = 0;
  var running = false;
  var paused = false;
  var shakeTime = 0;
  var lastTime = 0;
  var keys = { left: false, right: false };
  var dragX = null;

  function getHighScore() {
    var stored = 0;
    try {
      stored = parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10) || 0;
    } catch (e) {
      stored = 0;
    }
    return stored;
  }

  function setHighScore(value) {
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(value));
    } catch (e) {
      /* ignore storage failures */
    }
  }

  function getStoredBasketColor() {
    try {
      return localStorage.getItem(BASKET_COLOR_KEY) || DEFAULT_BASKET_COLOR;
    } catch (e) {
      return DEFAULT_BASKET_COLOR;
    }
  }

  function setStoredBasketColor(value) {
    try {
      localStorage.setItem(BASKET_COLOR_KEY, value);
    } catch (e) {
      /* ignore storage failures */
    }
  }

  function selectBasketColor(color) {
    basket.color = color;
    setStoredBasketColor(color);
    for (var i = 0; i < swatches.length; i++) {
      swatches[i].classList.toggle("selected", swatches[i].dataset.color === color);
    }
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    basket.x = Math.min(Math.max(basket.x, 0), width - basket.width);
  }

  function resetGame() {
    items = [];
    popups = [];
    shakeTime = 0;
    score = 0;
    lives = START_LIVES;
    spawnTimer = 0;
    spawnInterval = 1.1;
    fallSpeed = 140;
    elapsed = 0;
    basket.x = width / 2 - basket.width / 2;
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    bestEl.textContent = String(getHighScore());
    livesEl.textContent = "♥ ".repeat(Math.max(lives, 0)).trim() || "—";
  }

  function spawnItem() {
    var isBad = Math.random() < BAD_CHANCE;
    var def = isBad ? BAD_ITEM : GOOD_ITEMS[Math.floor(Math.random() * GOOD_ITEMS.length)];
    var size = 34;
    items.push({
      x: Math.random() * (width - size) + size / 2,
      y: -size,
      size: size,
      vy: fallSpeed + Math.random() * 40,
      emoji: def.emoji,
      points: def.points || 0,
      bad: isBad
    });
  }

  function update(dt) {
    elapsed += dt;
    spawnTimer += dt;

    spawnInterval = Math.max(0.45, 1.1 - elapsed * 0.01);
    fallSpeed = 140 + elapsed * 6;

    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnItem();
    }

    if (dragX !== null) {
      basket.x = dragX - basket.width / 2;
    } else {
      if (keys.left) basket.x -= basket.speed * dt;
      if (keys.right) basket.x += basket.speed * dt;
    }
    basket.x = Math.min(Math.max(basket.x, 0), width - basket.width);

    var basketTop = height - basket.height - 10;
    for (var i = items.length - 1; i >= 0; i--) {
      var item = items[i];
      item.y += item.vy * dt;

      var caught =
        item.y + item.size / 2 >= basketTop &&
        item.y - item.size / 2 <= basketTop + basket.height &&
        item.x >= basket.x - item.size / 2 &&
        item.x <= basket.x + basket.width + item.size / 2;

      if (caught) {
        items.splice(i, 1);
        if (item.bad) {
          lives -= 1;
          updateHud();
          shakeTime = SHAKE_DURATION;
          popups.push({ x: item.x, y: item.y, text: "BAD IDEA", age: 0, maxAge: 0.55, color: "#ef4444" });
          if (lives <= 0) {
            endGame();
            return;
          }
        } else {
          score += item.points;
          updateHud();
          popups.push({ x: item.x, y: item.y, text: "+" + item.points, age: 0, maxAge: 0.55 });
        }
        continue;
      }

      if (item.y - item.size / 2 > height) {
        items.splice(i, 1);
      }
    }

    for (var j = popups.length - 1; j >= 0; j--) {
      popups[j].age += dt;
      if (popups[j].age >= popups[j].maxAge) popups.splice(j, 1);
    }

    if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    if (shakeTime > 0) {
      var shakeDecay = shakeTime / SHAKE_DURATION;
      var shakeX = (Math.random() * 2 - 1) * SHAKE_MAGNITUDE * shakeDecay;
      var shakeY = (Math.random() * 2 - 1) * SHAKE_MAGNITUDE * shakeDecay;
      ctx.translate(shakeX, shakeY);
    }

    ctx.font = "32px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      ctx.font = item.size + "px sans-serif";
      ctx.fillText(item.emoji, item.x, item.y);
    }

    var basketTop = height - basket.height - 10;
    ctx.fillStyle = basket.color;
    ctx.beginPath();
    var r = 10;
    var x = basket.x;
    var y = basketTop;
    var w = basket.width;
    var h = basket.height;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();

    for (var p = 0; p < popups.length; p++) {
      var popup = popups[p];
      var t = popup.age / popup.maxAge;
      var alpha;
      if (t < 0.15) {
        alpha = t / 0.15;
      } else if (t > 0.55) {
        alpha = Math.max(0, 1 - (t - 0.55) / 0.45);
      } else {
        alpha = 1;
      }

      var scale;
      if (t < 0.12) {
        scale = 0.5 + (1.4 - 0.5) * (t / 0.12);
      } else if (t < 0.22) {
        scale = 1.4 - (1.4 - 1) * ((t - 0.12) / 0.1);
      } else {
        scale = 1;
      }

      var riseY = -32 * easeOutCubic(Math.min(t, 1));

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(popup.x, popup.y + riseY);
      ctx.scale(scale, scale);
      ctx.font = "bold 8pt sans-serif";
      ctx.fillStyle = popup.color || "#22c55e";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(popup.text, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  function loop(timestamp) {
    if (!running || paused) return;
    var dt = Math.min((timestamp - lastTime) / 1000, 0.05) || 0;
    lastTime = timestamp;
    update(dt);
    draw();
    if (running) requestAnimationFrame(loop);
  }

  function startGame() {
    resize();
    resetGame();
    startPanel.classList.add("hidden");
    overPanel.classList.add("hidden");
    pausePanel.classList.add("hidden");
    if (colorPicker) colorPicker.classList.remove("hidden");
    if (pauseButton) pauseButton.classList.remove("hidden");
    running = true;
    paused = false;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;
    paused = false;
    var best = getHighScore();
    if (score > best) {
      best = score;
      setHighScore(best);
    }
    bestEl.textContent = String(best);
    finalScoreText.textContent = "Score: " + score + (score >= best && score > 0 ? " — new best!" : "");
    overPanel.classList.remove("hidden");
    if (colorPicker) colorPicker.classList.add("hidden");
    if (pauseButton) pauseButton.classList.add("hidden");
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    if (paused) {
      pausePanel.classList.remove("hidden");
      if (pauseButton) pauseButton.textContent = "▶";
    } else {
      pausePanel.classList.add("hidden");
      if (pauseButton) pauseButton.textContent = "⏸";
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  }

  startButton.addEventListener("click", startGame);
  retryButton.addEventListener("click", startGame);
  if (pauseButton) pauseButton.addEventListener("click", togglePause);
  if (resumeButton) resumeButton.addEventListener("click", togglePause);

  for (var si = 0; si < swatches.length; si++) {
    swatches[si].addEventListener("click", function () {
      selectBasketColor(this.dataset.color);
    });
  }

  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
    if (e.key === "p" || e.key === "P" || e.key === "Escape") togglePause();
  });
  window.addEventListener("keyup", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
  });

  function pointerX(clientX) {
    var rect = canvas.getBoundingClientRect();
    return clientX - rect.left;
  }

  canvas.addEventListener("mousedown", function (e) {
    dragX = pointerX(e.clientX);
  });
  window.addEventListener("mousemove", function (e) {
    if (dragX !== null) dragX = pointerX(e.clientX);
  });
  window.addEventListener("mouseup", function () {
    dragX = null;
  });

  canvas.addEventListener(
    "touchstart",
    function (e) {
      dragX = pointerX(e.touches[0].clientX);
    },
    { passive: true }
  );
  canvas.addEventListener(
    "touchmove",
    function (e) {
      dragX = pointerX(e.touches[0].clientX);
    },
    { passive: true }
  );
  canvas.addEventListener("touchend", function () {
    dragX = null;
  });

  window.addEventListener("resize", resize);

  selectBasketColor(getStoredBasketColor());
  resize();
  updateHud();
})();
