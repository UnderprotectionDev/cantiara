# 01 — Eşleme ve fark önizlemesi (yazmasız)

**What to build:** Kurucu tekil Markdown, Cantiara sürümlü Belge JSON veya kapalı katalogdan tek tür/tek kapsam CSV/JSON dosyasını yükler. Hedef kapsam, oluşturulacak/güncellenecek kayıtlar, alan eşlemesi, kayıp ve çakışmalar ana kayıt yazılmadan gösterilir. Staging en fazla 24 saat, şifreli, birincil kaydı değiştirmez. Klasör, ZIP, çok dosyalı Markdown ve bütün Çalışma Alanı import'u yoktur. `Apply Import` 02'dedir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Desteklenen tek dosya türleri kabul edilir; 10.000 satır/25 MB aşımı ve desteklenmeyen paket (ZIP/klasör/workspace) yazmadan reddedilir.
- [ ] Azami boyuttaki dosya şifreli sunucu staging'inde en fazla 24 saat tutulur; staging birincil ana kaydı değiştirmez ve harici dosyayla canlı bağlantı kurmaz.
- [ ] Önizleme hedef kapsam, eşleme, kayıp, çatışma ve geçersiz satırları gösterir; birincil ana kayıt, ilişki ve arama indeksi değişmez.
- [ ] Katalog dışı aile (Dış yüzey, otomasyon, GitHub gerçeği, Teknik Diyagram editable JSON, test-report zarfı-as-Work) bu önizlemede oluşturma adayı olmaz; test-report 54'e yön veya reddedilir, Belge/İş yazılmaz.
- [ ] Kararlı köken anahtarı varsa sağlayıcı/dosya kapsamıyla gösterilir; ürün kimliği diriltme yetkisi olarak sunulmaz. Köken yoksa tahminî eşleme onaysız yapılmaz.
- [ ] Tablo yapıştırma ve listeden İş oluşturma bu yazmasız önizleme sözleşmesini kullanır; ikinci kısmi-yazma yolu yoktur.
- [ ] İngilizce UI `Import` kullanır. Kabul kanıtı Standard Import seam'inde yazmasız önizleme, limit, yasak aile. Erişilebilirlik yolculuğu **import önizleme ve commit** bu yüzeyden başlar.
