const { getStok } = require('../db');

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id } = query;

    // === CEK STOK BEKASAN ===
    if (data === 'cek_stok') {
      try {
        const stok3h = await getStok('3H');
        const stok4h = await getStok('4H');
        const stok5h = await getStok('5H');
        const stok6h = await getStok('6H');
        const stok7h = await getStok('7H');
        const stok8h = await getStok('8H');
        const stok9h = await getStok('9H');
        const stok10h = await getStok('10H');
        
        const info = `STOK BEKASAN\n\n` +
          `⚡ TERSEDIA:\n` +
          `3H   = ${stok3h.length === 0 ? '-' : stok3h.length}\n` +
          `4H   = ${stok4h.length === 0 ? '-' : stok4h.length}\n` +
          `5H   = ${stok5h.length === 0 ? '-' : stok5h.length}\n` +
          `6H   = ${stok6h.length === 0 ? '-' : stok6h.length}\n` +
          `7H   = ${stok7h.length === 0 ? '-' : stok7h.length}\n` +
          `8H   = ${stok8h.length === 0 ? '-' : stok8h.length}\n` +
          `9H   = ${stok9h.length === 0 ? '-' : stok9h.length}\n` +
          `10H = ${stok10h.length === 0 ? '-' : stok10h.length}\n\n` +
          `Tekan OK Untuk keluar`;

        await bot.answerCallbackQuery(id, {
          text: info,
          show_alert: true
        });
      } catch (err) {
        await bot.answerCallbackQuery(id, {
          text: '❌ Gagal baca stok bekasan.',
          show_alert: true
        });
      }
    }

    // === CEK STOK BULANAN ===
    if (data === 'cek_stok_bulanan') {
      try {
        // Ambil stok bulanan dari database secara realtime
        const stokSupermini = await getStok('SUPERMINI');
        const stokSuperbig = await getStok('SUPERBIG');
        const stokMini = await getStok('MINI');
        const stokBig = await getStok('BIG');
        const stokLite = await getStok('LITE');
        const stokJumbo = await getStok('JUMBO');
        const stokMegabig = await getStok('MEGABIG');
        const stokSuperjumbo = await getStok('SUPERJUMBO');
        
        // Gunakan Unicode invisible characters untuk spacing
        const invisibleSpace = '⠀'; // Ganti dengan teks kosong yang Anda punya

        const info = 
          `STOK BULANAN\n\n` +
          `🌙 TERSEDIA:\n` +
          `SUPERMINI   = ${stokSupermini.length === 0 ? '-' : stokSupermini.length}\n` +
          `SUPERBIG${invisibleSpace.repeat(1)}  = ${stokSuperbig.length === 0 ? '-' : stokSuperbig.length}\n` +
          `MINI${invisibleSpace.repeat(5)}  = ${stokMini.length === 0 ? '-' : stokMini.length}\n` +
          `BIG${invisibleSpace.repeat(6)}  = ${stokBig.length === 0 ? '-' : stokBig.length}\n` +
          `LITE${invisibleSpace.repeat(6)} = ${stokLite.length === 0 ? '-' : stokLite.length}\n` +
          `JUMBO${invisibleSpace.repeat(4)} = ${stokJumbo.length === 0 ? '-' : stokJumbo.length}\n` +
          `MEGABIG${invisibleSpace.repeat(2)}  = ${stokMegabig.length === 0 ? '-' : stokMegabig.length}\n` +
          `SUPER JUMBO = ${stokSuperjumbo.length === 0 ? '-' : stokSuperjumbo.length}\n\n` +
          `Tekan OK Untuk keluar`;

        await bot.answerCallbackQuery(id, {
          text: info,
          show_alert: true
        });
      } catch (err) {
        await bot.answerCallbackQuery(id, {
          text: '❌ Gagal baca stok bulanan.',
          show_alert: true
        });
      }
    }
  });
}
