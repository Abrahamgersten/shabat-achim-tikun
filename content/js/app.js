(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'hzc-draft-v1'; // מרחב שמות ייחודי: כל האתרים חולקים origin
  var photos = []; // {id, blob, url, cap}
  var seq = 0;

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
      ta.addEventListener('input', function () { p.cap = ta.value; save(); });
      li.querySelector('.del').setAttribute('aria-label', 'הסרת תמונה ' + (i + 1));
      li.querySelector('.del').addEventListener('click', function () {
        URL.revokeObjectURL(p.url); photos.splice(i, 1); render();
      });
      ul.appendChild(li);
    });
    $('moreRow').hidden = !photos.length;
    summary();
  }

  function summary() {
    var parts = [];
    if ($('text').value.trim()) parts.push('טקסט');
    if (photos.length) parts.push(photos.length === 1 ? 'תמונה אחת' : photos.length + ' תמונות');
    $('sum').textContent = parts.length ? 'מוכן לשליחה: ' + parts.join(' ו-') : 'עוד לא הוספתם תכנים';
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ school: $('school').value, who: $('who').value, text: $('text').value, notes: $('notes').value })); } catch (e) {}
    summary();
  }
  try {
    var d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d) { $('school').value = d.school || ''; $('who').value = d.who || ''; $('text').value = d.text || ''; $('notes').value = d.notes || ''; }
  } catch (e) {}
  ['school', 'who', 'text', 'notes'].forEach(function (i) { $(i).addEventListener('input', save); });

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

  function msg(t, cls) { $('msg').innerHTML = '<div class="alert ' + cls + '"></div>'; $('msg').firstChild.textContent = t; }

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!$('school').value.trim()) { msg('חסר שם בית הספר', 'err'); $('school').focus(); return; }
    if (!$('text').value.trim() && !photos.length) { msg('הוסיפו טקסט או תמונה לפני השליחה', 'err'); return; }
    var fd = new FormData();
    fd.append('school', $('school').value.trim()); fd.append('who', $('who').value.trim());
    fd.append('text', $('text').value.trim()); fd.append('notes', $('notes').value.trim());
    fd.append('count', photos.length);
    photos.forEach(function (p, i) { fd.append('photo_' + (i + 1), p.blob, 'photo_' + (i + 1) + '.jpg'); fd.append('caption_' + (i + 1), p.cap.trim()); });
    var ep = (window.CONTENT_APP || {}).ENDPOINT;
    $('send').disabled = true; $('prog').hidden = false;
    var done = function (ok, demo) {
      $('send').disabled = false; $('prog').hidden = true;
      if (!ok) { msg('השליחה לא הצליחה. התכנים נשארו כאן, אפשר לנסות שוב.', 'err'); return; }
      try { localStorage.removeItem(KEY); } catch (x) {}
      $('form').hidden = true; $('bar').hidden = true; $('done').hidden = false;
      $('doneTxt').textContent = demo ? 'מצב הדגמה: כרגע שום דבר לא נשלח בפועל.' : 'קיבלנו את התכנים של ' + $('school').value.trim() + '.';
      window.scrollTo(0, 0);
    };
    if (!ep) { setTimeout(function () { done(true, true); }, 400); return; }
    var x = new XMLHttpRequest(); x.open('POST', ep);
    x.upload.onprogress = function (ev) { if (ev.lengthComputable) $('prog').firstChild.style.width = (ev.loaded / ev.total * 100) + '%'; };
    x.onload = function () { done(x.status >= 200 && x.status < 300); };
    x.onerror = function () { done(false); };
    x.send(fd);
  });

  $('again').addEventListener('click', function () {
    photos.forEach(function (p) { URL.revokeObjectURL(p.url); }); photos = [];
    $('text').value = ''; $('notes').value = '';
    $('done').hidden = true; $('form').hidden = false; $('bar').hidden = false; render();
  });
  render();
})();
