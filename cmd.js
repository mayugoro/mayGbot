module.exports = (bot) => {
  // Function untuk menampilkan command list
  const showCommandList = async (msg) => {
    if (msg.from.id.toString() !== process.env.ADMIN_ID) {
      await bot.sendMessage(msg.chat.id, 'ente siapa njir🗿');
      // Auto-delete command message
      setTimeout(async () => {
        try {
          await bot.deleteMessage(msg.chat.id, msg.message_id);
        } catch (e) {}
      }, 1000);
      return;
    }
    
    const commandList = `✨ <b>DAFTAR COMMAND BOT</b> ✨\n\n` +
      `🔹 <b>SEMUA COMMAND:</b>\n\n` +
      `• <code>/start</code> - Memulai bot ini\n` +
      `• <code>/menu</code> - Lihat menu dari bot\n` +
      `• <code>/getalluser</code> - Lihat semua user terdaftar\n` +
      `• <code>/trx </code> - Lihat TRX user, cara trx + ID\n` +
      `• <code>/allstok</code> - Lihat semua pengelola tersedia\n` +
      `• <code>/broadcast</code> - Kirim pesan ke semua user\n` +
      `• <code>/kickanggota</code> - Kick nomor dari grup\n` +
      `• <code>/setbanner</code> - Ganti banner welcome\n\n` +
      
      `📝 <i>Tampilan ini akan hilang dalam 1 menit</i>`;

    const sentMessage = await bot.sendMessage(msg.chat.id, commandList, {
      parse_mode: 'HTML'
    });

    // Auto-delete command message setelah respons dikirim
    setTimeout(async () => {
      try {
        await bot.deleteMessage(msg.chat.id, msg.message_id);
      } catch (e) {
        // Ignore delete error
      }
    }, 1000);

    // Auto-delete response message setelah 1 menit
    setTimeout(async () => {
      try {
        await bot.deleteMessage(msg.chat.id, sentMessage.message_id);
      } catch (e) {
        // Ignore delete error jika sudah dihapus manual
      }
    }, 60000); // 1 menit
  };

  // === /cmd (dengan slash) ===
  bot.onText(/\/cmd/, showCommandList);

  // === cmd (tanpa slash) ===
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    
    // Cek apakah pesan adalah tepat "cmd" (case insensitive)
    const text = msg.text.trim();
    if (['cmd', 'CMD', 'Cmd'].includes(text)) {
      await showCommandList(msg);
    }
  });
};
