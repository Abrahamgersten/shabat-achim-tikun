(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'hzc-draft-v1'; // מרחב שמות ייחודי: כל האתרים חולקים origin
  var BK = KEY + '_batch';  // הקבוצה הפתוחה: כל מה שנשמר עד "סיימתי" נאסף לעלון אחד
  var CHUNK = 8;            // תמונות בכל בקשה. שליחה גדולה מתחלקת לכמה בקשות באותה קבוצה
  var photos = []; // {id, blob, url, cap}
  var seq = 0;
  var busy = false;

  function resize(file) {
    return new Promise(function (res) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var M = 1800, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, M / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { res(b || file); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(file); };
      img.src = url;
    });
  }

  function hasNew() { return !!($('text').value.trim() || photos.length); }

  function render() {
    var ul = $('photos'); ul.innerHTML = '';
    photos.forEach(function (p, i) {
      var li = document.createElement('li'); li.className = 'photo';
      li.innerHTML = '<div class="pic"><img alt=""><span class="num"></span><button type="button" class="del">הסרה</button></div>' +
        '<div class="cap"><label>תיאור <span class="opt">(לא חובה)</span></label><textarea></textarea></div>';
      li.querySelector('img').src = p.url;
      li.querySelector('img').alt = 'תמונה ' + (i + 1);
      li.querySelector('.num').textContent = i + 1;
      var ta = li.querySelector('textarea'); ta.value = p.cap;
      ta.setAttribute('aria-label', 'תיאור לתמונה ' + (i + 1));
      ta.addEventListener('input', function () { p.cap = ta.value; });
      li.querySelector('.del').setAttribute('aria-label', 'הסרת תמונה ' + (i + 1));
      li.querySelector('.del').addEventListener('click', function () {
        URL.revokeObjectURL(p.url); photos.splice(i, 1); render();
      });
      ul.appendChild(li);
    });
    $('moreRow').hidden = !photos.length;
    summary();
  }

  function count(n, one, many) { return n === 1 ? one : n + ' ' + many; }
  function joinHe(parts) { return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' ו-' + parts[parts.length - 1] : parts.join(''); }

  // מה נשמר עד עכשיו בקבוצה הפתוחה
  function getBatch() { try { return JSON.parse(localStorage.getItem(BK) || 'null'); } catch (e) { return null; } }
  function setBatch(b) { try { localStorage.setItem(BK, JSON.stringify(b)); } catch (e) {} }
  function clearBatch() { try { localStorage.removeItem(BK); } catch (e) {} }
  function savedParts() { var b = getBatch(); return b && b.parts ? b.parts : 0; }
  function ensureBatch() {
    var b = getBatch();
    if (!b || !b.id) { b = { id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), parts: 0, texts: 0, photos: 0 }; setBatch(b); }
    return b;
  }
  function savedWhat(b) {
    if (b.texts === undefined) return count(b.parts, 'חלק אחד', 'חלקים'); // קבוצה שנפתחה בגרסה הקודמת
    var p = [];
    if (b.texts) p.push(count(b.texts, 'טקסט אחד', 'טקסטים'));
    if (b.photos) p.push(count(b.photos, 'תמונה אחת', 'תמונות'));
    return joinHe(p) || count(b.parts, 'חלק אחד', 'חלקים');
  }

  function summary() {
    var p = [];
    if ($('text').value.trim()) p.push('טקסט');
    if (photos.length) p.push(count(photos.length, 'תמונה אחת', 'תמונות'));
    var n = savedParts();
    if (p.length) $('sum').textContent = 'מוכן לשליחה: ' + joinHe(p);
    else if (n) $('sum').textContent = 'שמרתם כבר ' + savedWhat(getBatch()) + '. אין תכנים חדשים.';
    else $('sum').textContent = 'עוד לא הוספתם תכנים';
    $('send').textContent = (!p.length && n) ? 'סיימתי, הפיקו לי עלון' : 'שליחת התכנים';
  }

  function note() {
    var b = getBatch(), n = b && b.parts;
    $('savedBox').hidden = !n;
    if (n) $('savedTxt').textContent = 'שמרתם עד עכשיו ' + savedWhat(b) + '. אפשר להוסיף כאן עוד תכנים, או ללחוץ "סיימתי" אם זה הכול.';
    summary();
  }

  // טיוטה ופרטי בית הספר נשמרים במכשיר
  function saveDraft() {
    try { localStorage.setItem(KEY, JSON.stringify({ school: $('school').value, who: $('who').value, text: $('text').value, notes: $('notes').value })); } catch (e) {}
    summary();
  }
  function saveId() {
    try { localStorage.setItem(KEY + '_id', JSON.stringify({ school: $('school').value.trim(), who: $('who').value.trim() })); } catch (e) {}
  }
  try {
    var d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d) { $('school').value = d.school || ''; $('who').value = d.who || ''; $('text').value = d.text || ''; $('notes').value = d.notes || ''; }
    var idn = JSON.parse(localStorage.getItem(KEY + '_id') || 'null');
    if (idn) { if (!$('school').value) $('school').value = idn.school || ''; if (!$('who').value) $('who').value = idn.who || ''; }
  } catch (e) {}
  ['school', 'who', 'text', 'notes'].forEach(function (i) { $(i).addEventListener('input', saveDraft); });
  ['school', 'who'].forEach(function (i) { $(i).addEventListener('input', saveId); });

  function openPicker() { $('file').click(); }
  $('pick').addEventListener('click', openPicker);
  $('more').addEventListener('click', openPicker);
  $('file').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files); this.value = '';
    $('msg').innerHTML = '';
    Promise.all(files.map(resize)).then(function (blobs) {
      blobs.forEach(function (b) { photos.push({ id: ++seq, blob: b, url: URL.createObjectURL(b), cap: '' }); });
      render();
    });
  });

  function msg(t, cls) {
    $('msg').innerHTML = '<div class="alert ' + cls + '"></div>'; $('msg').firstChild.textContent = t;
    if (cls === 'err') $('msg').scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function post(fd, onProgress) {
    return new Promise(function (res) {
      var x = new XMLHttpRequest(); x.open('POST', window.CONTENT_APP.ENDPOINT);
      x.upload.onprogress = function (ev) { if (ev.lengthComputable) onProgress(ev.loaded / ev.total); };
      x.onload = function () { res(x.status >= 200 && x.status < 300); };
      x.onerror = function () { res(false); };
      x.send(fd);
    });
  }

  function setBusy(on) {
    busy = on;
    ['send', 'finishNow'].forEach(function (i) { $(i).disabled = on; });
    $('prog').hidden = !on;
    if (!on) $('prog').firstChild.style.width = '0';
  }

  // שולח את מה שבטופס. final = הלקוח לחץ "סיימתי": מה שנשמר קודם מצטרף, והעלון יוצא להפקה.
  // הרבה תמונות יוצאות בכמה בקשות; מה שעלה יורד מהטופס, כך שניסיון חוזר ממשיך מאיפה שנעצר.
  function send(final) {
    if (busy) return;
    var school = $('school').value.trim();
    if (!school) { msg('חסר שם בית הספר', 'err'); $('school').focus(); return; }
    if (!hasNew() && !(final && savedParts())) { msg('הוסיפו טקסט או תמונה לפני השליחה', 'err'); return; }
    $('msg').innerHTML = '';
    var b = ensureBatch();
    var ep = (window.CONTENT_APP || {}).ENDPOINT;
    var chunks = [];
    for (var i = 0; i < photos.length; i += CHUNK) chunks.push(photos.slice(i, i + CHUNK));
    if (!chunks.length) chunks.push([]);
    var total = chunks.length, k = 0, counted = false;
    setBusy(true);

    function next() {
      var part = chunks[k], first = k === 0, last = k === total - 1;
      var text = first ? $('text').value.trim() : '', notes = first ? $('notes').value.trim() : '';
      var fd = new FormData();
      fd.append('school', school); fd.append('who', $('who').value.trim());
      fd.append('text', text); fd.append('notes', notes);
      fd.append('batch', b.id); fd.append('final', final && last ? '1' : '0');
      fd.append('count', part.length);
      part.forEach(function (p, j) { fd.append('photo_' + (j + 1), p.blob, 'photo_' + (j + 1) + '.jpg'); fd.append('caption_' + (j + 1), p.cap.trim()); });
      var go = ep ? post(fd, function (f) { $('prog').firstChild.style.width = ((k + f) / total * 100) + '%'; })
                  : new Promise(function (r) { setTimeout(function () { r(true); }, 300); });
      go.then(function (ok) {
        if (!ok) {
          setBusy(false); render(); note();
          msg(k ? 'חלק מהתכנים נשמר, אבל השליחה נעצרה באמצע. מה שעוד לא נשלח נשאר כאן, לחצו שוב לשלוח אותו.'
                : 'השליחה לא הצליחה. התכנים נשארו כאן, אפשר לנסות שוב.', 'err');
          return;
        }
        // החלק הזה נשמר: נספר ויורד מהטופס
        if (text || part.length) {
          if (!counted) { b.parts += 1; counted = true; }
          if (b.texts === undefined) { b.texts = 0; b.photos = 0; }
          if (text) b.texts += 1;
          b.photos += part.length;
          setBatch(b);
        }
        if (first) { $('text').value = ''; $('notes').value = ''; saveDraft(); }
        part.forEach(function (p) { URL.revokeObjectURL(p.url); });
        photos = photos.filter(function (p) { return part.indexOf(p) < 0; });
        k += 1;
        if (k < total) { next(); return; }
        setBusy(false);
        try { localStorage.removeItem(KEY); } catch (x) {}
        finish(final, school, !ep);
      });
    }
    next();
  }

  function finish(final, school, demo) {
    render();
    $('form').hidden = true; $('bar').hidden = true; $('done').hidden = false;
    if (final) {
      clearBatch();
      $('doneH').textContent = 'סיימתם, תודה!';
      $('doneTxt').textContent = demo ? 'מצב הדגמה: כרגע שום דבר לא נשלח בפועל.' : 'קיבלנו את כל התכנים של ' + school + ', ואנחנו מתחילים להפיק את העלון.';
      $('again').textContent = 'שליחה חדשה';
    } else {
      $('doneH').textContent = 'נשמר!';
      $('doneTxt').textContent = 'שמרנו את מה ששלחתם עד עכשיו (' + savedWhat(getBatch()) + '). אפשר לסגור את הדף ולחזור מתי שנוח, גם מחר, מאותו טלפון. כשתסיימו להזין את הכול, לחצו "סיימתי, הפיקו לי עלון".';
      $('again').textContent = 'הוספת עוד תכנים';
    }
    note();
    window.scrollTo(0, 0);
    $('doneH').setAttribute('tabindex', '-1'); $('doneH').focus();
  }

  // השאלה: סיימתם, או שיש עוד?
  var ask = $('ask');
  function openAsk() {
    if (typeof ask.showModal === 'function') ask.showModal(); else ask.setAttribute('open', '');
    $('askDone').focus();
  }
  function closeAsk() { if (typeof ask.close === 'function') ask.close(); else ask.removeAttribute('open'); }
  $('askDone').addEventListener('click', function () { closeAsk(); send(true); });
  $('askMore').addEventListener('click', function () { closeAsk(); send(false); });
  $('askBack').addEventListener('click', closeAsk);
  ask.addEventListener('click', function (e) { if (e.target === ask) closeAsk(); }); // לחיצה על הרקע

  $('form').addEventListener('submit', function (e) { e.preventDefault(); });
  $('send').addEventListener('click', function () {
    if (busy) return;
    if (!$('school').value.trim()) { msg('חסר שם בית הספר', 'err'); $('school').focus(); return; }
    if (hasNew()) { openAsk(); return; }
    if (savedParts()) { send(true); return; } // אין תכנים חדשים: הכפתור כבר אומר "סיימתי"
    msg('הוסיפו טקסט או תמונה לפני השליחה', 'err');
  });
  $('finishNow').addEventListener('click', function () { send(true); });

  $('again').addEventListener('click', function () {
    $('done').hidden = true; $('form').hidden = false; $('bar').hidden = false;
    render(); note();
    $('text').focus();
  });
  note();
  render();
})();
