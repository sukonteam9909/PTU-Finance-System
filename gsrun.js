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

/* ====== เปิดตรงขั้นที่ต้องการด้วย ?step=reg|link|pay|balance ======
   ปุ่มในหน้าแรกชี้มาที่ไฟล์เด้ง ซึ่งแนบค่า step มาให้แล้ว
   รอจน switchTab พร้อมใช้งานก่อนจึงสั่งสลับ เพราะสคริปต์ของแอปโหลดทีหลัง */
document.addEventListener("DOMContentLoaded", function () {
  var step = new URLSearchParams(location.search).get("step");
  var allow = { reg: 1, link: 1, pay: 1, balance: 1 };
  if (!step || !allow[step]) return;
  var tries = 0;
  var timer = setInterval(function () {
    if (typeof switchTab === "function") {
      clearInterval(timer);
      switchTab(step);
    } else if (++tries > 40) {
      clearInterval(timer);
    }
  }, 50);
});
