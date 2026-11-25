/* ตัวกลางคุยกับ Google Apps Script — ใช้ร่วมกันทุกหน้า
   หน้าเว็บอยู่บน GitHub Pages ตลอด ไม่เด้งออกไป script.google.com */
var API = "https://script.google.com/macros/s/AKfycbxVD47cLabkuZlfe2T8d31S-Cfo8j84f1eBBVYE61NaCPPn97bfvMx2ZOG9tn7QmLOdkg/exec";

var $ = function (id) { return document.getElementById(id); };

function api(action, payload) {
  return fetch(API, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: action, payload: payload || {} })
  })
  .then(function (r) { return r.json(); })
  .catch(function () { return { success: false, message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่" }; });
}

function say(text, ok) {
  var m = $("msg");
  if (!m) return;
  m.innerHTML = text;
  m.className = "msg " + (ok ? "ok" : "err");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearSay() {
  var m = $("msg");
  if (m) m.className = "msg";
}

function busy(btn, on, label) {
  if (!btn) return;
  btn.disabled = on;
  if (on) {
    btn.dataset.label = btn.innerHTML;
    btn.innerHTML = '<span class="spin"></span> ' + (label || "กำลังดำเนินการ…");
  } else if (btn.dataset.label) {
    btn.innerHTML = btn.dataset.label;
  }
}

function baht(n) {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ย่อรูปสลิปก่อนส่ง — ลดขนาดไฟล์และตัด EXIF ออกไปด้วยการวาดใหม่ลง canvas */
function readImage(file, maxSide, quality) {
  return new Promise(function (resolve, reject) {
    if (!file) return reject(new Error("ไม่พบไฟล์"));
    if (!/^image\//.test(file.type)) return reject(new Error("รับเฉพาะไฟล์ภาพ"));
    if (file.size > 15 * 1024 * 1024) return reject(new Error("ไฟล์ใหญ่เกิน 15 MB"));

    var fr = new FileReader();
    fr.onerror = function () { reject(new Error("อ่านไฟล์ไม่สำเร็จ")); };
    fr.onload = function () {
      var img = new Image();
      img.onerror = function () { reject(new Error("ไฟล์ภาพเสียหาย")); };
      img.onload = function () {
        var m = maxSide || 1600;
        var sc = Math.min(1, m / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * sc);
        c.height = Math.round(img.height * sc);
        var x = c.getContext("2d");
        x.fillStyle = "#fff";
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality || 0.82));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

function statusChip(s) {
  var t = String(s || "").trim();
  if (t === "อนุมัติแล้ว") return '<span class="chip g">' + t + "</span>";
  if (t === "ปฏิเสธ") return '<span class="chip r">' + t + "</span>";
  if (t === "หลักฐานไม่ชัดเจน") return '<span class="chip r">' + t + "</span>";
  return '<span class="chip w">' + (t || "รอตรวจสอบ") + "</span>";
}

function esc(s) {
  return String(s === undefined || s === null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
