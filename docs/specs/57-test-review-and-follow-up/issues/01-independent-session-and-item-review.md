# 01 — Oturum ve madde incelemesinin bağımsız yaşamı

**What to build:** Yeni Test Oturumu `Unreviewed` başlar. Kurucu oturumu `Reviewed`, `Follow-up needed` veya `Closed` yapınca alt Oturum Testi inceleme durumları değişmez; tekil maddeyi kapatmak üst oturumu kapatmaz. İnceleme bildirilen ham veya normalize sonucu değiştirmez; yayın kapısı veya Proje Sürümü sonucu değildir. `Mark session and selected results as reviewed` değişecek kesin kayıtları önizler ve tek denetlenebilir mutasyonda uygular. Kalan `Unreviewed` veya `Follow-up needed` maddeler varken oturum gerekçeyle kapatılabilir; kapı yoktur. Handoff durumu bu incelemeden etkilenmez. Tekil Oturum Testi arşiv/Çöp yaşantısı kazanmaz; yanlış madde Düzeltme/Geri çekmedir.

**Blocked by:** None — can start immediately. Fixture Test Oturumu / Oturum Testi kayıtları Test Review seam'inde kabul edilmiş gibi verilir; rapor zarfı 54'te kalır.

**Status:** ready-for-agent

- [ ] Test Oturumu ve her Oturum Testi ayrı `Unreviewed` / `Reviewed` / `Follow-up needed` / `Closed` durumları taşır; biri diğerini örtük bitirmez.
- [ ] İnceleme komutu bildirilen ham ve normalize sonucu yazmaz; yeni test koşusu, yayın kapısı veya Proje Sürümü sonucu değildir.
- [ ] Toplu `Mark session and selected results as reviewed` önizleme olmadan yazmaz; onay tek atomik ve idempotent mutasyondur.
- [ ] Tekil Oturum Testi bu yüzeyden bağımsız arşivlenmez veya Çöp'e alınmaz; 77 oturum+maddeleri tek tarihsel birim uygular.
- [ ] Kalan açık maddelerle oturum kapatılabilir; kalan kesin kayıtlar ve isteğe bağlı gerekçe korunur.
- [ ] Handoff `Result received` önerisi inceleme veya Handoff kapanışı üretmez.
- [ ] İngilizce etiketler kullanılır; eksikler PRD terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Test Review seam'inde: bağımsız durum matrisi, sonuçun değişmemesi, toplu önizleme, kapı yokluğu. Erişilebilirlik yolculuğu **test raporu inceleme** bu yüzeyden yürür.
