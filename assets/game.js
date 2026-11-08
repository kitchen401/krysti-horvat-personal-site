(function () {
  "use strict";

  var GOOD_ITEMS = [
    { emoji: "💡", points: 10 }, // 💡
    { emoji: "🚀", points: 15 }, // 🚀
    { emoji: "🎯", points: 20 }  // 🎯
  ];
  var BAD_ITEM = { emoji: "🗑️" }; // 🗑️
  var BAD_CHANCE = 0.22;
  var START_LIVES = 3;
  var HIGH_SCORE_KEY = "catchTheBigIdeaHighScore";

  var canvas = document.getElementById("gameCanvas");
  var ctx = canvas.getContext("2d");
  var scoreEl = document.getElementById("score");
  var livesEl = document.getElementById("lives");
  var bestEl = document.getElementById("best");
  var startPanel = document.getElementById("startPanel");
  var overPanel = document.getElementById("overPanel");
  var finalScoreText = document.getElementById("finalScoreText");
  var startButton = document.getElementById("startButton");
  var retryButton = document.getElementById("retryButton");

  var width = 0;
  var height = 0;
  var basket = { x: 0, width: 70, height: 36, speed: 420 };
  var items = [];
  var score = 0;
  var lives = START_LIVES;
  var spawnTimer = 0;
  var spawnInterval = 1.1;
  var fallSpeed = 140;
  var elapsed = 0;
  var running = false;
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
          if (lives <= 0) {
            endGame();
            return;
          }
        } else {
          score += item.points;
          updateHud();
        }
        continue;
      }

      if (item.y - item.size / 2 > height) {
        items.splice(i, 1);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    ctx.font = "32px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      ctx.font = item.size + "px sans-serif";
      ctx.fillText(item.emoji, item.x, item.y);
    }

    var basketTop = height - basket.height - 10;
    ctx.fillStyle = "#7a5cff";
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
  }

  function loop(timestamp) {
    if (!running) return;
    var dt = Math.min((timestamp - lastTime) / 1000, 0.05) || 0;
    lastTime = timestamp;
    update(dt);
    if (!running) return;
    draw();
    requestAnimationFrame(loop);
  }

  function startGame() {
    resize();
    resetGame();
    startPanel.classList.add("hidden");
    overPanel.classList.add("hidden");
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;
    var best = getHighScore();
    if (score > best) {
      best = score;
      setHighScore(best);
    }
    bestEl.textContent = String(best);
    finalScoreText.textContent = "Score: " + score + (score >= best && score > 0 ? " — new best!" : "");
    overPanel.classList.remove("hidden");
  }

  startButton.addEventListener("click", startGame);
  retryButton.addEventListener("click", startGame);

  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
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

  resize();
  updateHud();
})();
