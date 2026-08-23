# 01 — Proje arşivi: salt okunur ve güvenlik istisnası

**What to build:** Kurucu Projeyi `Archive` görünümüne alır. Yaşam durumu (`Active`/`Pending`/`Completed`/`Abandoned`) değişmez. Proje salt okunur ve hareketsizdir: GitHub eşitlemesi, otomasyon, hatırlatma ve normal mutasyon durur. Daha önce açıkça onaylanmış Dış yüzeyler listelenir ve arşivde yaşamaya devam edebilir. Yalnız erişimi azaltan eylemler açık kalır (yüzey iptali, token/parola rotasyonu, oturum sonu, entegrasyon kesme/secret rotasyonu, güvenlik redaksiyonu). Yayın, içerik düzenleme, parola kaldırma ve erişim genişletme kapalıdır. Silme 02'dedir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Arşiv önizlemesi çalışma yüzeyinden kalkışı, devam eden işlerin kesin durumunu, yaşayabilecek onaylı Dış yüzeyleri ve açık kalacak güvenlik eylemlerini gösterir; ortak revizyon bariyeri kullanılır.
- [ ] Arşiv sonrası normal yazma, eşitleme, otomasyon ve hatırlatma fail-closed reddedilir; yaşam durumu alanı Arşivle yeniden yazılmaz.
- [ ] Arşiv görünümü Projeyi, yaşayan Dış yüzeyleri ve açık güvenlik eylemlerini kaynak durumlarıyla listeler.
- [ ] Arşiv güvenlik istisnası yalnız erişimi azaltan eylemleri geçirir; yayın/reaktivasyon/parola kaldırma/içerik düzenleme/erişim genişletme reddedilir.
- [ ] İngilizce UI `Archive` kullanır. `Delete Project` bu ticket'ta Arşiv görünümü dışında sunulmaz (sunum 02).
- [ ] Arşivden çıkış GitHub bağlantısını örtük etkinleştirmez; kanonik yeniden bağlama 61'e yönlendirilir.
- [ ] Kabul kanıtı Project Retirement seam'inde yazma durması, istisna allow-list, gizleme filtresi/Trash karışmama. [Proje silme ve dış yüzey](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) arşiv dilimi.
