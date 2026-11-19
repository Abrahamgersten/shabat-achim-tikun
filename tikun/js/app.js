/* תיקון בעלון - שבת אחים.
   The request (text changes + picture swaps) goes to the Supabase function leaflet-fix. Text-only requests fall back
   to the old Google Form when the function cannot be reached. Roni's task reads both every 5 minutes, fixes a copy
   of the leaflet, and asks Avraham to approve before anything reaches the school (Tools/leaflet_fix in רוני המתכנת). */
(function () {
  "use strict";

  var FN = "https://nuadpewhrhpdgznbbqbs.supabase.co/functions/v1/leaflet-fix";
  var FORM = {
    action: "https://docs.google.com/forms/d/e/1FAIpQLSe55TRYcDBpB_5-iduf4siDumgd8X01zGzYKj5eqJ7hkFTktQ/formResponse",
    school: "entry.764187731",
    old: ["entry.1985615888", "entry.767166122", "entry.1574483184"],
    neu: ["entry.1880177485", "entry.1831199933", "entry.2134137255"],
    phone: "entry.480865705",
    name: "entry.436065913",
    changesJson: "entry.591003511"
  };
  var START_CHANGES = 2;
  var STORE = "shabat-achim-tikun:v1"; // all his GitHub Pages sites share one origin: keys are namespaced

  var $ = function (id) { return document.getElementById(id); };
  var list = $("changes"), imgList = $("images"), tpl = $("changeTpl"), imgTpl = $("imageTpl"), form = $("fixForm");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var uid = 0;

  function load() { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { return {}; } }
  function save(obj) { try { localStorage.setItem(STORE, JSON.stringify(obj)); } catch (e) { /* private mode: fine */ } }

  function ordinal(n) {
    var words = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שביעי", "שמיני", "תשיעי", "עשירי"];
    return n <= words.length ? "שינוי " + words[n - 1] : "שינוי " + n;
  }
  function imgTitle(n) { return "החלפת תמונה " + n; }

  function renumber() {
    var items = list.children;
    for (var i = 0; i < items.length; i++) {
      var li = items[i], n = i + 1;
      li.querySelector(".change-title").textContent = ordinal(n);
      var rm = li.querySelector(".btn-remove");
      rm.hidden = i === 0; // the first change is always there
      rm.setAttribute("aria-label", "הסרה: " + ordinal(n)); // starts with the visible label (WCAG 2.5.3)
    }
    var imgs = imgList.children;
    for (var j = 0; j < imgs.length; j++) {
      imgs[j].querySelector(".change-title").textContent = imgTitle(j + 1);
      imgs[j].querySelector(".btn-remove").setAttribute("aria-label", "הסרה: " + imgTitle(j + 1));
      imgs[j].querySelectorAll(".pick-btn").forEach(function (b) {
        b.setAttribute("aria-label", b.parentNode.querySelector(".pick-label").textContent + " (" + imgTitle(j + 1) + ")" +
          (b.parentNode.picked ? ": נבחרה תמונה, לחצו להחלפה" : ": בחירת תמונה"));
      });
    }
    $("addImage").lastChild.textContent = imgs.length ? "החלפת תמונה נוספת" : "החלפת תמונה";
  }

  function addChange(values, focus) {
    var node = tpl.content.firstElementChild.cloneNode(true);
    var id = ++uid;
    var areas = node.querySelectorAll("textarea"), labels = node.querySelectorAll("label");
    var err = node.querySelector(".change-error");
    err.id = "e_change_" + id;
    node.querySelector(".change-title").id = "t_change_" + id;
    node.setAttribute("aria-labelledby", "t_change_" + id);
    ["old", "new"].forEach(function (k, j) {
      areas[j].id = "f_" + k + "_" + id;
      labels[j].htmlFor = areas[j].id;
      areas[j].setAttribute("aria-describedby", err.id);
      areas[j].value = (values && values[k]) || "";
    });
    node.querySelector(".btn-remove").addEventListener("click", function () { removeItem(node, list); });
    appear(node, focus);
    list.appendChild(node);
    renumber();
    if (focus) {
      areas[0].focus();
      $("announce").textContent = "נוסף " + ordinal(list.children.length);
    }
  }

  /* ---------- picture swaps ---------- */
  function resize(file) {
    return new Promise(function (res) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var M = 2000, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, M / Math.max(w, h));
        var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
        var ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); // PNG with transparency
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { res(b || file); }, "image/jpeg", 0.9);
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(file); };
      img.src = url;
    });
  }

  function addImage(focus) {
    var node = imgTpl.content.firstElementChild.cloneNode(true);
    var id = ++uid, err = node.querySelector(".change-error");
    err.id = "e_image_" + id;
    node.querySelector(".change-title").id = "t_image_" + id;
    node.setAttribute("aria-labelledby", "t_image_" + id);
    node.querySelectorAll(".pick").forEach(function (pick) {
      var btn = pick.querySelector(".pick-btn"), input = pick.querySelector("input"), img = pick.querySelector(".pick-img");
      btn.setAttribute("aria-describedby", err.id);
      btn.addEventListener("click", function () { input.click(); });
      input.addEventListener("change", function () {
        var f = input.files && input.files[0];
        input.value = "";
        if (!f) return;
        resize(f).then(function (blob) {
          if (pick.url) URL.revokeObjectURL(pick.url);
          pick.picked = blob; pick.url = URL.createObjectURL(blob);
          img.src = pick.url; img.hidden = false;
          pick.querySelector(".pick-empty").hidden = true;
          pick.classList.add("has-img");
          setError([btn], err);
          renumber();
        });
      });
    });
    node.querySelector(".btn-remove").addEventListener("click", function () { removeItem(node, imgList); });
    appear(node, focus);
    imgList.appendChild(node);
    renumber();
    if (focus) {
      node.querySelector(".pick-btn").focus();
      $("announce").textContent = "נוספה " + imgTitle(imgList.children.length);
    }
  }

  function readImages() {
    return Array.prototype.map.call(imgList.children, function (li) {
      var p = li.querySelectorAll(".pick");
      return { li: li, current: p[0].picked || null, "new": p[1].picked || null, currentUrl: p[0].url, newUrl: p[1].url };
    });
  }

  function appear(node, focus) {
    if (focus && !reduceMotion) node.classList.add("is-new");
    node.addEventListener("animationend", function () { node.classList.remove("is-new"); });
  }

  function removeItem(node, parent) {
    var idx = Array.prototype.indexOf.call(parent.children, node);
    var finish = function () {
      node.querySelectorAll(".pick").forEach(function (p) { if (p.url) URL.revokeObjectURL(p.url); });
      node.remove();
      renumber();
      var items = parent.children, next = items[Math.min(idx, items.length - 1)];
      if (next) (next.querySelector("textarea") || next.querySelector(".pick-btn")).focus();
      else $(parent === imgList ? "addImage" : "addChange").focus();
      $("announce").textContent = parent === imgList ? "החלפת התמונה הוסרה" : "השינוי הוסר";
      persist();
    };
    if (reduceMotion) return finish();
    node.classList.add("is-leaving");
    node.addEventListener("animationend", finish, { once: true });
  }

  function readChanges() {
    return Array.prototype.map.call(list.children, function (li) {
      var a = li.querySelectorAll("textarea");
      return { li: li, old: a[0].value.trim(), "new": a[1].value.trim() };
    });
  }

  function persist() {
    save({
      school: $("f_school").value, phone: $("f_phone").value, name: $("f_name").value,
      changes: readChanges().map(function (c) { return { old: c.old, "new": c["new"] }; })
    });
  }

  /* ---------- validation ---------- */
  function setError(input, errEl, msg) {
    errEl.textContent = msg || "";
    errEl.hidden = !msg;
    [].concat(input).forEach(function (el) { if (msg) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); });
  }

  function normPhone(raw) {
    var d = (raw || "").replace(/\D/g, "");
    if (d.indexOf("972") === 0) d = "0" + d.slice(3);
    return /^05\d{8}$/.test(d) ? d : "";
  }

  function validate() {
    var first = null, mark = function (el) { if (!first) first = el; };
    var school = $("f_school");
    if (!school.value.trim()) { setError(school, $("e_school"), "כתבו את שם בית הספר"); mark(school); }
    else setError(school, $("e_school"));

    var filled = 0, itemErr = false;
    readChanges().forEach(function (c) {
      var a = c.li.querySelectorAll("textarea"), err = c.li.querySelector(".change-error"), msg = "", bad = [];
      if (c.old && !c["new"]) { msg = "חסר מה לכתוב במקום"; bad = [a[1]]; }
      else if (!c.old && c["new"]) { msg = "חסר מה כתוב עכשיו בעלון"; bad = [a[0]]; }
      else if (c.old && c.old === c["new"]) { msg = "הטקסט החדש זהה למה שכתוב עכשיו"; bad = [a[1]]; }
      setError([a[0], a[1]], err);
      if (msg) { setError(bad, err, msg); mark(bad[0]); itemErr = true; }
      else if (c.old) filled++;
    });
    readImages().forEach(function (p) {
      var btns = p.li.querySelectorAll(".pick-btn"), err = p.li.querySelector(".change-error");
      setError([btns[0], btns[1]], err);
      if (!p.current && !p["new"]) { setError([btns[0], btns[1]], err, "בחרו את שתי התמונות, או הסירו את ההחלפה"); mark(btns[0]); itemErr = true; }
      else if (!p.current) { setError([btns[0]], err, "חסרה התמונה שיש עכשיו בעלון"); mark(btns[0]); itemErr = true; }
      else if (!p["new"]) { setError([btns[1]], err, "חסרה התמונה החדשה"); mark(btns[1]); itemErr = true; }
      else filled++;
    });
    if (!filled && !itemErr) {
      var li = list.children[0], a0 = li.querySelectorAll("textarea");
      setError([a0[0], a0[1]], li.querySelector(".change-error"), "כתבו לפחות שינוי אחד, או הוסיפו החלפת תמונה");
      mark(a0[0]);
    }

    var phone = $("f_phone");
    if (!normPhone(phone.value)) { setError(phone, $("e_phone"), phone.value.trim() ? "מספר נייד ישראלי, למשל 050-1234567" : "כתבו מספר וואטסאפ"); mark(phone); }
    else setError(phone, $("e_phone"));
    return first;
  }

  /* ---------- submit ---------- */
  function setBusy(busy) {
    var b = $("submitBtn");
    b.disabled = busy;
    b.querySelector(".btn-label").textContent = busy ? "שולחים..." : "שליחת הבקשה";
    $("prog").hidden = !busy;
    if (!busy) $("prog").firstChild.style.width = "0";
  }

  function viaFunction(changes, images) {
    return new Promise(function (resolve) {
      var fd = new FormData();
      fd.append("school", $("f_school").value.trim());
      fd.append("name", $("f_name").value.trim());
      fd.append("phone", $("f_phone").value.trim());
      fd.append("changes", JSON.stringify(changes));
      fd.append("count", images.length);
      images.forEach(function (p, i) {
        fd.append("current_" + (i + 1), p.current, "current.jpg");
        fd.append("new_" + (i + 1), p["new"], "new.jpg");
      });
      var x = new XMLHttpRequest();
      x.open("POST", FN);
      x.timeout = 120000;
      x.upload.onprogress = function (ev) { if (ev.lengthComputable) $("prog").firstChild.style.width = (ev.loaded / ev.total * 100) + "%"; };
      x.onload = function () { resolve(x.status >= 200 && x.status < 300); };
      x.onerror = x.ontimeout = function () { resolve(false); };
      x.send(fd);
    });
  }

  function viaForm(changes) {
    var fd = new FormData();
    fd.append(FORM.school, $("f_school").value.trim());
    changes.slice(0, 3).forEach(function (c, i) { fd.append(FORM.old[i], c.old); fd.append(FORM.neu[i], c["new"]); });
    fd.append(FORM.changesJson, JSON.stringify(changes));
    fd.append(FORM.phone, $("f_phone").value.trim());
    fd.append(FORM.name, $("f_name").value.trim());
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    return fetch(FORM.action, { method: "POST", mode: "no-cors", body: fd, signal: ctrl ? ctrl.signal : undefined })
      .then(function () { clearTimeout(timer); return true; }, function () { clearTimeout(timer); return false; });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    $("formError").hidden = true;
    var bad = validate();
    if (bad) { bad.focus(); return; }

    var changes = readChanges().filter(function (c) { return c.old && c["new"]; })
      .map(function (c) { return { old: c.old, "new": c["new"] }; });
    var images = readImages().filter(function (p) { return p.current && p["new"]; });
    setBusy(true);
    viaFunction(changes, images)
      .then(function (ok) { return ok || images.length ? ok : viaForm(changes); }) // text only: the old form still works
      .then(function (ok) {
        if (ok) return onSent(changes, images);
        setBusy(false);
        var fe = $("formError");
        fe.textContent = "השליחה לא הצליחה. מה שכתבתם ובחרתם נשאר כאן. נסו שוב בעוד רגע, או כתבו לנו ל-abrahamgersten@gmail.com.";
        fe.hidden = false;
      });
  });

  function onSent(changes, images) {
    var s = load();
    save({ school: s.school, phone: s.phone, name: s.name, changes: [] }); // keep who you are, drop what was sent
    var num = document.createElement("bdi"); // keeps the final period on the Hebrew side of an LTR phone number
    num.textContent = $("f_phone").value.trim();
    $("doneText").replaceChildren("נמצא את המקום בעלון, נתקן, ונשלח את העלון המתוקן לבדיקה בוואטסאפ למספר ", num, ".");
    var dl = $("doneList");
    dl.textContent = "";
    var arrowTpl = tpl.content.querySelector(".change-arrow");
    changes.forEach(function (c) {
      var li = document.createElement("li");
      var arrow = arrowTpl.cloneNode(true); // the same library icon as in the form
      arrow.setAttribute("class", "icon arrow");
      li.append(span("was", c.old), " ", arrow, span("sr-only", "במקום "), " ", span("now", c["new"]));
      dl.appendChild(li);
    });
    images.forEach(function (p, i) {
      var li = document.createElement("li");
      li.className = "done-img";
      var arrow = arrowTpl.cloneNode(true);
      arrow.setAttribute("class", "icon arrow");
      li.append(thumb(p.currentUrl, "התמונה שיש עכשיו בעלון"), " ", arrow, " ", thumb(p.newUrl, "התמונה החדשה"),
        span("sr-only", imgTitle(i + 1)));
      dl.appendChild(li);
    });
    form.hidden = true;
    $("done").hidden = false;
    $("done").focus();
    setBusy(false);
  }

  function thumb(url, alt) {
    var im = document.createElement("img");
    im.src = url; im.alt = alt; im.className = "done-thumb";
    return im;
  }

  function span(cls, text, decorative) {
    var s = document.createElement("span");
    s.className = cls;
    s.textContent = text;
    if (decorative) s.setAttribute("aria-hidden", "true");
    return s;
  }

  $("again").addEventListener("click", function () {
    list.textContent = "";
    imgList.querySelectorAll(".pick").forEach(function (p) { if (p.url) URL.revokeObjectURL(p.url); });
    imgList.textContent = "";
    for (var i = 0; i < START_CHANGES; i++) addChange(null, false);
    renumber();
    $("done").hidden = true;
    form.hidden = false;
    list.querySelector("textarea").focus();
  });

  /* ---------- start ---------- */
  $("addChange").addEventListener("click", function () { addChange(null, true); persist(); });
  $("addImage").addEventListener("click", function () { addImage(true); });
  form.addEventListener("input", persist);

  var saved = load();
  ["school", "phone", "name"].forEach(function (k) { if (saved[k]) $("f_" + k).value = saved[k]; });
  var start = (saved.changes || []).filter(function (c) { return c.old || c["new"]; });
  while (start.length < START_CHANGES) start.push(null);
  start.forEach(function (c) { addChange(c, false); });
  if (/[?&]image\b/.test(location.search)) addImage(false); // a link straight to "swap a picture"
})();
