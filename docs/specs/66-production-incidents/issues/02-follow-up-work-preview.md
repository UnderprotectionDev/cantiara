# 02 — Takip İşi yalnız önizlemeyle

**What to build:** Üretim Olayından takip İşi yalnız kurucunun açık eylemiyle oluşur. Önizleme oluşacak İş türünü, başlangıç alanlarını ve kurulacak kaynak ilişkilerini onaydan önce gösterir. Onaysız yazma yoktur. Takip İşi olayı otomatik `Resolved` yapmaz; olay kapanışı İş kapanışı değildir.

**Blocked by:** 01 — Üretim Olayı kaydı (pager/S1 değil)

**Status:** ready-for-agent

- [ ] `Create follow-up work` önizlemesiz commit reddedilir.
- [ ] Otomatik Bug/Risk/İş doğmaz.
- [ ] Köken olayı görünür kalır; silme ortak kırık referansı izler.
- [ ] Kabul kanıtı aynı seam'de: önizleme, red, onaylı oluşturma.
