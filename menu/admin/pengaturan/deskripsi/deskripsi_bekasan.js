const { getDeskripsiPaket, setKonfigurasi } = require('../../../../db');
// Import Input Exiter utilities untuk modern pattern
const { sendStyledInputMessage, autoDeleteMessage, EXIT_KEYWORDS } = require('../../../../utils/exiter');

// === PRELOAD KEYBOARDS ===
const DESKRIPSI_BEKASAN_KEYBOARD = [
  [{ text: 'BEKASAN 3H', callback_data: 'edit_desk_3h' }],
  [{ text: 'BEKASAN 4H', callback_data: 'edit_desk_4h' }],
  [{ text: 'BEKASAN 5H', callback_data: 'edit_desk_5h' }],
  [{ text: 'BEKASAN 6H', callback_data: 'edit_desk_6h' }],
  [{ text: 'BEKASAN 7H', callback_data: 'edit_desk_7h' }],
  [{ text: 'BEKASAN 8H', callback_data: 'edit_desk_8h' }],
  [{ text: 'BEKASAN 9H', callback_data: 'edit_desk_9h' }],
  [{ text: 'BEKASAN 10H', callback_data: 'edit_desk_10h' }],
  [{ text: '🔙 KEMBALI', callback_data: 'atur_deskripsi' }]
];

const KUOTA_BEKASAN_KEYBOARD = [
  [
    { text: 'DETAIL L', callback_data: 'set_kuota_bekasan_L_' }
  ],
  [
    { text: 'DETAIL XL', callback_data: 'set_kuota_bekasan_XL_' }
  ],
  [
    { text: 'DETAIL XXL', callback_data: 'set_kuota_bekasan_XXL_' }
  ],
  [
    { text: '✏️ INPUT MANUAL', callback_data: 'manual_bekasan_' }
  ],
  [
    { text: '🔙 KEMBALI', callback_data: 'deskripsi_bekasan' }
  ]
];

const KEMBALI_BEKASAN_KEYBOARD = [
  [{ text: '🔙 KEMBALI', callback_data: 'deskripsi_bekasan' }]
];

// === PRELOAD CONTENT ===
const DESKRIPSI_BEKASAN_CONTENT = '📝 <b>ATUR DESKRIPSI BEKASAN</b>\n\nPilih paket bekasan yang ingin diubah deskripsinya:';

// === TEMPLATE GENERATORS ===
const generateKuotaSelectionContent = (kategori, deskSekarang) => {
  return `📝 <b>EDIT DESKRIPSI BEKASAN ${kategori}</b>\n\n` +
    `⚡ <b>Paket:</b> BEKASAN ${kategori}\n` +
    `📋 <b>Deskripsi saat ini:</b>\n<code>${deskSekarang}</code>\n\n` +
    `🎯 <b>Pilih tipe kuota atau input manual:</b>`;
};

const generateManualInputForm = (kategori, deskSekarang) => {
  const mainText = `📝 INPUT MANUAL DESKRIPSI BEKASAN ${kategori}\n\nDeskripsi saat ini:\n${deskSekarang}`;
  const subtitle = `Masukkan deskripsi baru secara manual:\n💡 Gunakan \\n untuk baris baru`;
  
  return { mainText, subtitle };
};

const generateKuotaKeyboard = (kategori) => {
  return [
    [
      { text: 'DETAIL L', callback_data: `set_kuota_bekasan_L_${kategori}` }
    ],
    [
      { text: 'DETAIL XL', callback_data: `set_kuota_bekasan_XL_${kategori}` }
    ],
    [
      { text: 'DETAIL XXL', callback_data: `set_kuota_bekasan_XXL_${kategori}` }
    ],
    [
      { text: '✏️ INPUT MANUAL', callback_data: `manual_bekasan_${kategori}` }
    ],
    [
      { text: '🔙 KEMBALI', callback_data: 'deskripsi_bekasan' }
    ]
  ];
};

const adminState = new Map();

// === MAPPING DETAIL KUOTA BEKASAN ===
const kuotaMapping = {
  'L': {
    name: 'L',
    areas: {
      'AREA 1': '8 GB',
      'AREA 2': '10 GB', 
      'AREA 3': '15 GB',
      'AREA 4': '25 GB'
    }
  },
  'XL': {
    name: 'XL',
    areas: {
      'AREA 1': '1,5 GB',
      'AREA 2': '4,5 GB',
      'AREA 3': '15 GB', 
      'AREA 4': '39 GB'
    }
  },
  'XXL': {
    name: 'XXL',
    areas: {
      'AREA 1': '7,5 GB',
      'AREA 2': '12 GB',
      'AREA 3': '25 GB',
      'AREA 4': '65 GB'
    }
  }
};

// Function untuk generate deskripsi dari mapping
const generateDeskripsi = (tipeKuota) => {
  const mapping = kuotaMapping[tipeKuota];
  if (!mapping) return '';
  
  let deskripsi = `DETAIL ${mapping.name}\n`;
  Object.entries(mapping.areas).forEach(([area, kuota]) => {
    deskripsi += `${area} = ${kuota}\n`;
  });
  
  return deskripsi.trim();
};

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const msgId = message?.message_id;

    // === DESKRIPSI BEKASAN ===
    if (data === 'deskripsi_bekasan') {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }

      try {
        if (message.caption) {
          await bot.editMessageCaption(DESKRIPSI_BEKASAN_CONTENT, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: DESKRIPSI_BEKASAN_KEYBOARD }
          });
        } else {
          await bot.editMessageText(DESKRIPSI_BEKASAN_CONTENT, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: DESKRIPSI_BEKASAN_KEYBOARD }
          });
        }
      } catch (error) {
        if (error.message.includes('message is not modified')) {
          return bot.answerCallbackQuery(id, {
            text: '✅ Menu sudah aktif.',
            show_alert: false
          });
        }
        console.error('Error editing deskripsi_bekasan:', error.message);
      }

      await bot.answerCallbackQuery(id);
      return;
    }

    // === EDIT DESKRIPSI SPESIFIK BEKASAN ===
    if (/^edit_desk_\d+h$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const kategori = data.split('_')[2].toUpperCase();
      
      try {
        const deskSekarang = await getDeskripsiPaket(kategori);
        
        // Set state untuk memilih tipe kuota
        adminState.set(chatId, { 
          mode: 'pilih_tipe_kuota_bekasan', 
          kategori: kategori,
          jenis: 'BEKASAN',
          deskripsiLama: deskSekarang
        });
        
        // Keyboard untuk memilih tipe kuota
        const kuotaKeyboard = generateKuotaKeyboard(kategori);
        
        const content = generateKuotaSelectionContent(kategori, deskSekarang);

        try {
          if (message.caption) {
            await bot.editMessageCaption(content, {
              chat_id: chatId,
              message_id: msgId,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: kuotaKeyboard }
            });
          } else {
            await bot.editMessageText(content, {
              chat_id: chatId,
              message_id: msgId,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: kuotaKeyboard }
            });
          }
        } catch (error) {
          if (error.message.includes('message is not modified')) {
            return bot.answerCallbackQuery(id, {
              text: '✅ Menu pilihan kuota aktif.',
              show_alert: false
            });
          }
          console.error('Error editing kuota selection:', error.message);
        }
        
      } catch (e) {
        console.error('Error loading bekasan description:', e);
        await bot.answerCallbackQuery(id, { text: '❌ Gagal memuat data bekasan.', show_alert: true });
      }
      
      await bot.answerCallbackQuery(id);
      return;
    }

    // === SET KUOTA OTOMATIS BEKASAN ===
    if (/^set_kuota_bekasan_(L|XL|XXL)_\d+h$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      // Fix parsing: set_kuota_bekasan_L_3h -> ['set', 'kuota', 'bekasan', 'L', '3h']
      const parts = data.split('_');
      const tipeKuota = parts[3]; // L, XL, or XXL
      const kategori = parts[4]; // 3h, 4h, etc
      
      try {
        // Generate deskripsi otomatis dari mapping
        const deskripsiOtomatis = generateDeskripsi(tipeKuota.toUpperCase());
        
        // Simpan ke database
        const key = `deskripsi_${kategori.toLowerCase()}`;
        await setKonfigurasi(key, deskripsiOtomatis);
        
        const teksHasil = `✅ <b>Deskripsi Bekasan Berhasil Diset Otomatis!</b>\n\n` +
          `⚡ <b>Paket:</b> BEKASAN ${kategori.toUpperCase()}\n` +
          `📱 <b>Tipe:</b> ${kuotaMapping[tipeKuota.toUpperCase()].name}\n` +
          `🔑 <b>Key:</b> <code>${key}</code>\n\n` +
          `📝 <b>Deskripsi yang diset:</b>\n<code>${deskripsiOtomatis}</code>\n\n` +
          `🤖 Data diambil dari mapping otomatis\n` +
          `💾 Berhasil disimpan ke database`;

        try {
          if (message.caption) {
            await bot.editMessageCaption(teksHasil, {
              chat_id: chatId,
              message_id: msgId,
              parse_mode: 'HTML',
              reply_markup: { 
                inline_keyboard: KEMBALI_BEKASAN_KEYBOARD
              }
            });
          } else {
            await bot.editMessageText(teksHasil, {
              chat_id: chatId,
              message_id: msgId,
              parse_mode: 'HTML',
              reply_markup: { 
                inline_keyboard: KEMBALI_BEKASAN_KEYBOARD
              }
            });
          }
        } catch (error) {
          await bot.sendMessage(chatId, teksHasil, { 
            parse_mode: 'HTML',
            reply_markup: { 
              inline_keyboard: KEMBALI_BEKASAN_KEYBOARD
            }
          });
        }
        
        // Clean state
        adminState.delete(chatId);
        
      } catch (e) {
        console.error('Error setting auto kuota bekasan:', e);
        await bot.answerCallbackQuery(id, { text: '❌ Gagal menyimpan kuota otomatis!', show_alert: true });
      }
      
      await bot.answerCallbackQuery(id);
      return;
    }

    // === INPUT MANUAL BEKASAN ===
    if (/^manual_bekasan_\d+h$/i.test(data)) {
      if (from.id.toString() !== process.env.ADMIN_ID) {
        return bot.answerCallbackQuery(id, { text: 'ente mau ngapain wak🗿', show_alert: true });
      }
      
      const kategori = data.split('_')[2].toUpperCase();
      
      try {
        const deskSekarang = await getDeskripsiPaket(kategori);
        
        adminState.set(chatId, { 
          mode: 'edit_deskripsi_bekasan', 
          kategori: kategori,
          jenis: 'BEKASAN'
        });
        
        const { mainText, subtitle } = generateManualInputForm(kategori, deskSekarang);
        const inputMsg = await sendStyledInputMessage(bot, chatId, mainText, subtitle, 'membatalkan');
        
        const currentState = adminState.get(chatId);
        currentState.inputMessageId = inputMsg.message_id;
        adminState.set(chatId, currentState);
        
      } catch (e) {
        console.error('Error loading manual bekasan input:', e);
        await bot.answerCallbackQuery(id, { text: '❌ Gagal memuat input manual.', show_alert: true });
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
    if (!state || state.mode !== 'edit_deskripsi_bekasan') return;

    // === CEK CANCEL/EXIT dengan modern EXIT_KEYWORDS ===
    if (EXIT_KEYWORDS.COMBINED.includes(msg.text.trim())) {
      if (state.inputMessageId) {
        autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
      }
      
      adminState.delete(chatId);
      autoDeleteMessage(bot, chatId, msg.message_id, 100);
      return;
    }

    // === PROSES SIMPAN DESKRIPSI BEKASAN ===
    try {
      const deskripsiBaru = msg.text.trim().replace(/\\n/g, '\n');
      
      // Validasi input tidak kosong
      if (!deskripsiBaru) {
        await bot.sendMessage(chatId, '❌ <b>Deskripsi tidak boleh kosong!</b>\n\n⚡ Silakan masukkan deskripsi yang valid.', {
          parse_mode: 'HTML'
        });
        autoDeleteMessage(bot, chatId, msg.message_id, 100);
        return;
      }
      
      const key = `deskripsi_${state.kategori.toLowerCase()}`;
      await setKonfigurasi(key, deskripsiBaru);
      
      const teksHasil = `✅ <b>Deskripsi Bekasan Berhasil Diubah!</b>\n\n` +
        `⚡ <b>Paket:</b> BEKASAN ${state.kategori.toUpperCase()}\n` +
        `🔑 <b>Key:</b> <code>${key}</code>\n` +
        `📝 <b>Deskripsi baru:</b>\n<code>${deskripsiBaru}</code>\n\n` +
        `💾 Data telah disimpan ke database`;
      
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
      
      adminState.delete(chatId);
      autoDeleteMessage(bot, chatId, msg.message_id, 100);
      
      // Auto delete dengan exiter autoDeleteMessage (5 detik)
      autoDeleteMessage(bot, chatId, state.inputMessageId, 5000);
      
    } catch (e) {
      console.error('Error saving bekasan description:', e);
      const teksError = `❌ <b>Gagal menyimpan deskripsi bekasan!</b>\n\n` +
        `⚡ <b>Paket:</b> BEKASAN ${state.kategori.toUpperCase()}\n` +
        `🔍 <b>Detail Error:</b>\n<code>${e.message}</code>\n\n` +
        `💡 Silakan coba lagi atau hubungi developer`;
      
      if (state.inputMessageId) {
        try {
          await bot.editMessageText(teksError, {
            chat_id: chatId,
            message_id: state.inputMessageId,
            parse_mode: 'HTML'
          });
        } catch (e) {
          await bot.sendMessage(chatId, teksError, { parse_mode: 'HTML' });
        }
      } else {
        await bot.sendMessage(chatId, teksError, { parse_mode: 'HTML' });
      }
      
      adminState.delete(chatId);
      autoDeleteMessage(bot, chatId, msg.message_id, 100);
    }
  });
};

/*
=== MAPPING DETAIL KUOTA PAKET BEKASAN ===

DETAIL (L)
AREA 1 = 8 GB
AREA 2 = 10 GB
AREA 3 = 15 GB
AREA 4 = 25 GB

DETAIL (XL)
AREA 1 = 1,5 GB
AREA 2 = 4,5 GB
AREA 3 = 15 GB
AREA 4 = 39 GB

DETAIL (XXL)
AREA 1 = 7,5 GB
AREA 2 = 12 GB
AREA 3 = 25 GB
AREA 4 = 65 GB
*/