/* โหลดธีมกลางให้หน้านี้ใช้สีชุดเดียวกับ index.html โดยไม่ต้องแก้ app.html */
(function () {
  var l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "theme.css";
  document.head.appendChild(l);
})();

/* gsrun.js - bridge replacing google.script.run
   lets app.html run on GitHub Pages without changing the app code */
(function () {
  var API = "https://script.google.com/macros/s/AKfycbxVD47cLabkuZlfe2T8d31S-Cfo8j84f1eBBVYE61NaCPPn97bfvMx2ZOG9tn7QmLOdkg/exec";
  var FNS = ["getFeeConfigList","saveFeeConfigItem","deleteFeeConfigItem","addNewStudentToMaster","findStudentFullInfo","findStudentByName","linkStudentId","submitPaymentSlip","getStudentPaymentHistory","studentCheckBalanceFast","getPendingPaymentLogs","approvePaymentLog","rejectPaymentLog","markPaymentUnclear","resubmitPaymentLog","adminLogin","changeAdminPassword","getBatchList","saveBatchList","getAllStudentsDirectory","getSystemInfo"];
  function make(ok, err) {
    var o = {
      withSuccessHandler: function (f) { return make(f, err); },
      withFailureHandler: function (f) { return make(ok, f); },
      withUserObject:     function ()  { return make(ok, err); }
    };
    FNS.forEach(function (name) {
      o[name] = function () {
        var args = Array.prototype.slice.call(arguments);
        fetch(API, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "gsrun", payload: { fn: name, args: args } })
        })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok) { if (ok) { ok(res.value); } return; }
          var e = new Error((res && res.error) || "เซิร์ฟเวอร์ตอบกลับผิดพลาด");
          if (err) { err(e); } else { console.error(name, e); }
        })
        .catch(function (e) { if (err) { err(e); } else { console.error(name, e); } });
      };
    });
    return o;
  }
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = make(null, null);
  window.google.script.host = { close: function () {}, setHeight: function () {}, origin: location.origin, editor: { focus: function () {} } };
})();

/* ====== คลิกโลโก้หรือชื่อระบบ แล้วกลับหน้าหลัก index.html ====== */
document.addEventListener("DOMContentLoaded", function () {
  var nav = document.querySelector("nav");
  if (!nav) return;
  var logo = nav.querySelector("img");
  var brand = logo ? logo.parentElement : nav.firstElementChild;
  if (!brand) return;
  brand.style.cursor = "pointer";
  brand.title = "กลับหน้าหลัก";
  brand.addEventListener("click", function () {
    location.href = "index.html";
  });
});

/* ====== เปิดตรงขั้นที่ต้องการด้วย ?step=reg|link|pay|balance|admin ======
   ปุ่มในหน้าแรกชี้มาที่ไฟล์เด้ง ซึ่งแนบค่า step มาให้แล้ว
   สคริปต์ของแอปโหลดทีหลัง จึงต้องรอจน switchTab พร้อมก่อนจึงสั่งสลับ
   และต้องยกเลิกทันทีที่ผู้ใช้แตะอะไรก็ตาม ไม่งั้นจะไปสลับทับสิ่งที่ผู้ใช้เพิ่งกด
   (เช่น กด Admin แล้วโดนเด้งกลับไปหน้าส่งสลิป) */
document.addEventListener("DOMContentLoaded", function () {
  var step = new URLSearchParams(location.search).get("step");
  var allow = { reg: 1, link: 1, pay: 1, balance: 1, admin: 1 };
  if (!step || !allow[step]) return;

  var cancelled = false;
  var timer = null;

  function stop() {
    cancelled = true;
    if (timer) { clearInterval(timer); timer = null; }
    document.removeEventListener("pointerdown", stop, true);
    document.removeEventListener("keydown", stop, true);
  }

  // ผู้ใช้แตะหรือกดคีย์เมื่อไหร่ ถือว่าเขาเลือกเองแล้ว เลิกสลับอัตโนมัติ
  document.addEventListener("pointerdown", stop, true);
  document.addEventListener("keydown", stop, true);

  var tries = 0;
  timer = setInterval(function () {
    if (cancelled) return;
    if (typeof switchTab === "function") {
      stop();
      switchTab(step);
    } else if (++tries > 60) {
      stop();
    }
  }, 30);
});
