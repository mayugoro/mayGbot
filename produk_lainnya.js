// Handler untuk Paket Lainnya
const { getUserSaldo } = require('./db');

// Import all handlers
const api = require('./handler_produk/api');
const session = require('./handler_produk/session');
const payment = require('./handler_produk/payment');
const products = require('./handler_produk/products');
const messages = require('./handler_produk/messages');

// Fungsi format uptime (sama seperti main.js)
function formatUptime(ms) {
  let s = Math.floor(ms / 1000);
  const hari = Math.floor(s / 86400);
  s %= 86400;
  const jam = Math.floor(s / 3600);
  s %= 3600;
  const menit = Math.floor(s / 60);
  const detik = s % 60;
  let hasil = [];
  if (hari > 0) hasil.push(`${hari} hari`);
  if (jam > 0) hasil.push(`${jam} jam`);
  if (menit > 0) hasil.push(`${menit} menit`);
  if (detik > 0 || hasil.length === 0) hasil.push(`${detik} detik`);
  return hasil.join(' ');
}

// Template user detail (sama seperti main.js)
const generateUserDetail = (userId, username, saldo, uptime) => {
  return '💌 <b>ID</b>           : <code>' + userId + '</code>\n' +
         '💌 <b>User</b>       : <code>' + (username || '-') + '</code>\n' +
         '📧 <b>Saldo</b>     : <code>Rp. ' + saldo.toLocaleString('id-ID') + '</code>\n' +
         '⌚ <b>Uptime</b>  : <code>' + uptime + '</code>';
};

// Simpan waktu bot start (akan diambil dari main.js)
const BOT_START_TIME = Date.now();

// Fungsi untuk menampilkan daftar produk (dipanggil dari main.js)
async function showProductList(bot, chatId, messageId, userId, username) {
  try {
    // Ambil saldo user
    let saldo = 0;
    try {
      saldo = await getUserSaldo(userId, username);
    } catch (e) {}

    // Format uptime dan user detail
    const uptime = formatUptime(Date.now() - BOT_START_TIME);
    const userDetail = generateUserDetail(userId, username, saldo, uptime);

    // Buat keyboard produk sederhana (hanya nama produk)
    const productKeyboard = [
      [{ text: "OTP LOGIN", callback_data: "otp_login" }],
      [
        { text: "REGULER 1GB", callback_data: "detail_kuota_1gb" },
        { text: "REGULER 2.8GB", callback_data: "detail_kuota_2gb" }
      ],
      [
        { text: "Masaaktif 1 Bulan", callback_data: "detail_masa_1bulan" },
        { text: "Masaaktif 1 Tahun", callback_data: "detail_masa_1tahun" }
      ],
      [
        { text: "Xtra Combo Flex S", callback_data: "detail_xtra_flex" },
        { text: "AKRAB L 75GB", callback_data: "detail_akrab_kuber" }
      ],
      [
        { text: "🎓 Edukasi 2GB", callback_data: "detail_edukasi_2gb" }
      ],
      [
        { text: "🔙 Kembali", callback_data: "back_to_menu" }
      ]
    ];

    // Format teks produk
  const produkText = userDetail + '\n\n📦 <b>PILIH PRODUK:</b>\n\n' +
            '❗SEMUA PRODUK INI WAJIB OTP\nSILAHKAN GUNAKAN LOGIN OTP, BARU BISA MEMBELI PAKET👍🗿';

    // Edit message dengan daftar produk
    await bot.editMessageCaption(produkText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: productKeyboard
      }
    });

  } catch (error) {
    throw error; // Re-throw untuk ditangani di main.js
  }
}

module.exports = function(bot) {
  
  // Handle command /produk - DINONAKTIFKAN
  // Dipindah ke main.js pada callback paket_lainnya
  /*
  bot.onText(/\/produk/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Cek authorization
    if (!isAuthorized(userId)) {
      return bot.sendMessage(chatId, "ente siapa njir🗿");
    }

    try {
      // Ambil saldo user
      let saldo = 0;
      try {
        saldo = await getUserSaldo(userId, msg.from.username);
      } catch (e) {}

      // Format uptime dan user detail
      const uptime = formatUptime(Date.now() - BOT_START_TIME);
      const userDetail = generateUserDetail(userId, msg.from.username, saldo, uptime);

      // Buat keyboard produk sederhana (hanya nama produk)
      const productKeyboard = [
        [
          { text: "📱 Kuota Reguler 1 GB", callback_data: "detail_kuota_1gb" },
          { text: "📱 Kuota Reguler 2.8 GB", callback_data: "detail_kuota_2gb" }
        ],
        [
          { text: "⏰ Masaaktif 1 Bulan", callback_data: "detail_masa_1bulan" },
          { text: "⏰ Masaaktif 1 Tahun", callback_data: "detail_masa_1tahun" }
        ],
        [
          { text: "🎯 Xtra Combo Flex S", callback_data: "detail_xtra_flex" },
          { text: "👥 Akrab L Kuber 75GB", callback_data: "detail_akrab_kuber" }
        ],
        [
          { text: "🎓 Edukasi 2GB", callback_data: "detail_edukasi_2gb" }
        ],
        [
          { text: "🔙 Kembali", callback_data: "back_to_menu" }
        ]
      ];

      // Kirim pesan dengan user detail dan daftar produk
  const produkText = userDetail + '\n\n📦 <b>PILIH PRODUK:</b>\n\n' +
        '❗SEMUA PRODUK INI WAJIB OTP\nSILAHKAN GUNAKAN LOGIN OTP, BARU BISA MEMBELI PAKET👍🗿';

      await bot.sendPhoto(chatId, './welcome.jpg', {
        caption: produkText,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: productKeyboard
        }
      }, {
        filename: 'welcome.jpg',
        contentType: 'image/jpeg'
      });

      // Auto-delete command message
      setTimeout(async () => {
        try {
          await bot.deleteMessage(chatId, msg.message_id);
        } catch (e) {
          // Ignore delete error
        }
      }, 1000);

    } catch (error) {
      console.error('Error in /produk command:', error);
      
      const errorMsg = error.response?.data?.message || error.message || 'Terjadi kesalahan';
      
      try {
        await bot.sendMessage(chatId, `❌ <b>ERROR</b>\n\n🚫 ${errorMsg}`, {
          parse_mode: 'HTML'
        });
      } catch (e) {
        console.error('Error sending error message:', e);
      }
    }
  });
  */

  // Handle callback query untuk produk
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const messageId = message?.message_id;
    const userId = from?.id;

    // Handle detail produk callback
    const detailCallbacks = [
      "detail_kuota_1gb", "detail_kuota_2gb", "detail_masa_1bulan", 
      "detail_masa_1tahun", "detail_xtra_flex", "detail_akrab_kuber", "detail_edukasi_2gb"
    ];

    // Mapping detail callback ke produk info
    const detailMapping = {
      "detail_kuota_1gb": "beli_kuota_1gb",
      "detail_kuota_2gb": "beli_kuota_2gb", 
      "detail_masa_1bulan": "beli_masa_1bulan",
      "detail_masa_1tahun": "beli_masa_1tahun",
      "detail_xtra_flex": "beli_xtra_flex",
      "detail_akrab_kuber": "beli_akrab_kuber",
      "detail_edukasi_2gb": "beli_edukasi_2gb"
    };

    if (detailCallbacks.includes(data)) {
      try {
        // Ambil info produk
        const produkKey = detailMapping[data];
        const produkInfo = products.getProductInfo(produkKey);
        
        if (!produkInfo) {
          return bot.answerCallbackQuery(id, {
            text: "❌ Data produk tidak ditemukan",
            show_alert: true
          });
        }

        // Ambil saldo user untuk konsistensi
        let saldo = 0;
        try {
          saldo = await getUserSaldo(userId, from.username);
        } catch (e) {}

        const uptime = formatUptime(Date.now() - BOT_START_TIME);
        const userDetail = generateUserDetail(userId, from.username, saldo, uptime);

        // Format detail produk
        let detailText;
        if (produkInfo.customDetail) {
          // Use custom detail if available
          detailText = userDetail + '\n\n' +
                       `📦 <b>DETAIL PRODUK</b>\n\n` +
                       produkInfo.customDetail + '\n\n' +
                       `✅ Klik tombol di bawah untuk melanjutkan pembelian:`;
        } else {
          // Standard detail format
          detailText = userDetail + '\n\n' +
                       `📦 <b>DETAIL PRODUK</b>\n\n` +
                       `📱 <b>Nama:</b> ${produkInfo.nama}\n` +
                       `💰 <b>Harga:</b> ${produkInfo.harga}\n` +
                       `🔑 <b>Kode:</b> <code>${produkInfo.kode}</code>\n` +
                       `💳 <b>Payment:</b> ${produkInfo.payment}\n\n` +
                       `✅ Klik tombol di bawah untuk melanjutkan pembelian:`;
        }

        // Keyboard untuk melanjutkan atau kembali
        const detailKeyboard = [
          [
            { text: "🔙 KEMBALI", callback_data: "back_to_produk_list" },
            { text: "✅ LANJUT BELI", callback_data: `proses_${produkKey}` }
          ]
        ];

        // Edit message dengan detail produk
        await bot.editMessageCaption(detailText, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: detailKeyboard
          }
        });

        await bot.answerCallbackQuery(id);
        return;
      } catch (error) {
        console.error('Error showing product detail:', error);
        return bot.answerCallbackQuery(id, {
          text: "❌ Terjadi kesalahan saat menampilkan detail produk",
          show_alert: true
        });
      }
    }

    // Handle back to product list
    if (data === "back_to_produk_list") {
      try {
        // Ambil saldo user
        let saldo = 0;
        try {
          saldo = await getUserSaldo(userId, from.username);
        } catch (e) {}

        const uptime = formatUptime(Date.now() - BOT_START_TIME);
        const userDetail = generateUserDetail(userId, from.username, saldo, uptime);

        // Keyboard produk
        const productKeyboard = [
          [{ text: "OTP LOGIN", callback_data: "otp_login" }],
          [
            { text: "REGULER 1GB", callback_data: "detail_kuota_1gb" },
            { text: "REGULER 2.8GB", callback_data: "detail_kuota_2gb" }
          ],
          [
            { text: "Masaaktif 1 Bulan", callback_data: "detail_masa_1bulan" },
            { text: "Masaaktif 1 Tahun", callback_data: "detail_masa_1tahun" }
          ],
          [
            { text: "Xtra Combo Flex S", callback_data: "detail_xtra_flex" },
            { text: "AKRAB L 75GB", callback_data: "detail_akrab_kuber" }
          ],
          [
            { text: "🎓 Edukasi 2GB", callback_data: "detail_edukasi_2gb" }
          ],
          [
            { text: "🔙 Kembali", callback_data: "back_to_menu" }
          ]
        ];

  const produkText = userDetail + '\n\n📦 <b>PILIH PRODUK:</b>\n\n' +
        '❗SEMUA PRODUK INI WAJIB OTP\nSILAHKAN GUNAKAN LOGIN OTP, BARU BISA MEMBELI PAKET👍🗿';

        if (message && (message.caption || message.photo)) {
          await bot.editMessageCaption(produkText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: productKeyboard
            }
          });
        } else {
          await bot.editMessageText(produkText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: productKeyboard
            }
          });
        }

        await bot.answerCallbackQuery(id);
        return;
      } catch (error) {
        console.error('Error returning to product list:', error);
        return bot.answerCallbackQuery(id, {
          text: "❌ Terjadi kesalahan",
          show_alert: true
        });
      }
    }

    // Hanya handle callback query yang spesifik untuk produk lama
    const produkCallbacks = [
      "beli_kuota_1gb", "beli_kuota_2gb", "beli_masa_1bulan", 
      "beli_masa_1tahun", "beli_xtra_flex", "beli_akrab_kuber", "beli_edukasi_2gb",
      "back_to_produk"
    ];

    // Juga handle proses pembelian
    const isProcessCallback = data.startsWith('proses_beli_');

    // OTP LOGIN: delegate to handler module
    if (data === 'otp_login') {
      try {
    const otp = require('./handler_produk/menu_otp');
    await otp.showOtpMenu(bot, { chatId, messageId, message });

        await bot.answerCallbackQuery(id);
        return;
      } catch (error) {
        console.error('Error showing OTP LOGIN:', error);
        await bot.answerCallbackQuery(id, { text: '❌ Terjadi kesalahan', show_alert: true });
        return;
      }
    }

    // OTP: lanjut
    if (data === 'lanjut_otp') {
      try {
        const otp = require('./handler_produk/menu_otp');
        await otp.startOtpFlow(bot, { chatId });
        await bot.answerCallbackQuery(id);
        return;
      } catch (error) {
        console.error('Error starting OTP flow:', error);
        await bot.answerCallbackQuery(id, { text: '❌ Terjadi kesalahan', show_alert: true });
        return;
      }
    }

    if (!produkCallbacks.includes(data) && !isProcessCallback) {
      return; // Biarkan handler lain yang menangani
    }

    try {
      // Handle tombol KEMBALI ke daftar produk
      if (data === 'back_to_produk') {
        // Kembali ke daftar produk dari layar pemilihan pembayaran (text message) atau detail (caption)
        try {
          // Ambil saldo user untuk konsistensi tampilan
          let saldo = 0;
          try {
            saldo = await getUserSaldo(userId, from.username);
          } catch (e) {}

          const uptime = formatUptime(Date.now() - BOT_START_TIME);
          const userDetail = generateUserDetail(userId, from.username, saldo, uptime);

          // Keyboard produk
          const productKeyboard = [
            [{ text: "OTP LOGIN", callback_data: "otp_login" }],
            [
              { text: "REGULER 1GB", callback_data: "detail_kuota_1gb" },
              { text: "REGULER 2.8GB", callback_data: "detail_kuota_2gb" }
            ],
            [
              { text: "⏰ Masaaktif 1 Bulan", callback_data: "detail_masa_1bulan" },
              { text: "⏰ Masaaktif 1 Tahun", callback_data: "detail_masa_1tahun" }
            ],
            [
              { text: "🎯 Xtra Combo Flex S", callback_data: "detail_xtra_flex" },
              { text: "AKRAB L 75GB", callback_data: "detail_akrab_kuber" }
            ],
            [
              { text: "🎓 Edukasi 2GB", callback_data: "detail_edukasi_2gb" }
            ],
            [
              { text: "🔙 Kembali", callback_data: "back_to_menu" }
            ]
          ];

          const produkText = userDetail + '\n\n📦 <b>PILIH PRODUK:</b>\n\n' +
                            '❗SEMUA PRODUK INI WAJIB OTP\nSILAHKAN GUNAKAN LOGIN OTP, BARU BISA MEMBELI PAKET👍🗿';

          if (message && (message.caption || message.photo)) {
            await bot.editMessageCaption(produkText, {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: productKeyboard
              }
            });
          } else {
            await bot.editMessageText(produkText, {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: productKeyboard
              }
            });
          }

          await bot.answerCallbackQuery(id);
          return;

        } catch (error) {
          console.error('Error in back_to_produk:', error);
          await bot.answerCallbackQuery(id, {
            text: "Terjadi kesalahan saat kembali ke produk",
            show_alert: true
          });
          return;
        }
      }

      // Handle tombol LANJUT BELI - menggunakan handler messages.js
      if (data.startsWith('proses_beli_')) {
        const produkType = data.replace('proses_', ''); // dari proses_beli_kuota_1gb ke beli_kuota_1gb
        const produkInfo = products.getProductInfo(produkType);
        
        if (!produkInfo) {
          throw new Error('Produk tidak ditemukan');
        }

        // === VALIDASI SALDO KETAT SEBELUM LANJUT ===
        try {
          const saldoUser = await getUserSaldo(userId);
          // Extract harga produk dari string "Rp 500" menjadi angka 500
          const hargaString = produkInfo.harga.replace(/[^\d]/g, '');
          const hargaProduk = parseInt(hargaString) || 0;
          
          if (saldoUser < hargaProduk) {
            // Saldo tidak cukup, kirim alert dan jangan lanjutkan
            await bot.answerCallbackQuery(id, {
              text: "❗Saldo tidak cukup untuk melanjutkan proses!",
              show_alert: true
            });
            return;
          }
        } catch (saldoErr) {
          console.error('Error checking user balance:', saldoErr);
          await bot.answerCallbackQuery(id, {
            text: "❌ Gagal memverifikasi saldo. Silakan coba lagi.",
            show_alert: true
          });
          return;
        }

        // Set session untuk input nomor HP menggunakan handler session
        session.setInputSession(chatId, produkType, produkInfo.nama, messageId);

        // Gunakan handler messages untuk format input message
        const inputText = messages.formatInputMessage(produkInfo.nama);

        const inputMsg = await bot.sendMessage(chatId, inputText, {
          parse_mode: 'HTML'
        });

        // Update session dengan message ID input
        session.updateInputMessageId(chatId, inputMsg.message_id);

        await bot.answerCallbackQuery(id);
        return;
      }
      // Get product info
      const produkInfo = products.getProductInfo(data);
      
      if (!produkInfo) {
        throw new Error('Produk tidak ditemukan');
      }

      // Format pesan pembelian menggunakan handler messages
      const beliText = messages.formatPurchaseMessage(produkInfo);
      const beliKeyboard = messages.createPurchaseKeyboard(data);

      // Edit message caption (karena awalnya adalah photo)
      await bot.editMessageCaption(beliText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: beliKeyboard
        }
      });

      await bot.answerCallbackQuery(id);

    } catch (error) {
      console.error('Error in produk callback_query:', error);
      try {
        await bot.answerCallbackQuery(id, {
          text: "Terjadi kesalahan",
          show_alert: true
        });
      } catch (e) {
        console.error('Error answering callback query after error:', e);
      }
    }
  });

  // Handle callback query untuk pilihan metode pembayaran
  bot.on('callback_query', async (query) => {
    const { data, id, from, message } = query;
    const chatId = message?.chat?.id;
    const messageId = message?.message_id;
    const userId = from?.id;

    // Handle callback payment yang include nomor HP (legacy format)
    if (data.startsWith('payment_')) {
      try {
        // Parse: payment_beli_kuota_1gb_dana_08123456789
        const parts = data.split('_');
        const produkType = `${parts[1]}_${parts[2]}_${parts[3]}`; // beli_kuota_1gb
        const paymentMethod = parts[4]; // dana
        const nomorHP = parts[5]; // 08123456789
        
        // Proses pembelian menggunakan handler payment
        await payment.processPurchaseWithPhone(chatId, produkType, paymentMethod, nomorHP, bot, from.id);
        await bot.answerCallbackQuery(id);
        return;
        
      } catch (error) {
        console.error('Error in payment callback:', error);
        try {
          await bot.answerCallbackQuery(id, {
            text: "Terjadi kesalahan",
            show_alert: true
          });
        } catch (e) {
          console.error('Error answering callback query after error:', e);
        }
      }
      return;
    }

    // Handle callback payment Smart Payment Selector (new format)
    if (data.startsWith('pay_')) {
      try {
        // Parse: pay_shopeepay_beli_kuota_1gb_08123456789
        const parts = data.split('_');
        const paymentMethod = parts[1]; // shopeepay
        const produkType = `${parts[2]}_${parts[3]}_${parts[4]}`; // beli_kuota_1gb
        const nomorHP = parts[5]; // 08123456789
        
        // Proses pembelian menggunakan handler payment
        await payment.processPurchaseWithPhone(chatId, produkType, paymentMethod, nomorHP, bot, from.id);
        await bot.answerCallbackQuery(id);
        return;
        
      } catch (error) {
        console.error('Error in payment callback:', error);
        try {
          await bot.answerCallbackQuery(id, {
            text: "Terjadi kesalahan",
            show_alert: true
          });
        } catch (e) {
          console.error('Error answering callback query after error:', e);
        }
      }
      return;
    }
  });

  // Handle input message untuk nomor HP
  bot.on('message', async (msg) => {
    if (!msg || !msg.chat || !msg.from || !msg.text) return;
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text.trim();

    // Cek apakah user dalam session input nomor
    const sessionData = session.getSession(chatId);
    const otp = require('./handler_produk/menu_otp');

    // First, let OTP flow consume the message if there is an active OTP session
    await otp.handleMessage(bot, msg);

    // Then handle produk input nomor flow if applicable
    if (sessionData && sessionData.mode === 'input_nomor') {
      if (text.startsWith("/")) return;
      await session.handleInput(chatId, text, bot, payment);
    }
  });
};

// Export fungsi untuk digunakan di main.js
module.exports.showProductList = showProductList;
