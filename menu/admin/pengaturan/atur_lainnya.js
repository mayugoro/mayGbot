const { getKonfigurasi, setKonfigurasi, getAllKonfigurasi } = require('../../../db');

const adminState = new Map();

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === LIHAT SEMUA KONFIGURASI ===
    if (data === 'lihat_konfigurasi') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      try {
        const allConfig = await getAllKonfigurasi();
        
        let teksConfig = `👀 <b>SEMUA KONFIGURASI</b>\n\n`;
        
        // === HARGA BEKASAN ===
        teksConfig += `<b>Harga Bekasan :</b>\n`;
        const bekaanList = ['3h', '4h', '5h', '6h', '7h', '8h', '9h', '10h'];
        for (const kategori of bekaanList) {
          const key = `harga_${kategori}`;
          const harga = allConfig[key]?.value;
          if (harga) {
            const kategoriBesar = kategori.toUpperCase();
            teksConfig += `${kategoriBesar} = Rp. ${parseInt(harga).toLocaleString('id-ID')}\n`;
          }
        }
        teksConfig += `\n`;
        
        // === HARGA BULANAN ===
        teksConfig += `<b>Harga Bulanan :</b>\n`;
        const bulananList = ['supermini', 'superbig', 'mini', 'big', 'lite', 'jumbo', 'megabig', 'superjumbo'];
        for (const paket of bulananList) {
          const hargaKey = `harga_${paket}`;
          const kuotaKey = `kuota_${paket}`;
          const harga = allConfig[hargaKey]?.value;
          const kuota = allConfig[kuotaKey]?.value;
          
          if (harga && kuota) {
            const paketBesar = paket === 'superjumbo' ? 'Super Jumbo' : 
                              paket === 'superbig' ? 'Superbig' :
                              paket.charAt(0).toUpperCase() + paket.slice(1);
            const kuotaText = kuota === '0' ? 'Unlimited' : `${kuota}GB`;
            teksConfig += `${paketBesar} = Rp. ${parseInt(harga).toLocaleString('id-ID')} | ${kuotaText}\n`;
          }
        }
        teksConfig += `\n`;
        
        // === BIAYA OPERASI ===
        teksConfig += `<b>Biaya Operasi :</b>\n`;
        const minSaldoBekasan = allConfig['min_saldo_bekasan']?.value;
        const minSaldoBulanan = allConfig['min_saldo_bulanan']?.value;
        const biayaGagal = allConfig['harga_gagal']?.value;
        
        if (minSaldoBekasan) {
          teksConfig += `Akses Bekasan = Rp. ${parseInt(minSaldoBekasan).toLocaleString('id-ID')}\n`;
        }
        if (minSaldoBulanan) {
          teksConfig += `Akses Bulanan = Rp. ${parseInt(minSaldoBulanan).toLocaleString('id-ID')}\n`;
        }
        if (biayaGagal) {
          teksConfig += `Biaya TRX Gagal = Rp. ${parseInt(biayaGagal).toLocaleString('id-ID')}\n`;
        }
        teksConfig += `\n`;
        
        // === PESAN TOLAK ===
        teksConfig += `<b>Pesan Tolak :</b>\n`;
        const pesanBekasan = allConfig['pesan_tolak_bekasan']?.value;
        const pesanBulanan = allConfig['pesan_tolak_bulanan']?.value;
        
        if (pesanBekasan) {
          teksConfig += `Bekasan: ${pesanBekasan.replace(/\\n/g, ' ')}\n`;
        }
        if (pesanBulanan) {
          teksConfig += `Bulanan: ${pesanBulanan.replace(/\\n/g, ' ')}\n`;
        }
        teksConfig += `\n`;
        
        teksConfig += `Exit untuk keluar dari tampilan ini`;

        // Set mode operasi untuk lihat konfigurasi
        adminState.set(chatId, { mode: 'lihat_konfigurasi' });
        
        // Kirim sebagai message text baru
        const configMsg = await bot.sendMessage(chatId, teksConfig, {
          parse_mode: 'HTML'
        });
        
        // Simpan message ID yang baru dibuat
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = configMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        await bot.answerCallbackQuery(id, { text: '❌ Gagal memuat konfigurasi.', show_alert: true });
      }
      
      await bot.answerCallbackQuery(id);
      return;
    }
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;

    const state = adminState.get(chatId);
    if (!state) return;

    // === CEK CANCEL/EXIT UNTUK LIHAT KONFIGURASI ===
    if (state.mode === 'lihat_konfigurasi' && ['exit', 'EXIT', 'Exit'].includes(msg.text.trim())) {
      if (state.inputMessageId) {
        try {
          await bot.deleteMessage(chatId, state.inputMessageId);
        } catch (e) {
          // Ignore delete error
        }
      }
      
      adminState.delete(chatId);
      await bot.deleteMessage(chatId, msg.message_id);
      return;
    }
  });
};
