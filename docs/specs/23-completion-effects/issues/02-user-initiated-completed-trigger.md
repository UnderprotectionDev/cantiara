# 02 — Kullanıcı başlatmalı Tamamlandı tetikleyicisi

**What to build:** Efekt yalnız görünür istemcide başlatılan kapatmanın sunucuda kalıcı `Completed` kabulünden sonra bir kez oynar. Kapatma adımı, iyimser UI, red, çatışma, süre aşımı, geri alma, idempotent retry, yenileme, ikinci sekme veya arka plan senkronu replay üretmez. `Abandoned`, otomasyon, PR merge, checklist ve diğer terminal olaylar tetiklemez. Yeniden açılıp tekrar tamamlanan İş yeni olaydır; sunucu oynatma kaydı tutmaz.

**Blocked by:** 01 — Hesap tema ve palet seçimi

**Status:** ready-for-agent

- [ ] Tetikleyici [Kullanıcı başlatmalı İş başarısı](../../../prd/06-work-management-and-planning.md#bitiris-efektleri) tanımıyla birebir aynıdır.
- [ ] Sunucu `Completed` kabul etmeden efekt başlamaz; başarısız yazma kutlama üretmez.
- [ ] Aynı idempotent istek, yenileme, geri, ikinci sekme/cihaz ve arka plan senkronu efekti yeniden oynatmaz.
- [ ] Aynı İşi yeniden açıp tekrar `Completed` yapmak yeni uygun olaydır; geçmiş kapanışlar yeniden oynatılmaz.
- [ ] Hariç olay matrisi: `Abandoned`, kontrol listesi, PR merge, hazır PR-merge kuralı, dış yürütme uzlaştırması, Odak/Dönem/Kilometre Taşı/Proje/Sürüm kapanışı.
- [ ] Genel `başarı olayı → efekt` motoru yoktur.
- [ ] Efekt açıkken gelen sonraki uygun başarılar, tam efekt başladıktan sonra 30 sn istemci beklemesinde yalnız temel bildirimi alır; bekleme sunucuya yazılmaz.
- [ ] Kabul kanıtı Completion Effects seam'inde tetik/hariç matrisi, idempotency/çoklu sekme ve 30 sn bekleme. Kanıt [Bitiriş efekti](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğudur.
