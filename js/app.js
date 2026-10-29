/* תיקון בעלון - שבת אחים.
   The request goes to a Google Form (no-cors POST). Roni's task reads it every 5 minutes, fixes a copy of the
   leaflet, and asks Avraham to approve before anything reaches the school (Tools/leaflet_fix in רוני המתכנת). */
(function () {
  "use strict";

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
  var list = $("changes"), tpl = $("changeTpl"), form = $("fixForm");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var uid = 0;

  function load() { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { return {}; } }
  function save(obj) { try { localStorage.setItem(STORE, JSON.stringify(obj)); } catch (e) { /* private mode: fine */ } }

  function ordinal(n) {
    var words = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שביעי", "שמיני", "תשיעי", "עשירי"];
    return n <= words.length ? "שינוי " + words[n - 1] : "שינוי " + n;
  }

  function renumber() {
    var items = list.children;
    for (var i = 0; i < items.length; i++) {
      var li = items[i], n = i + 1;
      var title = li.querySelector(".change-title");
      title.textContent = ordinal(n);
      var rm = li.querySelector(".btn-remove");
      rm.hidden = i === 0; // the first change is always there
      rm.setAttribute("aria-label", "הסרה: " + ordinal(n)); // starts with the visible label (WCAG 2.5.3)
    }
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
    node.querySelector(".btn-remove").addEventListener("click", function () { removeChange(node); });
    if (focus && !reduceMotion) node.classList.add("is-new");
    node.addEventListener("animationend", function () { node.classList.remove("is-new"); });
    list.appendChild(node);
    renumber();
    if (focus) {
      areas[0].focus();
      $("announce").textContent = "נוסף " + ordinal(list.children.length);
    }
  }

  function removeChange(node) {
    var idx = Array.prototype.indexOf.call(list.children, node);
    var finish = function () {
      node.remove();
      renumber();
      var items = list.children, next = items[Math.min(idx, items.length - 1)];
      if (next) next.querySelector("textarea").focus();
      $("announce").textContent = "השינוי הוסר";
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

    var filled = 0, changeErr = false;
    readChanges().forEach(function (c) {
      var a = c.li.querySelectorAll("textarea"), err = c.li.querySelector(".change-error"), msg = "", bad = [];
      if (c.old && !c["new"]) { msg = "חסר מה לכתוב במקום"; bad = [a[1]]; }
      else if (!c.old && c["new"]) { msg = "חסר מה כתוב עכשיו בעלון"; bad = [a[0]]; }
      else if (c.old && c.old === c["new"]) { msg = "הטקסט החדש זהה למה שכתוב עכשיו"; bad = [a[1]]; }
      setError([a[0], a[1]], err);
      if (msg) { setError(bad, err, msg); mark(bad[0]); changeErr = true; }
      else if (c.old) filled++;
    });
    if (!filled && !changeErr) {
      var li = list.children[0], a0 = li.querySelectorAll("textarea");
      setError([a0[0], a0[1]], li.querySelector(".change-error"), "כתבו לפחות שינוי אחד: מה כתוב עכשיו ומה לכתוב במקום");
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
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    $("formError").hidden = true;
    var bad = validate();
    if (bad) { bad.focus(); return; }

    var changes = readChanges().filter(function (c) { return c.old && c["new"]; })
      .map(function (c) { return { old: c.old, "new": c["new"] }; });
    var fd = new FormData();
    fd.append(FORM.school, $("f_school").value.trim());
    changes.slice(0, 3).forEach(function (c, i) { fd.append(FORM.old[i], c.old); fd.append(FORM.neu[i], c["new"]); });
    fd.append(FORM.changesJson, JSON.stringify(changes));
    fd.append(FORM.phone, $("f_phone").value.trim());
    fd.append(FORM.name, $("f_name").value.trim());

    setBusy(true);
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    fetch(FORM.action, { method: "POST", mode: "no-cors", body: fd, signal: ctrl ? ctrl.signal : undefined })
      .then(function () { clearTimeout(timer); onSent(changes); })
      .catch(function () {
        clearTimeout(timer);
        setBusy(false);
        var fe = $("formError");
        fe.textContent = "השליחה לא הצליחה. מה שכתבתם נשמר כאן. נסו שוב בעוד רגע, או כתבו לנו ל-abrahamgersten@gmail.com.";
        fe.hidden = false;
      });
  });

  function onSent(changes) {
    var s = load();
    save({ school: s.school, phone: s.phone, name: s.name, changes: [] }); // keep who you are, drop what was sent
    var num = document.createElement("bdi"); // keeps the final period on the Hebrew side of an LTR phone number
    num.textContent = $("f_phone").value.trim();
    $("doneText").replaceChildren("נמצא את המקום בעלון, נתקן, ונשלח את העלון המתוקן לבדיקה בוואטסאפ למספר ", num, ".");
    var dl = $("doneList");
    dl.textContent = "";
    changes.forEach(function (c) {
      var li = document.createElement("li");
      var arrow = tpl.content.querySelector(".change-arrow").cloneNode(true); // the same library icon as in the form
      arrow.setAttribute("class", "icon arrow");
      li.append(span("was", c.old), " ", arrow, span("sr-only", "במקום "), " ", span("now", c["new"]));
      dl.appendChild(li);
    });
    form.hidden = true;
    $("done").hidden = false;
    $("done").focus();
    setBusy(false);
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
    for (var i = 0; i < START_CHANGES; i++) addChange(null, false);
    $("done").hidden = true;
    form.hidden = false;
    list.querySelector("textarea").focus();
  });

  /* ---------- start ---------- */
  $("addChange").addEventListener("click", function () { addChange(null, true); persist(); });
  form.addEventListener("input", persist);

  var saved = load();
  ["school", "phone", "name"].forEach(function (k) { if (saved[k]) $("f_" + k).value = saved[k]; });
  var start = (saved.changes || []).filter(function (c) { return c.old || c["new"]; });
  while (start.length < START_CHANGES) start.push(null);
  start.forEach(function (c) { addChange(c, false); });
})();
