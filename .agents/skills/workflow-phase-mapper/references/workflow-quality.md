# İş Akışı Kalite Kapısı

## Kaynak

- En az bir ürün ve bir teknik otorite var.
- Kaynak rolleri doğru; hedef proje `CONTEXT.md` yalnız terminoloji için kullanılmış.
- Repo kanıtı yeni kapsam üretmemiş.
- Her iç requirement'ın kaynak ankrajı ve tam bir sahibi var.

## Sınır

- Her ana faz Bağımsız Feature Kapısını geçiyor; zorunlu büyüklük veya alt-faz ağacı aranmıyor.
- Farklı feature kimliği, yolculuk veya kabul sonucu ortak CRUD/model/UI nedeniyle birleşmemiş.
- Her ana faz tek bütünlüklü değer ve sınır sonrası tek gizli `phaseKind` taşıyor.
- Kesen feature ayrı yolculuk, çoklu-feature kapsamı ve kendi başarı sonucunu taşıyor.
- Gözlenebilir sistem yeteneği yalnız teknik mekanizma değil, bağımsız kabul edilen sonuç taşıyor.
- Her alt faz ayrı amaç, ayrı sonuç, uçtan uca davranış ve ana feature'a katkı taşıyor.
- Endpoint, form, auth, hata veya recovery tek başına alt faz olmamış.
- Alt fazı olmayan feature korunmuş; dekoratif tek alt faz yok.

## Sıra

- Graph yalnız sınırlar kesinleştikten sonra kurulmuş.
- Her kenar gerçek sonuç tüketimi ve onsuz geçersizlikle kanıtlı.
- Yalnız doğrudan `allOf`/`anyOf` kenarları var; graph döngüsüz ve sıra topolojik.
- Graph sahiplik, birleşme veya görünür teknik bölüm üretmemiş.

## Önizleme

- Maddi çözümsüz kararlar HTML'den önce konuşmada çözülmüş.
- Hedef projedeki tek inceleme çıktısı `docs/workflow/index.html`.
- Kartlar yalnız sıra/ad, kısa değer-kapsam özeti ve alt faz ad/sonuçlarını gösteriyor.
- Ana/alt faz kimliği, sırası, adı ve sonucu doğrulanabilir metadata'da.
- Kaynak chip'leri, graph, requirement, `phaseKind`, onay/feedback kontrolü veya kalıcı state görünmüyor.

## Final

- Kullanıcı konuşmada gösterilen güncel preview revizyonuna açık onay vermiş.
- Final staging onaydan sonra hazırlanmış ve publisher aynı onaylı revizyonu doğrulamış.
- Kaynaklar önizlemeden beri değişmemiş.
- Görünür Markdown temiz doğal anlatı sözleşmesini kullanıyor.
- Gerçek alt faz yoksa Alt Fazlar bölümü bulunmuyor.
- Mekanik alt-faz formu, teknik trace ve gizli diagnostic alanlar görünmüyor.
- HTML ile final ana/alt faz adları ve sırası tam eşleşiyor.
- Staging seti bütünüyle doğrulanmadan eski set değişmemiş.
- Marker’sız mevcut dizinde sahiplik kanıtı yoksa publish fail closed çalışmış.
- Başarılı yayım sonunda geçici HTML kaldırılmış.
