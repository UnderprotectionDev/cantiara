# 01 — test-report/1 ve üç giriş tek model

**What to build:** Manuel form, yapılandırılmış Markdown/JSON dosyası ve dar MCP aynı Test Oturumu ve Oturum Testi modeline yazar. Kaynağa özel paralel kayıt türü veya kuyruk yoktur. Yürüten, raporlayan ve giriş yolu ayrı tutulur; giriş yolu güven veya önem puanı üretmez. İlk sözleşme `test-report/1`'dir; desteklenmeyen `schema_version` sessizce yükseltilmez (`schema_unsupported`). Manuel form kaydedilene kadar oturum üretmez ve güncel sözleşmeyi kendisi yazar. Boş `tests` oturum açmaz. Bildirilen sonuç Ürün kabul kanıtı veya yayın kapısı değildir; kabul inceleme değildir.

**Blocked by:** None — can start immediately. Handoff ids can be a test double.

**Status:** ready-for-agent

- [ ] Üç giriş aynı oturum/madde modeline yazar; paralel tür yoktur.
- [ ] Desteklenmeyen sürüm hiçbir kayıt bırakmadan reddedilir; sessiz yükseltme yoktur.
- [ ] Yürüten, raporlayan ve giriş yolu ayrı tutulur; giriş yolu güven veya önem puanı üretmez.
- [ ] Bildirilen `Passed` Ürün kabul kanıtı değildir; kabul inceleme UI'si veya yayın kapısı açmaz.
- [ ] İngilizce UI `Test Session`, `Session Test` kullanır; eksik etiketler PRD sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Test Report Acceptance seam'inde: üç giriş, şema reddi. Kanıt [Test kabulü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) contract paketidir.
