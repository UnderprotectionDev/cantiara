# 02 — Kesin kaynak olayı, okuma ayırımı ve takip işi önizlemesi

**What to build:** Bildirimi okumak veya kapatmak kaynak kaydın domain sonucunu değiştirmez. Güvenle çözümlenebiliyorsa sinyalin ürettiği kesin olay görünür bağlamda açılır; olay çözülemiyorsa kayıt açılır ve kayıp hedef açıklanır, sessizce başka olaya kayılmaz. `Create Follow-up Work` uygulanmadan önce oluşacak İşi ve kaynak ilişkilerini gösterir; uygulanınca tek İş bildirime ve kaynaklara Kökeni ile bağlanır. Eylem bildirimi kapatmaz, kaynak durumunu değiştirmez ve örtük çoklu İş üretmez. Bookmark kuyruğu yoktur. Silinen kaynak içerik sızdırmayan tombstone gösterir.

**Blocked by:** 01 — Kapalı registry ve Action Required / Information Flow

**Status:** ready-for-agent

- [ ] Okundu/kapatıldı işaretleri kaynak durum, kapanış sonucu veya planlama üyeliğini yazmaz.
- [ ] Açma, çözümlenebilir kesin olayı görünür bağlamda açar; kayıp hedef açıklanır ve başka olaya sessiz kaymaz.
- [ ] `Create Follow-up Work` önizleme sonrası en fazla bir İş üretir; Kökeni bildirim ve kaynak kayıtlara bağlanır; bildirim açık kalır; kaynak değişmez.
- [ ] Bildirim ayrı Saved/bookmark kuyruğunda tutulmaz.
- [ ] Kaynak silinince içerik yerine güvenli tombstone durur.
- [ ] Kabul kanıtı aynı seam'de: okuma karşıtı, kesin olay, kayıp hedef, takip önizlemesi, çoklu-iş karşıtı. Üretici negatifleri (iptal devir, Kaynak yaşı, vb.) merkez tarafından uydurulmaz.
