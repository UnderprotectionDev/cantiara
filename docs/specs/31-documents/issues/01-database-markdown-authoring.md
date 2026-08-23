# 01 — Veritabanında Markdown yazarlığı

**What to build:** Markdown Belgesi uygulama içinde Tiptap ile oluşturulur ve düzenlenir; gövde yalnız veritabanında yaşar. Türler `General`, `PRD`, `Plan`, `Spec`, `Research Note`, `Persona` seçilir ve sonradan değişir; kimlik veya ilişki yazılmaz. Tablolar, fenced code, Mermaid ve LaTeX desteklenir; kaynak metin korunur. Canlı `.md` dosyası, harici editör senkronu ve Word export yoktur.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Belge ana kaydı başlık, Markdown gövde ve tür ile oluşur; diskte canlı dosya yoktur.
- [ ] Tür değişimi içeriği, kimliği ve ilişkileri değiştirmez.
- [ ] Tablo, fenced code, Mermaid ve LaTeX aynı Belge gövdesinde durur; harici editör senkronu veya Wiki motoru yoktur.
- [ ] İşleme hatasında boş çıktı yerine hata ve düzenlenebilir kaynak durur.
- [ ] İngilizce UI `Document` ve tür adlarını kullanır.
- [ ] Kabul kanıtı Documents seam’inde oluşturma/düzenleme ve dosya-gerçeği karşıtı. Kanıt [Belge bütünlüğü](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğuna bağlanır.
