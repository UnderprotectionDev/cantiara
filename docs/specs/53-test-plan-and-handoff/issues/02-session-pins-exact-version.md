# 02 — Oturum tam olarak seçilen senaryo sürümünü kilitler

**What to build:** Oturum Testi bağlandıysa tam olarak seçilen senaryo sürümünü tarihsel korur. Sonraki başlık, kapsam veya beklenen davranış değişikliği geçmiş sonucu yeni tanımı doğrulamış gibi göstermez. Yalnız editoryal değişiklik de geçmiş bağı sessizce taşımaz. Ad hoc Oturum Testi senaryosuz olabilir; sonradan bağlamak geçmiş içeriği yeniden yazmaz ve yeni sürümü uygulanmış saymaz.

**Blocked by:** 01 — Planlı Test Senaryosu sürümleri

**Status:** ready-for-agent

- [ ] Bağ kesin `scenario_id` + `scenario_version`'dır; sonraki düzenleme geçmiş sonucu taşımaz.
- [ ] Editoryal değişiklik de bağı sessizce yeni sürüme almaz.
- [ ] Ad hoc bağ geçmiş gövdeyi yeniden yazmaz.
- [ ] Kabul kanıtı aynı seam'de: v1 sonucu v2'yi doğrulamaz, sessiz taşıma karşıtı. Grill senaryo 7 karşılığıdır.
