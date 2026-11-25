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
          var e = new Error((res && res.error) || "\u0e40\u0e0b\u0e34\u0e23\u0e4c\u0e1f\u0e40\u0e27\u0e2d\u0e23\u0e4c\u0e15\u0e2d\u0e1a\u0e01\u0e25\u0e31\u0e1a\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14");
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
