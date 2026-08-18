# Regresyon Yönlendirmesi

## Hızlı deterministik kapı

- [decomposition-cases.json](../tests/decomposition-cases.json): feature, anti-merge,
  alt faz, kesen feature, gözlenebilir sistem, önkoşul ve soru kapıları.
- [test_preview_contract.py](../tests/test_preview_contract.py): semantik model,
  graph ve HTML ana/alt faz metadata'sı.
- [test_publish_tools.py](../tests/test_publish_tools.py): açık onayın preview
  revizyonuna bağlanması, temiz final, preview/final eşliği, legacy ilk geçiş ve
  marker’sız fail-closed publish.
- [test_contract.py](../tests/test_contract.py): invocation, progressive disclosure,
  salt okunur görünür çıktı ve paket bağlantıları.

Bu kapıyı `python3 -m unittest discover -s tests -p 'test_*.py' -v` ile skill
kökünden çalıştır. Yalnız fixture'ı kendi kaydedilmiş çıktısıyla karşılaştıran test
ekleme; her test bir karar fonksiyonunu, renderer'ı, publisher'ı veya package
sözleşmesini çalıştırsın.

## Zorunlu release kapısı

[forward-source-cases.json](../tests/forward-source-cases.json) genellenebilir ham
PRD/tech-stack paketlerini temiz Codex oturumlarında değerlendirir.
[run_forward_tests.py](../scripts/run_forward_tests.py) beklenen ana fazları, alt faz
sahipliğini, yasak birleşmeleri, diagnostic türleri ve sıralamayı semantik olarak
doğrular.

Fixture'larda gerçek proje veya attachment kopyalama. Ortak model altında eş düzey feature'lar, atomic feature, lifecycle, kesen feature, observable-system sonucu, geniş operasyon ürünü, format varyantı ve gerçek bağımlılık gibi hata ailelerini kısa sentetik kaynaklarla kapsa.

Exact prose snapshot kullanma. Ana/alt faz hiyerarşisi, sahiplik, tür, sıra ve yasak kavramlar için seçici assertion kullan.
