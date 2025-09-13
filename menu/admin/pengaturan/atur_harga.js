const { getHargaPaket, getHargaPaketDynamic, getAllProdukDinamis, updateHargaMarkup, setKonfigurasi, getKonfigurasi } = require('../../../db');
// Import hardcode paket data untuk atur harga global (menghindari rate limit)
const { getAllPaket, getPaketByDisplay, getPaketBekasanGlobal, getPaketBekasanByKode } = require('../../daftar-paket');
// Import Input Exiter utilities untuk modernisasi exit handling
const { sendStyledInputMessage, autoDeleteMessage, EXIT_KEYWORDS } = require('../../../utils/exiter');

const adminState = new Map();

// === PRELOAD INLINE KEYBOARDS ===
const ATUR_HARGA_MAIN_KEYBOARD = [
  [
    { text: '🌙 BULANAN', callback_data: 'harga_bulanan' },
    { text: '⚡ BEKASAN', callback_data: 'harga_bekasan' }
  ],
  [
    { text: '🌍 GLOBAL BULANAN', callback_data: 'harga_global_bulanan' },
    { text: '🌍 GLOBAL BEKASAN', callback_data: 'harga_global_bekasan' }
  ],
  [
    { text: '🔙 KEMBALI', callback_data: 'atur_produk' }
  ]
];

const HARGA_BEKASAN_KEYBOARD = [
  [{ text: 'BEKASAN 3H', callback_data: 'edit_harga_3h' }],
  [{ text: 'BEKASAN 4H', callback_data: 'edit_harga_4h' }],
  [{ text: 'BEKASAN 5H', callback_data: 'edit_harga_5h' }],
  [{ text: 'BEKASAN 6H', callback_data: 'edit_harga_6h' }],
  [{ text: 'BEKASAN 7H', callback_data: 'edit_harga_7h' }],
  [{ text: 'BEKASAN 8H', callback_data: 'edit_harga_8h' }],
  [{ text: 'BEKASAN 9H', callback_data: 'edit_harga_9h' }],
  [{ text: 'BEKASAN 10H', callback_data: 'edit_harga_10h' }],
  [{ text: '🔙 KEMBALI', callback_data: 'atur_harga' }]
];

const HARGA_BULANAN_KEYBOARD = [
  [{ text: 'SUPERMINI', callback_data: 'edit_harga_supermini' }],
  [{ text: 'SUPERBIG', callback_data: 'edit_harga_superbig' }],
  [{ text: 'MINI', callback_data: 'edit_harga_mini' }],
  [{ text: 'BIG', callback_data: 'edit_harga_big' }],
  [{ text: 'LITE', callback_data: 'edit_harga_lite' }],
  [{ text: 'JUMBO', callback_data: 'edit_harga_jumbo' }],
  [{ text: 'MEGABIG', callback_data: 'edit_harga_megabig' }],
  [{ text: 'SUPER JUMBO', callback_data: 'edit_harga_superjumbo' }],
  [{ text: '🔙 KEMBALI', callback_data: 'atur_harga' }]
];

const HARGA_PRIBADI_KEYBOARD = [
  [{ text: '🔙 KEMBALI', callback_data: 'atur_harga' }]
];

const HARGA_GLOBAL_BULANAN_KEYBOARD = [
  [{ text: 'SUPERMINI GLOBAL', callback_data: 'edit_harga_global_supermini' }],
  [{ text: 'MEGABIG GLOBAL', callback_data: 'edit_harga_global_megabig' }],
  [{ text: 'MINI GLOBAL', callback_data: 'edit_harga_global_mini' }],
  [{ text: 'BIG GLOBAL', callback_data: 'edit_harga_global_big' }],
  [{ text: 'JUMBO GLOBAL', callback_data: 'edit_harga_global_jumbo' }],
  [{ text: 'BIG PLUS GLOBAL', callback_data: 'edit_harga_global_bigplus' }],
  [{ text: '🔙 KEMBALI', callback_data: 'atur_harga' }]
];

// === STATIC KEYBOARD GENERATOR UNTUK HARGA GLOBAL BULANAN (VERSI BARU) ===
// Generate keyboard berdasarkan data hardcode dari daftar-paket.js (menghindari rate limit)
async function generateStaticHargaGlobalBulananKeyboard() {
  try {
    // Get data dari daftar-paket.js (tidak ada API call)
    const allPaket = getAllPaket();
    
    if (!allPaket || allPaket.length === 0) {
      // Fallback ke keyboard static jika tidak ada data
      return HARGA_GLOBAL_BULANAN_KEYBOARD;
    }
    
    const keyboard = [];
    
    // Generate keyboard buttons berdasarkan paket hardcode
    allPaket.forEach(paket => {
      keyboard.push([{
        text: `${paket.nama_display.toUpperCase()} (${paket.kode_produk})`,
        callback_data: `edit_harga_static_${paket.kode_produk.toLowerCase()}`
      }]);
    });
    
    // Tambahkan tombol kembali
    keyboard.push([{ text: '🔙 KEMBALI', callback_data: 'atur_harga' }]);
    
    return keyboard;
  } catch (error) {
    console.error('Error generating static harga keyboard:', error);
    
    // Fallback ke keyboard static jika gagal
    return HARGA_GLOBAL_BULANAN_KEYBOARD;
  }
}

// === STATIC KEYBOARD GENERATOR UNTUK HARGA GLOBAL BEKASAN (VERSI BARU) ===
// Generate keyboard berdasarkan data hardcode dari daftar-paket.js (menghindari rate limit)
async function generateStaticHargaGlobalBekasanKeyboard() {
  try {
    // Get data bekasan dari daftar-paket.js (tidak ada API call)
    const allBekasan = getPaketBekasanGlobal();
    
    if (!allBekasan || allBekasan.length === 0) {
      // Fallback ke keyboard static jika tidak ada data
      return HARGA_GLOBAL_BEKASAN_KEYBOARD;
    }
    
    const keyboard = [];
    
    // Group bekasan by tipe
    const bekasanByTipe = {
      l: allBekasan.filter(p => p.tipe === 'l'),
      xl: allBekasan.filter(p => p.tipe === 'xl'),
      xxl: allBekasan.filter(p => p.tipe === 'xxl')
    };
    
    // Add tipe buttons
    if (bekasanByTipe.l.length > 0) {
      keyboard.push([{ text: 'BEKASAN GLOBAL L', callback_data: 'harga_static_bekasan_global_l' }]);
    }
    if (bekasanByTipe.xl.length > 0) {
      keyboard.push([{ text: 'BEKASAN GLOBAL XL', callback_data: 'harga_static_bekasan_global_xl' }]);
    }
    if (bekasanByTipe.xxl.length > 0) {
      keyboard.push([{ text: 'BEKASAN GLOBAL XXL', callback_data: 'harga_static_bekasan_global_xxl' }]);
    }
    
    // Tambahkan tombol kembali
    keyboard.push([{ text: '🔙 KEMBALI', callback_data: 'atur_harga' }]);
    
    return keyboard;
  } catch (error) {
    console.error('Error generating static bekasan keyboard:', error);
    
    // Fallback ke keyboard static jika gagal
    return HARGA_GLOBAL_BEKASAN_KEYBOARD;
  }
}

// === STATIC KEYBOARD GENERATOR UNTUK HARGA BEKASAN TIPE SPESIFIK ===
async function generateStaticHargaBekasanTipeKeyboard(tipe) {
  try {
    const allBekasan = getPaketBekasanGlobal();
    const bekasanTipe = allBekasan.filter(p => p.tipe === tipe.toLowerCase());
    
    if (!bekasanTipe || bekasanTipe.length === 0) {
      return [[{ text: 'Tidak ada data', callback_data: 'no_data' }], 
              [{ text: '🔙 KEMBALI', callback_data: 'harga_global_bekasan' }]];
    }
    
    const keyboard = [];
    
    // Sort by durasi
    bekasanTipe.sort((a, b) => parseInt(a.durasi) - parseInt(b.durasi));
    
    // Generate buttons
    bekasanTipe.forEach(paket => {
      keyboard.push([{
        text: `${paket.nama_display.toUpperCase()}`,
        callback_data: `edit_harga_static_bekasan_${paket.kode_produk.toLowerCase()}`
      }]);
    });
    
    // Tambahkan tombol kembali
    keyboard.push([{ text: '🔙 KEMBALI', callback_data: 'harga_global_bekasan' }]);
    
    return keyboard;
  } catch (error) {
    console.error('Error generating static bekasan tipe keyboard:', error);
    return [[{ text: '❌ Error', callback_data: 'error' }], 
            [{ text: '🔙 KEMBALI', callback_data: 'harga_global_bekasan' }]];
  }
}

const HARGA_GLOBAL_BEKASAN_KEYBOARD = [
  [{ text: 'BEKASAN GLOBAL L', callback_data: 'harga_global_bekasan_l' }],
  [{ text: 'BEKASAN GLOBAL XL', callback_data: 'harga_global_bekasan_xl' }],
  [{ text: 'BEKASAN GLOBAL XXL', callback_data: 'harga_global_bekasan_xxl' }],
  [{ text: '🔙 KEMBALI', callback_data: 'atur_harga' }]
];

// Sub-keyboards untuk bekasan global per tipe
const HARGA_GLOBAL_BEKASAN_L_KEYBOARD = [
  [{ text: 'BEKASAN GLOBAL L 3H', callback_data: 'edit_harga_bekasan_global_l_3h' }],
  [{ text: 'BEKASAN GLOBAL L 5H', callback_data: 'edit_harga_bekasan_global_l_5h' }],
  [{ text: 'BEKASAN GLOBAL L 7H', callback_data: 'edit_harga_bekasan_global_l_7h' }],
  [{ text: 'BEKASAN GLOBAL L 9H', callback_data: 'edit_harga_bekasan_global_l_9h' }],
  [{ text: 'BEKASAN GLOBAL L 11H', callback_data: 'edit_harga_bekasan_global_l_11h' }],
  [{ text: 'BEKASAN GLOBAL L 13H', callback_data: 'edit_harga_bekasan_global_l_13h' }],
  [{ text: 'BEKASAN GLOBAL L 15H', callback_data: 'edit_harga_bekasan_global_l_15h' }],
  [{ text: 'BEKASAN GLOBAL L 17H', callback_data: 'edit_harga_bekasan_global_l_17h' }],
  [{ text: 'BEKASAN GLOBAL L 19H', callback_data: 'edit_harga_bekasan_global_l_19h' }],
  [{ text: '🔙 KEMBALI', callback_data: 'harga_global_bekasan' }]
];

const HARGA_GLOBAL_BEKASAN_XL_KEYBOARD = [
  [{ text: 'BEKASAN GLOBAL XL 3H', callback_data: 'edit_harga_bekasan_global_xl_3h' }],
  [{ text: 'BEKASAN GLOBAL XL 5H', callback_data: 'edit_harga_bekasan_global_xl_5h' }],
  [{ text: 'BEKASAN GLOBAL XL 7H', callback_data: 'edit_harga_bekasan_global_xl_7h' }],
  [{ text: 'BEKASAN GLOBAL XL 9H', callback_data: 'edit_harga_bekasan_global_xl_9h' }],
  [{ text: 'BEKASAN GLOBAL XL 11H', callback_data: 'edit_harga_bekasan_global_xl_11h' }],
  [{ text: 'BEKASAN GLOBAL XL 13H', callback_data: 'edit_harga_bekasan_global_xl_13h' }],
  [{ text: 'BEKASAN GLOBAL XL 15H', callback_data: 'edit_harga_bekasan_global_xl_15h' }],
  [{ text: 'BEKASAN GLOBAL XL 17H', callback_data: 'edit_harga_bekasan_global_xl_17h' }],
  [{ text: 'BEKASAN GLOBAL XL 19H', callback_data: 'edit_harga_bekasan_global_xl_19h' }],
  [{ text: '🔙 KEMBALI', callback_data: 'harga_global_bekasan' }]
];

const HARGA_GLOBAL_BEKASAN_XXL_KEYBOARD = [
  [{ text: 'BEKASAN GLOBAL XXL 3H', callback_data: 'edit_harga_bekasan_global_xxl_3h' }],
  [{ text: 'BEKASAN GLOBAL XXL 5H', callback_data: 'edit_harga_bekasan_global_xxl_5h' }],
  [{ text: 'BEKASAN GLOBAL XXL 7H', callback_data: 'edit_harga_bekasan_global_xxl_7h' }],
  [{ text: 'BEKASAN GLOBAL XXL 9H', callback_data: 'edit_harga_bekasan_global_xxl_9h' }],
  [{ text: 'BEKASAN GLOBAL XXL 11H', callback_data: 'edit_harga_bekasan_global_xxl_11h' }],
  [{ text: 'BEKASAN GLOBAL XXL 13H', callback_data: 'edit_harga_bekasan_global_xxl_13h' }],
  [{ text: 'BEKASAN GLOBAL XXL 15H', callback_data: 'edit_harga_bekasan_global_xxl_15h' }],
  [{ text: 'BEKASAN GLOBAL XXL 17H', callback_data: 'edit_harga_bekasan_global_xxl_17h' }],
  [{ text: 'BEKASAN GLOBAL XXL 19H', callback_data: 'edit_harga_bekasan_global_xxl_19h' }],
  [{ text: '🔙 KEMBALI', callback_data: 'harga_global_bekasan' }]
];

// Preload template content
const ATUR_HARGA_MAIN_CONTENT = '💰 <b>ATUR HARGA PRODUK</b>\n\nPilih kategori produk yang akan diubah harganya:';
const HARGA_BEKASAN_CONTENT = '💰 <b>ATUR HARGA BEKASAN</b>\n\nPilih paket bekasan yang ingin diubah harganya:';
const HARGA_BULANAN_CONTENT = '💰 <b>ATUR HARGA BULANAN</b>\n\nPilih paket bulanan yang ingin diubah harganya:';
const HARGA_PRIBADI_CONTENT = '🏪 <b>HARGA STOK PRIBADI</b>\n\n📋 Menu harga stok pribadi sedang disiapkan...\n\n💡 <i>Fitur ini akan segera tersedia</i>';
const HARGA_GLOBAL_BULANAN_CONTENT = '🌍 <b>ATUR HARGA GLOBAL BULANAN</b>\n\nPilih paket bulanan global yang ingin diubah harganya:';
const HARGA_GLOBAL_BEKASAN_CONTENT = '🌍 <b>ATUR HARGA GLOBAL BEKASAN</b>\n\nPilih tipe bekasan global yang ingin diubah harganya:';
const HARGA_GLOBAL_BEKASAN_L_CONTENT = '🌍 <b>ATUR HARGA BEKASAN GLOBAL L</b>\n\nPilih durasi paket L yang ingin diubah harganya:';
const HARGA_GLOBAL_BEKASAN_XL_CONTENT = '🌍 <b>ATUR HARGA BEKASAN GLOBAL XL</b>\n\nPilih durasi paket XL yang ingin diubah harganya:';
const HARGA_GLOBAL_BEKASAN_XXL_CONTENT = '🌍 <b>ATUR HARGA BEKASAN GLOBAL XXL</b>\n\nPilih durasi paket XXL yang ingin diubah harganya:';

// Function untuk generate input harga menggunakan modern Input Exiter pattern
// Mempertahankan logic complex untuk berbagai jenis produk
const generateHargaInputMessage = (jenis, kategori, hargaSekarang) => {
  const jenisText = jenis === 'bekasan' ? 'BEKASAN' : 
                   jenis === 'bulanan' ? 'BULANAN' :
                   jenis === 'global_bulanan' ? 'GLOBAL BULANAN' :
                   jenis === 'global_bekasan' ? 'GLOBAL BEKASAN' : 
                   jenis === 'bekasan_global' ? 'BEKASAN GLOBAL' : 'PAKET';
  const contohHarga = jenis.includes('bekasan') ? '15000' : '50000';
  
  const mainText = `💰 Edit Harga ${jenisText} ${kategori.toUpperCase()}\n\nHarga saat ini: Rp. ${hargaSekarang.toLocaleString('id-ID')}`;
  const subtitle = `Masukkan harga baru (tanpa tanda titik atau koma):\n💡 Contoh: ${contohHarga}`;
  
  return { mainText, subtitle };
};

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === ATUR HARGA ===
    if (data === 'atur_harga') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = ATUR_HARGA_MAIN_KEYBOARD;
      const content = ATUR_HARGA_MAIN_CONTENT;

      // Cek apakah message memiliki caption (dari photo message)
      if (message.caption) {
        // Cek apakah caption dan keyboard sudah sama
        if (message.caption === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Atur Harga aktif.',
            show_alert: false
          });
        }

        try {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } catch (error) {
          if (error.message.includes('message is not modified')) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu Atur Harga aktif.',
              show_alert: false
            });
          }
          console.error('Error editing atur_harga caption:', error.message);
        }
      } else {
        // Cek apakah text dan keyboard sudah sama
        if (message.text === content && 
            message.reply_markup?.inline_keyboard && 
            JSON.stringify(message.reply_markup.inline_keyboard) === JSON.stringify(keyboard)) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu Atur Harga aktif.',
            show_alert: false
          });
        }

        try {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } catch (error) {
          if (error.message.includes('message is not modified')) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu Atur Harga aktif.',
              show_alert: false
            });
          }
          console.error('Error editing atur_harga text:', error.message);
        }
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === HARGA BEKASAN ===
    if (data === 'harga_bekasan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = HARGA_BEKASAN_KEYBOARD;
      const content = HARGA_BEKASAN_CONTENT;

      try {
        if (message.caption) {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
      } catch (error) {
        if (error.message.includes('message is not modified')) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu sudah aktif.',
            show_alert: false
          });
        }
        console.error('Error editing harga_bekasan:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === HARGA BULANAN ===
    if (data === 'harga_bulanan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = HARGA_BULANAN_KEYBOARD;
      const content = HARGA_BULANAN_CONTENT;

      try {
        if (message.caption) {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
      } catch (error) {
        if (error.message.includes('message is not modified')) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu sudah aktif.',
            show_alert: false
          });
        }
        console.error('Error editing harga_bulanan:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === HARGA PRIBADI ===
    if (data === 'harga_pribadi') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      // Load handler stok pribadi secara dinamis
      try {
        require('../stok_pribadi/harga_stok_pribadi')(bot);
        
        const content = HARGA_PRIBADI_CONTENT;
        const keyboard = HARGA_PRIBADI_KEYBOARD;
        
        try {
          if (message.caption) {
            await bot.editMessageCaption(content, {
              chat_id: chatId,
              message_id: msgId,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: keyboard }
            });
          } else {
            await bot.editMessageText(content, {
              chat_id: chatId,
              message_id: msgId,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: keyboard }
            });
          }
        } catch (error) {
          console.error('Error editing harga_pribadi:', error.message);
        }
        
      } catch (e) {
        // console.log('🏪 Harga Stok Pribadi handler loaded (placeholder)');
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === HARGA GLOBAL BULANAN (DYNAMIC) ===
    if (data === 'harga_global_bulanan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      // Generate keyboard statis berdasarkan daftar-paket.js (menghindari rate limit)
      const keyboard = await generateStaticHargaGlobalBulananKeyboard();
      const content = HARGA_GLOBAL_BULANAN_CONTENT;

      try {
        if (message.caption) {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
      } catch (error) {
        if (error.message.includes('message is not modified')) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu sudah aktif.',
            show_alert: false
          });
        }
        console.error('Error editing harga_global_bulanan:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === HARGA GLOBAL BEKASAN ===
    if (data === 'harga_global_bekasan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      // Generate keyboard statis berdasarkan daftar-paket.js (menghindari rate limit)
      const keyboard = await generateStaticHargaGlobalBekasanKeyboard();
      const content = HARGA_GLOBAL_BEKASAN_CONTENT;

      try {
        if (message.caption) {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
      } catch (error) {
        if (error.message.includes('message is not modified')) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu sudah aktif.',
            show_alert: false
          });
        }
        console.error('Error editing harga_global_bekasan:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === SUB-MENU HARGA GLOBAL BEKASAN ===
    if (data === 'harga_global_bekasan_l') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = HARGA_GLOBAL_BEKASAN_L_KEYBOARD;
      const content = HARGA_GLOBAL_BEKASAN_L_CONTENT;

      try {
        if (message.caption) {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
      } catch (error) {
        console.error('Error editing harga_global_bekasan_l:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    if (data === 'harga_global_bekasan_xl') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = HARGA_GLOBAL_BEKASAN_XL_KEYBOARD;
      const content = HARGA_GLOBAL_BEKASAN_XL_CONTENT;

      try {
        if (message.caption) {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
      } catch (error) {
        console.error('Error editing harga_global_bekasan_xl:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    if (data === 'harga_global_bekasan_xxl') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const keyboard = HARGA_GLOBAL_BEKASAN_XXL_KEYBOARD;
      const content = HARGA_GLOBAL_BEKASAN_XXL_CONTENT;

      try {
        if (message.caption) {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
      } catch (error) {
        console.error('Error editing harga_global_bekasan_xxl:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === HARGA STATIC BEKASAN GLOBAL TIPE SPESIFIK ===
    if (/^harga_static_bekasan_global_(l|xl|xxl)$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const tipe = data.split('_')[4]; // l, xl, atau xxl
      
      try {
        // Generate keyboard berdasarkan data statis
        const keyboard = await generateStaticHargaBekasanTipeKeyboard(tipe);
        const content = `🌍 <b>ATUR HARGA BEKASAN GLOBAL ${tipe.toUpperCase()}</b>\n\nPilih durasi paket ${tipe.toUpperCase()} yang ingin diubah harganya:`;

        if (message.caption) {
          await bot.editMessageCaption(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        } else {
          await bot.editMessageText(content, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
      } catch (error) {
        console.error(`Error editing harga_static_bekasan_global_${tipe}:`, error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === EDIT HARGA SPESIFIK (BEKASAN STATIC) ===
    if (/^edit_harga_static_bekasan_[a-zA-Z0-9]+$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const kodeProduK = data.replace('edit_harga_static_bekasan_', '').toUpperCase();
      
      try {
        // Validasi paket bekasan dari data hardcode
        const paketBekasan = getPaketBekasanByKode(kodeProduK);
        
        if (!paketBekasan) {
          return bot.answerCallbackQuery(id, { 
            text: `❌ Paket bekasan ${kodeProduK} tidak ditemukan dalam sistem.`, 
            show_alert: true 
          });
        }
        
        // Ambil harga dari database berdasarkan pattern key
        const keyPattern = `harga_bekasan_global_${paketBekasan.tipe}_${paketBekasan.durasi}h`;
        const harga = await getKonfigurasi(keyPattern);
        const hargaSekarang = harga ? parseInt(harga) : 0;
        
        // Set state untuk input harga baru
        adminState.set(chatId, { 
          mode: 'edit_harga', 
          kategori: `static_bekasan_${kodeProduK.toLowerCase()}`,
          paketData: paketBekasan,
          keyPattern
        });
        
        // Generate styled input menggunakan modern Input Exiter
        const { mainText, subtitle } = generateHargaInputMessage('bekasan_global', paketBekasan.nama_display, hargaSekarang);
        const inputMsg = await sendStyledInputMessage(bot, chatId, mainText, subtitle, 'membatalkan');
        
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        console.error('Error edit_harga_static_bekasan:', e);
        await bot.answerCallbackQuery(id, { text: '❌ Gagal memuat data bekasan.', show_alert: true });
      }
      return;
    }

    // === EDIT HARGA SPESIFIK (BEKASAN) ===
    if (/^edit_harga_\d+h$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const kategori = data.split('_')[2].toUpperCase();
      
      try {
        const hargaSekarang = await getHargaPaket(kategori);
        
        adminState.set(chatId, { mode: 'edit_harga', kategori });
        
        // Generate styled input menggunakan modern Input Exiter
        const { mainText, subtitle } = generateHargaInputMessage('bekasan', kategori, hargaSekarang);
        const inputMsg = await sendStyledInputMessage(bot, chatId, mainText, subtitle, 'membatalkan');
        
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        await bot.answerCallbackQuery(id, { text: '❌ Gagal memuat data.', show_alert: true });
      }
      return;
    }

    // === EDIT HARGA SPESIFIK (BULANAN) ===
    if (/^edit_harga_(supermini|superbig|mini|big|lite|jumbo|megabig|superjumbo)$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const paket = data.split('_')[2].toLowerCase();
      
      try {
        const hargaSekarang = await getHargaPaket(paket);
        
        adminState.set(chatId, { mode: 'edit_harga', kategori: paket });
        
        // Generate styled input menggunakan modern Input Exiter
        const { mainText, subtitle } = generateHargaInputMessage('bulanan', paket, hargaSekarang);
        const inputMsg = await sendStyledInputMessage(bot, chatId, mainText, subtitle, 'membatalkan');
        
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        await bot.answerCallbackQuery(id, { text: '❌ Gagal memuat data.', show_alert: true });
      }
      return;
    }

    // === SYNC PRODUK API (DISABLED - MENGGUNAKAN DATA STATIS) ===
    // Handler ini dinonaktifkan karena sekarang menggunakan data hardcode dari daftar-paket.js
    /*
    if (data === 'sync_produk_api') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      await bot.answerCallbackQuery(id, { 
        text: 'ℹ️ Sync API tidak diperlukan. Sistem menggunakan data hardcode dari daftar-paket.js', 
        show_alert: true 
      });
      return;
    }
    */

    // === EDIT HARGA SPESIFIK (PRODUK STATIS DARI DAFTAR-PAKET) ===
    if (/^edit_harga_static_[a-zA-Z0-9]+$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const kodeProduK = data.replace('edit_harga_static_', '').toUpperCase();
      
      try {
        // Get product data dari daftar-paket.js hardcode
        const allPaket = getAllPaket();
        const produkData = allPaket.find(paket => paket.kode_produk.toLowerCase() === kodeProduK.toLowerCase());
        
        if (!produkData) {
          return bot.answerCallbackQuery(id, { text: `❌ Produk ${kodeProduK} tidak ditemukan dalam daftar paket.`, show_alert: true });
        }
        
        // Get harga saat ini dari database
        const hargaSekarang = await getHargaPaketDynamic(kodeProduK, produkData.nama_display?.toLowerCase()) || 0;
        
        adminState.set(chatId, { 
          mode: 'edit_harga', 
          kategori: `static_${kodeProduK.toLowerCase()}`,
          kodeProduK: kodeProduK,
          namaProduK: produkData.nama_display
        });
        
        // Generate styled input untuk static global bulanan
        const mainText = `💰 Edit Harga Global Bulanan ${produkData.nama_display.toUpperCase()}\n\n📦 Kode Produk: ${kodeProduK}\n💰 Harga saat ini: Rp. ${hargaSekarang.toLocaleString('id-ID')}`;
        const subtitle = `Masukkan harga baru (tanpa tanda titik atau koma):\n💡 Contoh: 50000`;
        const inputMsg = await sendStyledInputMessage(bot, chatId, mainText, subtitle, 'membatalkan');
        
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        console.error('Error editing static product price:', e);
        await bot.answerCallbackQuery(id, { text: '❌ Gagal memuat data produk.', show_alert: true });
      }
      return;
    }
    if (/^edit_harga_global_dynamic_[a-zA-Z0-9]+$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const kodeProduK = data.replace('edit_harga_global_dynamic_', '').toUpperCase();
      
      try {
        // Get product data dari mapping dinamis
        const { getProductByCode } = require('../../global/bulanan/list_bulanan_global');
        const productData = await getProductByCode(kodeProduK);
        
        if (!productData) {
          return bot.answerCallbackQuery(id, { text: `❌ Produk ${kodeProduK} tidak ditemukan.`, show_alert: true });
        }
        
        // Cek harga dari database berdasarkan kode produk dinamis
        const hargaSekarang = await getHargaPaketDynamic(kodeProduK, productData.nama?.toLowerCase());
        
        adminState.set(chatId, { 
          mode: 'edit_harga', 
          kategori: `dynamic_${kodeProduK.toLowerCase()}`, // Menggunakan prefix dynamic_
          kodeProduK: kodeProduK,
          namaProduK: productData.nama
        });
        
        const { mainText, subtitle } = generateHargaInputMessage('global_bulanan', productData.nama, hargaSekarang);
        const inputMsg = await sendStyledInputMessage(bot, chatId, mainText, subtitle, 'membatalkan');
        
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        console.error('Error editing dynamic global bulanan price:', e);
        await bot.answerCallbackQuery(id, { text: '❌ Gagal memuat data produk.', show_alert: true });
      }
      return;
    }

    // === EDIT HARGA SPESIFIK (GLOBAL BULANAN - LEGACY) ===
    if (/^edit_harga_global_(supermini|megabig|mini|big|jumbo|bigplus)$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const paket = data.split('_')[3].toLowerCase();
      
      try {
        const currentHarga = await getKonfigurasi(`harga_global_${paket}`) || 
                           await getKonfigurasi(`harga_${paket}`) || '0';
        const hargaSekarang = parseInt(currentHarga);
        
        adminState.set(chatId, { mode: 'edit_harga', kategori: `global_${paket}` });
        
        // Generate styled input menggunakan modern Input Exiter
        const { mainText, subtitle } = generateHargaInputMessage('global_bulanan', paket, hargaSekarang);
        const inputMsg = await sendStyledInputMessage(bot, chatId, mainText, subtitle, 'membatalkan');
        
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        await bot.answerCallbackQuery(id, { text: '❌ Gagal memuat data.', show_alert: true });
      }
      return;
    }

    // === EDIT HARGA SPESIFIK (GLOBAL BEKASAN) ===
    if (/^edit_harga_bekasan_global_(l|xl|xxl)_(\d+)h$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const matches = data.match(/^edit_harga_bekasan_global_(l|xl|xxl)_(\d+)h$/i);
      const tipe = matches[1].toLowerCase();
      const hari = matches[2];
      const kategori = `bekasan_global_${tipe}_${hari}h`;
      
      try {
        const currentHarga = await getKonfigurasi(`harga_bekasan_global_${tipe}_${hari}h`) || 
                           await getKonfigurasi(`harga_bekasan_${tipe}_${hari}h`) || 
                           await getKonfigurasi(`harga_bekasan_${hari}h`) || '0';
        const hargaSekarang = parseInt(currentHarga);
        
        adminState.set(chatId, { mode: 'edit_harga', kategori: kategori });
        
        // Generate styled input menggunakan modern Input Exiter
        const { mainText, subtitle } = generateHargaInputMessage('global_bekasan', `${tipe.toUpperCase()} ${hari}H`, hargaSekarang);
        const inputMsg = await sendStyledInputMessage(bot, chatId, mainText, subtitle, 'membatalkan');
        
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        await bot.answerCallbackQuery(id, { text: '❌ Gagal memuat data.', show_alert: true });
      }
      return;
    }
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text) return;
    if (msg.from.id.toString() !== process.env.ADMIN_ID) return;

    const state = adminState.get(chatId);
    if (!state || state.mode !== 'edit_harga') return;

    // === CEK RESET COMMAND ===
    if (msg.text.trim().toLowerCase() === 'reset') {
      if (state.kategori.startsWith('dynamic_') && state.hargaAPI) {
        try {
          // Reset ke harga API (set harga_markup menjadi NULL)
          await updateHargaMarkup(state.kodeProduK, null);
          
          const teksHasil = `✅ <b>Harga berhasil direset ke harga API!</b>\n\n` +
            `📦 Produk: ${state.namaProduK} (${state.kodeProduK})\n` +
            `💰 Harga sekarang: <code>Rp. ${state.hargaAPI.toLocaleString('id-ID')}</code> (Harga API)`;
          
          if (state.inputMessageId) {
            try {
              await bot.editMessageText(teksHasil, {
                chat_id: chatId,
                message_id: state.inputMessageId,
                parse_mode: 'HTML'
              });
            } catch (e) {
              await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
            }
          } else {
            await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
          }
          
          // Auto delete dengan exiter autoDeleteMessage (3 detik)
          autoDeleteMessage(bot, chatId, state.inputMessageId, 3000);
          
          adminState.delete(chatId);
          autoDeleteMessage(bot, chatId, msg.message_id, 100);
          return;
        } catch (e) {
          await bot.sendMessage(chatId, `❌ Gagal reset harga: ${e.message}`);
        }
      }
      return;
    }
    if (EXIT_KEYWORDS.COMBINED.includes(msg.text.trim())) {
      if (state.inputMessageId) {
        autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
      }
      
      adminState.delete(chatId);
      autoDeleteMessage(bot, chatId, msg.message_id, 100);
      return;
    }

    try {
      const hargaBaru = parseInt(msg.text.trim());
      
      if (isNaN(hargaBaru) || hargaBaru <= 0) {
        await bot.sendMessage(chatId, '❌ Format harga salah! Masukkan angka yang valid.');
        autoDeleteMessage(bot, chatId, msg.message_id, 100);
        return;
      }
      
      // Tentukan key berdasarkan kategori
      let key = '';
      let jenisText = '';
      let displayName = '';
      
      if (state.kategori.startsWith('static_')) {
        // Static product: simpan ke tabel konfigurasi dengan kode produk
        try {
          const kodeProduK = state.kodeProduK;
          key = `harga_${kodeProduK.toLowerCase()}`;
          jenisText = `GLOBAL BULANAN STATIS`;
          displayName = `${state.namaProduK} (${kodeProduK})`;
          
          await setKonfigurasi(key, hargaBaru.toString());
          
          const teksHasil = `✅ <b>Harga berhasil disimpan!</b>\n\n` +
            `📦 Produk: ${displayName}\n` +
            `💰 Harga Baru: <code>Rp. ${hargaBaru.toLocaleString('id-ID')}</code>\n` +
            `🔑 Database Key: <code>${key}</code>\n` +
            `🔧 Sumber: daftar-paket.js (hardcode)`;
          
          if (state.inputMessageId) {
            try {
              await bot.editMessageText(teksHasil, {
                chat_id: chatId,
                message_id: state.inputMessageId,
                parse_mode: 'HTML'
              });
            } catch (e) {
              await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
            }
          } else {
            await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
          }
          
          // Auto delete dengan exiter autoDeleteMessage (3 detik)
          autoDeleteMessage(bot, chatId, state.inputMessageId, 3000);
          
          adminState.delete(chatId);
          autoDeleteMessage(bot, chatId, msg.message_id, 100);
          return;
        } catch (e) {
          await bot.sendMessage(chatId, `❌ Gagal menyimpan harga statis: ${e.message}`);
          adminState.delete(chatId);
          autoDeleteMessage(bot, chatId, msg.message_id, 100);
          return;
        }
      } else if (state.kategori.startsWith('static_bekasan_')) {
        // Static bekasan product: simpan ke tabel konfigurasi dengan pattern khusus bekasan
        try {
          const paketData = state.paketData;
          const keyPattern = state.keyPattern;
          
          key = keyPattern;
          jenisText = `GLOBAL BEKASAN STATIS`;
          displayName = `${paketData.nama_display} (${paketData.kode_produk})`;
          
          await setKonfigurasi(key, hargaBaru.toString());
          
          const teksHasil = `✅ <b>Harga bekasan berhasil disimpan!</b>\n\n` +
            `📦 Produk: ${displayName}\n` +
            `🕐 Durasi: ${paketData.durasi} jam\n` +
            `📶 Tipe: ${paketData.tipe.toUpperCase()}\n` +
            `💰 Harga Baru: <code>Rp. ${hargaBaru.toLocaleString('id-ID')}</code>\n` +
            `🔑 Database Key: <code>${key}</code>\n` +
            `🔧 Sumber: daftar-paket.js (hardcode)`;
          
          if (state.inputMessageId) {
            try {
              await bot.editMessageText(teksHasil, {
                chat_id: chatId,
                message_id: state.inputMessageId,
                parse_mode: 'HTML'
              });
            } catch (e) {
              await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
            }
          } else {
            await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
          }
          
          // Auto delete dengan exiter autoDeleteMessage (3 detik)
          autoDeleteMessage(bot, chatId, state.inputMessageId, 3000);
          
          adminState.delete(chatId);
          autoDeleteMessage(bot, chatId, msg.message_id, 100);
          return;
        } catch (e) {
          await bot.sendMessage(chatId, `❌ Gagal menyimpan harga bekasan statis: ${e.message}`);
          adminState.delete(chatId);
          autoDeleteMessage(bot, chatId, msg.message_id, 100);
          return;
        }
      } else if (state.kategori.startsWith('dynamic_')) {
        // Dynamic product: simpan ke tabel produk_dinamis
        try {
          await updateHargaMarkup(state.kodeProduK, hargaBaru);
          
          jenisText = `PRODUK DINAMIS`;
          displayName = `${state.namaProduK} (${state.kodeProduK})`;
          
          const teksHasil = `✅ <b>Harga markup berhasil disimpan!</b>\n\n` +
            `📦 Produk: ${displayName}\n` +
            `💸 Harga API: <code>Rp. ${state.hargaAPI ? state.hargaAPI.toLocaleString('id-ID') : 'N/A'}</code>\n` +
            `💰 Harga Markup: <code>Rp. ${hargaBaru.toLocaleString('id-ID')}</code>\n` +
            `🔧 Database: Tabel produk_dinamis`;
          
          if (state.inputMessageId) {
            try {
              await bot.editMessageText(teksHasil, {
                chat_id: chatId,
                message_id: state.inputMessageId,
                parse_mode: 'HTML'
              });
            } catch (e) {
              await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
            }
          } else {
            await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
          }
          
          // Auto delete dengan exiter autoDeleteMessage (3 detik)
          autoDeleteMessage(bot, chatId, state.inputMessageId, 3000);
          
          adminState.delete(chatId);
          autoDeleteMessage(bot, chatId, msg.message_id, 100);
          return;
        } catch (e) {
          await bot.sendMessage(chatId, `❌ Gagal menyimpan harga markup: ${e.message}`);
          adminState.delete(chatId);
          autoDeleteMessage(bot, chatId, msg.message_id, 100);
          return;
        }
      } else if (state.kategori.startsWith('global_')) {
        // Cek apakah ini dynamic product atau legacy
        if (state.kodeProduK && state.namaProduK) {
          // Dynamic global bulanan: global_xla14 -> harga_xla14 (simpan tanpa prefix global)
          key = `harga_${state.kodeProduK.toLowerCase()}`;
          jenisText = `GLOBAL BULANAN`;
          displayName = `${state.namaProduK} (${state.kodeProduK})`;
        } else {
          // Legacy global bulanan: global_supermini -> harga_global_supermini
          const paket = state.kategori.replace('global_', '');
          key = `harga_global_${paket}`;
          jenisText = `GLOBAL BULANAN`;
          displayName = paket.toUpperCase();
        }
      } else if (state.kategori.startsWith('bekasan_global_')) {
        // Global bekasan: bekasan_global_l_3h -> harga_bekasan_global_l_3h
        key = `harga_${state.kategori}`;
        jenisText = `GLOBAL BEKASAN`;
        displayName = state.kategori.replace(/^(global_|bekasan_global_)/, '').toUpperCase();
      } else if (/^\d+h$/i.test(state.kategori)) {
        // Bekasan reguler: 3h -> harga_3h
        key = `harga_${state.kategori.toLowerCase()}`;
        jenisText = `BEKASAN`;
        displayName = state.kategori.toUpperCase();
      } else {
        // Bulanan reguler: supermini -> harga_supermini
        key = `harga_${state.kategori.toLowerCase()}`;
        jenisText = `BULANAN`;
        displayName = state.kategori.toUpperCase();
      }
      
      await setKonfigurasi(key, hargaBaru.toString());
      
      const teksHasil = `✅ <b>Harga berhasil diubah!</b>\n\n` +
        `📦 Paket: ${jenisText} ${displayName}\n` +
        `💰 Harga baru: <code>Rp. ${hargaBaru.toLocaleString('id-ID')}</code>\n` +
        `🔑 Database Key: <code>${key}</code>`;
      
      if (state.inputMessageId) {
        try {
          await bot.editMessageText(teksHasil, {
            chat_id: chatId,
            message_id: state.inputMessageId,
            parse_mode: 'HTML'
          });
        } catch (e) {
          await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
        }
      } else {
        await bot.sendMessage(chatId, teksHasil, { parse_mode: 'HTML' });
      }
      
      // Auto delete dengan exiter autoDeleteMessage (3 detik)
      autoDeleteMessage(bot, chatId, state.inputMessageId, 3000);
      
      adminState.delete(chatId);
      autoDeleteMessage(bot, chatId, msg.message_id, 100);
      
    } catch (e) {
      const teksError = `❌ Gagal menyimpan harga: ${e.message}`;
      
      if (state.inputMessageId) {
        try {
          await bot.editMessageText(teksError, {
            chat_id: chatId,
            message_id: state.inputMessageId
          });
        } catch (e) {
          await bot.sendMessage(chatId, teksError);
        }
      } else {
        await bot.sendMessage(chatId, teksError);
      }
      
      adminState.delete(chatId);
      autoDeleteMessage(bot, chatId, msg.message_id, 100);
    }
  });
};
