# Doğrudan Önkoşul ve Sıralama

Bu sözleşmeyi yalnız faz sınırları ve requirement sahipliği kesinleştikten sonra uygula. Graph sahiplik, birleşme, faz kimliği veya görünür bölüm üretmez.

## Sert önkoşul kapısı

Bir kenar ancak:

1. tüketici başka fazın tamamlanmış sonucunu gerçekten tüketiyor;
2. o sonuç olmadan geçerli biçimde tamamlanamıyor

ise serttir.

Tercih edilen kullanıcı akışı, aynı ekran, aynı teknik katman, ekip sırası veya opsiyonel zenginleştirme sert kenar değildir.

## İç gösterim

- `allOf`: bütün doğrudan sonuçlar zorunlu.
- `anyOf`: aynı ihtiyacı karşılayan doğrudan alternatiflerden biri yeterli.
- `condition`: yalnız kaynakça doğrulanmış koşullu tüketimde kullan.
- Transitif ilişkiyi tekrar yazma.

## Üretim sırası

1. Alt fazların tükettiği somut sonuçları çıkar.
2. Başka ana fazdan zorunlu tüketimi ana faz graph'ına yükselt.
3. `allOf` ve `anyOf` gruplarını kur.
4. Döngüyü reddet.
5. Topolojik sırayı üret.
6. Eşit adaylarda doğal kullanıcı akışı, sonra PRD sırası, sonra kararlı kimlik kullan.

Graph'ı HTML'de veya teknik başlık olarak final Markdown'da gösterme. Bağımlılık feature'ı anlamak için maddi ise doğal bir cümleyle anlat.

Repo kanıtı ürün kapsamı üretmez. Tam mevcut davranışı yeniden fazlama; kısmi davranışın yalnız eksik sonucunu kapsamla.
