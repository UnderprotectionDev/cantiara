# PR Bağlam Kartı

Kurucu bir pull request için ilişkili İş, Karar, Risk, test ve Sürüm bağlamını ana kayıtlarına açılan salt okunur kartta görür. İnceleme ve merge GitHub'da kalır.

PR'nin ürün bağlamı dağılmaz. Kart Cantiara'da inceleme veya birleştirme yapmaz; kaynağa götürür.

Bu feature PR bağlam kartını tamamlar. GitHub senkronu, test özeti ve sürüm kanıt paketi kartın yerine geçmez.

## Tamamlanma Ölçütleri

- İlişkili İş, Karar, Risk, test ve Sürüm bağlamı salt okunur kartta ana kayıtlarına açılır.
- İnceleme ve merge GitHub'da kalır; kart yazma yüzeyi olmaz.

## Kapsam Sınırları

- Kartı GitHub review veya merge aracı sayma.
- Kartı İş Bağlam Kartı veya bağlam içi önizleme sayma.
- Eksik bağı otomatik tamamlayıp PR'yi hazır ilan etme.
