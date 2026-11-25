/** ระบบเอกสารหลักฐานการสมัครเรียน — โมดูลแยก ไม่แตะโค้ดเดิม
 *  Deploy: Web app / Execute as me / Who has access: Anyone
 *  Script Properties ที่ต้องตั้ง (ถ้าใช้ LINE): LINE_TOKEN, LINE_TO
 */
// ใช้ SPREADSHEET_ID จาก Code.gs ของระบบเดิมโดยตรง — ย้ายชีทเมื่อไหร่ แก้ที่เดียวที่ Code.gs
// (ไฟล์ทุกไฟล์ในโปรเจกต์ Apps Script เดียวกันใช้ตัวแปร global ร่วมกัน)
const D_SHEET = "StudentDocs";
const D_HEAD = ["รหัสเอกสาร","รหัสนักศึกษา","ชื่อ-สกุล","ประเภทเอกสาร","ผู้อัปโหลด","ความสัมพันธ์",
  "ชื่อไฟล์","FileID","ขนาด(KB)","SHA256","วันที่อัปโหลด","สถานะ","หมายเหตุ"];
const L_SHEET = "Audit_Log";
const DOC_TYPES = ["สำเนาบัตรประชาชน","สำเนาทะเบียนบ้าน","ใบแสดงผลการเรียน (ปพ.1)","ใบประกาศ/วุฒิการศึกษา (ปพ.2)",
  "รูปถ่ายหน้าตรง","สำเนาบัตรผู้ปกครอง","ใบเปลี่ยนชื่อ-สกุล","สด.8 / สด.43","หลักฐานเทียบโอน","อื่นๆ"];

function doPost(e){
  var r;
  try{ r = route(JSON.parse(e.postData.contents)); }
  catch(err){ r = {ok:false, msg:String(err)}; }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

function route(b){
  var a = b.action, p = b.payload || {};
  if(a==="config")   return {ok:true, types:DOC_TYPES};
  if(a==="login")    return login(p);
  if(a==="list")     return listDocs(p);
  if(a==="upload")   return upload(p);
  if(a==="img")      return img(p);
  if(a==="aLogin")   return aLogin(p);
  if(a==="aList")    return aList(p);
  if(a==="aSave")    return aSave(p);
  if(a==="gsrun")    return gsrun(p);   // ให้ app.html บน GitHub เรียกฟังก์ชันเดิมของระบบสลิปได้
  return {ok:false, msg:"unknown action"};
}

/* ---------- gsrun: สะพานจาก app.html (GitHub) ไปฟังก์ชันเดิมใน Code.gs — เรียกได้เฉพาะชื่อในรายการ ---------- */
var GSRUN_FNS = ["getFeeConfigList","saveFeeConfigItem","deleteFeeConfigItem","addNewStudentToMaster","findStudentFullInfo","findStudentByName","linkStudentId","submitPaymentSlip","getStudentPaymentHistory","studentCheckBalanceFast","getPendingPaymentLogs","approvePaymentLog","rejectPaymentLog","markPaymentUnclear","resubmitPaymentLog","adminLogin","changeAdminPassword","getBatchList","saveBatchList","getAllStudentsDirectory","getSystemInfo"];
function gsrun(p){
  var fn = String(p.fn||"");
  if(GSRUN_FNS.indexOf(fn) < 0 || typeof globalThis[fn] !== "function") return {ok:false, error:"ไม่อนุญาตให้เรียก " + fn};
  try{ return {ok:true, value:globalThis[fn].apply(null, p.args||[])}; }
  catch(err){ return {ok:false, error:String(err && err.message || err)}; }
}

/* ---------- helpers ---------- */
function ss(){ return SpreadsheetApp.openById(SPREADSHEET_ID); }
function sh(name, head){
  var s = ss().getSheetByName(name);
  if(!s){ s = ss().insertSheet(name); s.appendRow(head); s.setFrozenRows(1);
    s.getRange(1,1,1,head.length).setFontWeight("bold").setBackground("#0F2A5C").setFontColor("#fff"); }
  return s;
}
function docSheet(){ return sh(D_SHEET, D_HEAD); }
function norm(s){ return String(s||"").normalize("NFC").trim().replace(/\s+/g," ").toLowerCase(); }
function cache(){ return CacheService.getScriptCache(); }

function limit(key, max, sec){
  var k = "RL_"+key, n = Number(cache().get(k)||0);
  if(n >= max) return false;
  cache().put(k, n+1, sec); return true;
}
function newToken(data){
  var t = Utilities.getUuid();
  cache().put("TK_"+t, JSON.stringify(data), 7200);
  return t;
}
function auth(token, role){
  var raw = cache().get("TK_"+token);
  if(!raw) return null;
  var d = JSON.parse(raw);
  return (role && d.role!==role) ? null : d;
}
function log(action, who, target){
  sh(L_SHEET,["วันที่","การกระทำ","ผู้ทำ","เป้าหมาย"]).appendRow([new Date().toLocaleString("th-TH"),action,who,target]);
}
function line(text){
  var pr = PropertiesService.getScriptProperties(),
      tk = pr.getProperty("LINE_TOKEN"), to = pr.getProperty("LINE_TO");
  if(!tk || !to) return;
  try{
    UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push",{
      method:"post", contentType:"application/json", muteHttpExceptions:true,
      headers:{Authorization:"Bearer "+tk},
      payload: JSON.stringify({to:to, messages:[{type:"text", text:text}]})
    });
  }catch(e){}
}

/* ---------- ยืนยันตัวตน (อ่าน PTU_Records แบบ read-only) ---------- */
function findStudent(sid, name, tel4){
  var s = ss().getSheetByName("PTU_Records");
  if(!s) return null;
  var d = s.getDataRange().getValues(), h = d[0], c = {};
  h.forEach(function(x,i){ c[String(x).trim()] = i; });
  for(var i=1;i<d.length;i++){
    if(String(d[i][c["ประเภทแถว"]]).trim()!=="STUDENT") continue;
    var rid = String(d[i][c["รหัสนักศึกษา"]]).trim(),
        rnm = norm(d[i][c["ชื่อ-สกุล"]]),
        tel = String(d[i][c["เบอร์โทร"]]).replace(/\D/g,"");
    var idOk = sid && rid.toLowerCase()===String(sid).trim().toLowerCase();
    var nmOk = rnm && rnm===norm(name);
    if((idOk||nmOk) && tel.slice(-4)===String(tel4).trim()){
      return {sid:rid, name:String(d[i][c["ชื่อ-สกุล"]]).trim(),
              fac:d[i][c["คณะ"]], major:d[i][c["สาขา"]]};
    }
  }
  return null;
}

function login(p){
  var key = norm(p.name)+"|"+p.tel4;
  if(!limit("L"+key,5,900)) return {ok:false, msg:"กรอกข้อมูลไม่ตรงหลายครั้ง กรุณารอ 15 นาที"};
  var st = findStudent(p.sid, p.name, p.tel4);
  if(!st) return {ok:false, msg:"ข้อมูลไม่ตรงกับที่ลงทะเบียนไว้ ตรวจสอบชื่อ-นามสกุลและเบอร์โทร 4 ตัวท้าย"};
  var uploader = p.byGuardian ? String(p.gName||"").trim() : st.name;
  var rel = p.byGuardian ? String(p.gRel||"ผู้ปกครอง").trim() : "ตนเอง";
  if(p.byGuardian && !uploader) return {ok:false, msg:"กรุณากรอกชื่อผู้ปกครอง"};
  return {ok:true, token:newToken({role:"stu", sid:st.sid, name:st.name, uploader:uploader, rel:rel}),
          student:st, uploader:uploader, rel:rel};
}

/* ---------- เอกสาร ---------- */
function folder(sid){
  var pr = PropertiesService.getScriptProperties(), rootId = pr.getProperty("DOC_ROOT_ID"), root;
  try{ root = DriveApp.getFolderById(rootId); }
  catch(e){ root = DriveApp.createFolder("PTU_Student_Docs"); pr.setProperty("DOC_ROOT_ID", root.getId()); }
  var it = root.getFoldersByName(sid);
  return it.hasNext() ? it.next() : root.createFolder(sid);
}

/** ค้นเอกสารด้วย "รหัสนักศึกษา หรือ ชื่อ-นามสกุล"
 *  เหตุผล: นักศึกษาใหม่อัปโหลดตอนยังเป็นรหัสชั่วคราว PENDING-xxxx พอได้รหัสจริงแล้ว
 *  ระบบเดิมแก้รหัสให้เฉพาะแถว STUDENT และ PAYMENT ในชีท PTU_Records เท่านั้น
 *  แถวเอกสารจึงยังค้างรหัสเก่า — เทียบชื่อควบคู่ไปด้วยจึงยังหาเจอ โดยไม่ต้องเขียนทับอะไรเลย */
function rows(sid, name){
  var s = docSheet(), d = s.getDataRange().getValues(), out = [], n = norm(name);
  for(var i=1;i<d.length;i++){
    var sameId = String(d[i][1]).trim() === String(sid).trim();
    var sameName = n && norm(d[i][2]) === n;
    if(!sameId && !sameName) continue;
    out.push({row:i+1, id:d[i][0], type:d[i][3], uploader:d[i][4], rel:d[i][5],
              file:d[i][6], fid:d[i][7], kb:d[i][8], at:d[i][10], status:d[i][11], note:d[i][12]});
  }
  return out;
}

function listDocs(p){
  var u = auth(p.token,"stu");
  if(!u) return {ok:false, msg:"เซสชันหมดอายุ กรุณาเข้าระบบใหม่"};
  return {ok:true, docs:rows(u.sid, u.name), types:DOC_TYPES};
}

function upload(p){
  var u = auth(p.token,"stu");
  if(!u) return {ok:false, msg:"เซสชันหมดอายุ กรุณาเข้าระบบใหม่"};
  if(!limit("U"+u.sid,10,600)) return {ok:false, msg:"อัปโหลดถี่เกินไป กรุณารอ 10 นาที"};
  var m = String(p.data||"").match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if(!m) return {ok:false, msg:"รับเฉพาะไฟล์ภาพ JPG / PNG / WebP"};
  var bytes = Utilities.base64Decode(m[2]);
  if(bytes.length > 5*1024*1024) return {ok:false, msg:"ไฟล์ใหญ่เกิน 5 MB"};

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try{
    var id = "DOC-" + Utilities.getUuid().split("-")[0].toUpperCase();
    var ext = m[1].split("/")[1].replace("jpeg","jpg");
    var name = u.sid + "_" + String(p.type).replace(/[\/\\\s]+/g,"_") + "_" + id + "." + ext;
    var blob = Utilities.newBlob(bytes, m[1], name);
    var file = folder(u.sid).createFile(blob);   // ไม่ setSharing — โฟลเดอร์ปิด
    var hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes));
    docSheet().appendRow([id, u.sid, u.name, p.type, u.uploader, u.rel, name, file.getId(),
      Math.round(bytes.length/1024), hash, new Date().toLocaleString("th-TH"), "ส่งแล้ว", ""]);
    log("UPLOAD", u.uploader+" ("+u.rel+")", u.sid+" / "+p.type);
    line("📄 เอกสารใหม่\n"+u.name+" ("+u.sid+")\nรายการ: "+p.type+"\nผู้ส่ง: "+u.uploader+" ("+u.rel+")");
    return {ok:true, msg:"ส่งเอกสารเรียบร้อยแล้ว", docs:rows(u.sid, u.name)};
  } finally { lock.releaseLock(); }
}

function img(p){
  var u = auth(p.token);
  if(!u) return {ok:false, msg:"เซสชันหมดอายุ"};
  var s = docSheet(), d = s.getDataRange().getValues();
  for(var i=1;i<d.length;i++){
    if(String(d[i][0])!==String(p.id)) continue;
    if(u.role==="stu" && String(d[i][1]).trim()!==String(u.sid).trim() && norm(d[i][2])!==norm(u.name))
      return {ok:false, msg:"ไม่มีสิทธิ์เปิดเอกสารนี้"};
    var f = DriveApp.getFileById(d[i][7]);
    if(u.role==="admin") log("VIEW/DOWNLOAD", u.user, d[i][1]+" / "+d[i][3]);
    return {ok:true, name:d[i][6],
            data:"data:"+f.getBlob().getContentType()+";base64,"+Utilities.base64Encode(f.getBlob().getBytes())};
  }
  return {ok:false, msg:"ไม่พบเอกสาร"};
}

/* ---------- เจ้าหน้าที่ ---------- */
function aLogin(p){
  if(!limit("A"+norm(p.user),5,900)) return {ok:false, msg:"ลองเข้าระบบหลายครั้งเกินไป รอ 15 นาที"};
  var r = adminLogin(p.user, p.pass);          // ใช้ฟังก์ชันเดิม ไม่แก้ชีท Admin_Accounts
  if(!r || !r.success) return {ok:false, msg:(r&&r.message)||"เข้าระบบไม่สำเร็จ"};
  log("ADMIN_LOGIN", r.username, "");
  return {ok:true, token:newToken({role:"admin", user:r.username, name:r.displayName}), name:r.displayName};
}

function aList(p){
  if(!auth(p.token,"admin")) return {ok:false, msg:"เซสชันหมดอายุ"};
  var d = docSheet().getDataRange().getValues(), out = [];
  for(var i=1;i<d.length;i++) out.push({row:i+1, id:d[i][0], sid:d[i][1], name:d[i][2], type:d[i][3],
    uploader:d[i][4], rel:d[i][5], file:d[i][6], kb:d[i][8], at:d[i][10], status:d[i][11], note:d[i][12]});
  return {ok:true, docs:out, head:D_HEAD, types:DOC_TYPES};
}

/** แก้ไขช่องใดก็ได้ในทะเบียนเอกสาร (ยกเว้น FileID / SHA256 / รหัสเอกสาร) */
function aSave(p){
  var u = auth(p.token,"admin");
  if(!u) return {ok:false, msg:"เซสชันหมดอายุ"};
  var editable = {"รหัสนักศึกษา":1,"ชื่อ-สกุล":2,"ประเภทเอกสาร":3,"ผู้อัปโหลด":4,"ความสัมพันธ์":5,"สถานะ":11,"หมายเหตุ":12};
  var col = editable[p.field];
  if(col===undefined) return {ok:false, msg:"ช่องนี้แก้ไขไม่ได้"};
  docSheet().getRange(Number(p.row), col+1).setValue(p.value);
  log("EDIT", u.user, "row "+p.row+" / "+p.field+" = "+p.value);
  if(p.field==="สถานะ") line("✏️ อัปเดตสถานะเอกสาร\n"+p.value+"\nโดย "+u.name);
  return {ok:true, msg:"บันทึกแล้ว"};
}
