# 02 — Kabul ve gerçekleşme izolasyonu ile open-risk

**What to build:** Kabul, gerçekleşme veya çözüm ilişkili İş’i kapatmaz, Proje Sürümünü başarısız ilan etmez, Projeyi yazmaz. `open-risk` yalnız Risk `Open` olunca veya `Open` Risk yayın hazırlığındaki Proje Sürümüne ya da etkin Odak Dönemine bağlanınca üretilir. Merkez UI’si 71’dedir.

**Blocked by:** 01 — Risk kaydı, etki ve durum

**Status:** ready-for-agent

- [ ] `Accepted`, `Occurred`, `Resolved` bağlı İş, Proje Sürümü ve Proje yaşamını/kapanışını yazmaz. Kabul yayın kapısı değildir.
- [ ] `open-risk` yalnız iki olaydadır. Salt zaman, `Mitigating`, yüksek etki/olasılık veya yalnız Projede bulunmak sinyal değildir.
- [ ] Sinyal kaynak olay, etki ve olasılık taşır; takip İşi veya sağlık hükmü üretmez. Sunum 71’dedir.
- [ ] Kabul kanıtı aynı seam’de: yazmama karşıtları, iki pozitif sinyal, negatif sinyal matrisi.
