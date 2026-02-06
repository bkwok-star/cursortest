(function () {
  var outputEl = document.getElementById('output');
  var inputEl = document.getElementById('input');
  var statusEl = document.getElementById('status');
  var hpFill = document.getElementById('hpFill');
  var hpText = document.getElementById('hpText');
  var hpBar = document.getElementById('hpBar');

  function appendLine(line, cssClass) {
    var parts = line.split('\n');
    for (var i = 0; i < parts.length; i++) {
      var div = document.createElement('div');
      div.className = 'line' + (cssClass ? ' ' + cssClass : '');
      div.textContent = parts[i];
      outputEl.appendChild(div);
    }
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function setHp(current, max) {
    if (!hpFill || !hpText) return;
    var pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    hpFill.style.width = pct + '%';
    hpFill.className = 'hp-fill' + (pct <= 25 ? ' critical' : pct <= 50 ? ' low' : '');
    hpText.textContent = current + '/' + max;
  }

  function setBar(fillId, textId, current, max) {
    var fill = document.getElementById(fillId);
    var text = document.getElementById(textId);
    if (!fill || !text) return;
    var pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    fill.style.width = pct + '%';
    text.textContent = current + '/' + max;
  }

  var socket = io();

  socket.on('connect', function () {
    statusEl.textContent = 'online';
    statusEl.classList.add('connected');
    inputEl.disabled = false;
    inputEl.focus();
    if (outputEl.textContent === 'Connecting...') {
      outputEl.textContent = '';
    }
    appendLine('[ Connected ]');
  });

  socket.on('disconnect', function () {
    statusEl.textContent = 'offline';
    statusEl.classList.remove('connected');
    inputEl.disabled = true;
    appendLine('[ Disconnected ]');
  });

  socket.on('hp', function (data) {
    setHp(data.current, data.max);
  });
  socket.on('stamina', function (data) {
    setBar('staminaFill', 'staminaText', data.current, data.max);
  });
  socket.on('energy', function (data) {
    setBar('energyFill', 'energyText', data.current, data.max);
  });

  socket.on('updateStats', function (data) {
    setHp(data.hp, data.maxHp);
    setBar('staminaFill', 'staminaText', data.stamina != null ? data.stamina : 100, data.maxStamina != null ? data.maxStamina : 100);
    setBar('energyFill', 'energyText', data.energy != null ? data.energy : 50, data.maxEnergy != null ? data.maxEnergy : 50);
    var csHp = document.getElementById('csHp');
    var csAttack = document.getElementById('csAttack');
    var csInv = document.getElementById('csInv');
    if (csHp) csHp.textContent = data.hp + '/' + data.maxHp;
    if (csAttack) csAttack.textContent = String(data.attack);
    var csGold = document.getElementById('csGold');
    if (csGold) csGold.textContent = String(data.gold != null ? data.gold : 0);
    var csClass = document.getElementById('csClass');
    if (csClass) csClass.textContent = (data.class && data.class !== 'WARRIOR') ? String(data.class).toLowerCase().replace(/^./, function (c) { return c.toUpperCase(); }) : 'Warrior';
    var csLevel = document.getElementById('csLevel');
    if (csLevel) csLevel.textContent = String(data.level != null ? data.level : 1);
    var csXp = document.getElementById('csXp');
    var target = data.xpToNextLevel != null ? data.xpToNextLevel : 100;
    var current = data.xp != null ? data.xp : 0;
    if (csXp) csXp.textContent = current + ' / ' + target;
    var csXpFill = document.getElementById('csXpFill');
    if (csXpFill) {
      var pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
      csXpFill.style.width = pct + '%';
    }
    var csSkills = document.getElementById('csSkills');
    if (csSkills) {
      if (data.skills && data.skills.length > 0) {
        csSkills.textContent = data.skills.join(', ');
      } else {
        csSkills.textContent = '—';
      }
    }
    if (data.equipment) {
      var slots = ['WEAPON', 'SHIELD', 'HEAD', 'BODY'];
      slots.forEach(function (slot) {
        var el = document.querySelector('.character-sheet .equip-item[data-slot="' + slot + '"] .eq-value');
        if (el) {
          var item = data.equipment[slot];
          el.textContent = item && item.name ? item.name : '—';
          el.parentElement.classList.toggle('empty', !item || !item.name);
        }
      });
    }
    if (csInv) {
      if (data.inventory && data.inventory.length > 0) {
        csInv.textContent = '';
        data.inventory.forEach(function (it) {
          var div = document.createElement('div');
          div.className = 'inv-item';
          div.textContent = it.name;
          csInv.appendChild(div);
        });
      } else {
        csInv.textContent = 'Nothing.';
      }
    }
  });

  socket.on('combat-deal', function (msg) {
    appendLine(String(msg), 'combat-deal');
  });

  socket.on('combat-take', function (msg) {
    appendLine(String(msg), 'combat-take');
  });

  inputEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var line = inputEl.value.trim();
    inputEl.value = '';
    if (!line) return;
    appendLine('> ' + line);
    socket.emit('command', line);
  });

  socket.on('message', function (msg) {
    appendLine(String(msg));
  });
})();
