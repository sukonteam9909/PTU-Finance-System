// Service Worker ขั้นต่ำที่ทำให้ติดตั้งเป็นแอปได้ — ไม่แคชข้อมูลเอกสารและไม่แคช API
const CACHE = "ptu-v2";
const SHELL = ["./", "./index.html", "./docs.html", "./manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      // แคชทีละไฟล์ ถ้าไฟล์ใดหาย (เช่น ยังไม่ได้อัปโหลดรูป) จะข้ามไป ไม่ทำให้ติดตั้งล้มทั้งชุด
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.hostname.endsWith("script.google.com")) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (u.origin === location.origin && r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
