/**
 * EXITER - Utility untuk mengelola exit flow dengan functionality yang konsisten
 * Template reusable untuk pattern exit yang konsisten di seluruh bot
 * 
 * 🚪 Handles all exit scenarios with style!
 * 💫 Consistent exit behavior across all bot features
 * 🎯 Smart exit detection with multiple keywords support
 */

/**
 * Menangani exit flow untuk message yang dikirim dengan pattern yang konsisten
 * @param {Object} bot - Bot instance
 * @param {Object} msg - Message object dari Telegram
 * @param {Map} stateMap - Map untuk tracking state (contoh: adminState)
 * @param {string} chatId - Chat ID
 * @param {Object} state - Current state object
 * @param {Array} exitKeywords - Array kata kunci untuk exit (default: ['exit', 'EXIT', 'Exit'])
 * @returns {boolean} - true jika message adalah exit command dan sudah diproses, false jika bukan
 */
const handleExitFlow = async (bot, msg, stateMap, chatId, state, exitKeywords = ['exit', 'EXIT', 'Exit']) => {
  // Pastikan ada text message
  if (!msg.text) return false;
  
  const text = msg.text.trim();
  
  // Cek apakah input adalah exit command
  if (exitKeywords.includes(text)) {
    // Hapus result/input message jika ada dengan autoDeleteMessage (non-sequential)
    if (state.resultMessageId) {
      autoDeleteMessage(bot, chatId, state.resultMessageId, 100);
    }
    if (state.inputMessageId) {
      autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
    }
    
    // Hapus user message dengan delay kecil agar bersamaan
    autoDeleteMessage(bot, chatId, msg.message_id, 100);
    
    // Clear state
    stateMap.delete(chatId);
    return true; // Exit command berhasil diproses
  }
  
  return false; // Bukan exit command
};

/**
 * Menangani cleanup untuk input non-exit dalam flow mode
 * @param {Object} bot - Bot instance
 * @param {Object} msg - Message object dari Telegram
 * @param {string} chatId - Chat ID
 * @param {boolean} keepResult - Apakah result message tetap tampil (default: true)
 */
const handleNonExitInput = async (bot, msg, chatId, keepResult = true) => {
  // Untuk input lainnya, hapus message user (biarkan result tetap tampil jika keepResult = true)
  try {
    await bot.deleteMessage(chatId, msg.message_id);
  } catch (e) {
    // Ignore delete error
  }
};

/**
 * Auto-delete command message dengan delay
 * @param {Object} bot - Bot instance
 * @param {string} chatId - Chat ID
 * @param {number} messageId - Message ID yang akan dihapus
 * @param {number} delay - Delay dalam milliseconds (default: 1000)
 */
const autoDeleteMessage = async (bot, chatId, messageId, delay = 1000) => {
  setTimeout(async () => {
    try {
      await bot.deleteMessage(chatId, messageId);
    } catch (e) {
      // Ignore delete error
    }
  }, delay);
};

/**
 * Auto-delete multiple messages secara bersamaan (non-sequential)
 * @param {Object} bot - Bot instance
 * @param {string} chatId - Chat ID
 * @param {Array} messageIds - Array of message IDs yang akan dihapus
 * @param {number} delay - Delay dalam milliseconds (default: 100)
 */
const autoDeleteMultipleMessages = async (bot, chatId, messageIds, delay = 100) => {
  if (!Array.isArray(messageIds) || messageIds.length === 0) return;
  
  // Hapus semua messages dengan delay yang sama agar terlihat bersamaan
  messageIds.forEach(messageId => {
    if (messageId) {
      autoDeleteMessage(bot, chatId, messageId, delay);
    }
  });
};

/**
 * Handle exit dengan auto-delete bersamaan untuk exiter dan target messages
 * @param {Object} bot - Bot instance
 * @param {Object} msg - Message object dari user
 * @param {string} chatId - Chat ID
 * @param {Object} state - Current state object
 * @param {Array} exitKeywords - Exit keywords (default: EXIT_KEYWORDS.COMBINED)
 * @returns {boolean} - true jika exit berhasil diproses
 */
const handleExitWithAutoDelete = async (bot, msg, chatId, state, exitKeywords = null) => {
  if (!msg.text) return false;
  
  // Default menggunakan EXIT_KEYWORDS.COMBINED jika tidak disediakan
  const keywords = exitKeywords || module.exports.EXIT_KEYWORDS.COMBINED;
  
  if (keywords.includes(msg.text.trim())) {
    // Kumpulkan semua message IDs yang perlu dihapus
    const messagesToDelete = [msg.message_id]; // User message
    
    if (state.inputMessageId) {
      messagesToDelete.push(state.inputMessageId);
    }
    if (state.resultMessageId) {
      messagesToDelete.push(state.resultMessageId);
    }
    
    // Hapus semua messages secara bersamaan
    autoDeleteMultipleMessages(bot, chatId, messagesToDelete, 100);
    
    return true; // Exit berhasil diproses
  }
  
  return false; // Bukan exit command
};

/**
 * Kirim message dengan auto-delete dan tracking state
 * @param {Object} bot - Bot instance
 * @param {string} chatId - Chat ID
 * @param {string} content - Content message
 * @param {Object} options - Send message options
 * @param {Map} stateMap - State map untuk tracking
 * @param {Object} currentState - Current state object
 * @param {Object} originalMsg - Original message untuk auto-delete
 * @returns {Object} - Sent message object
 */
const sendMessageWithTracking = async (bot, chatId, content, options, stateMap, currentState, originalMsg) => {
  // Kirim output
  const resultMsg = await bot.sendMessage(chatId, content, options);
  
  // Auto-delete command message setelah respons dikirim
  if (originalMsg) {
    autoDeleteMessage(bot, chatId, originalMsg.message_id);
  }
  
  // Update state dengan message ID untuk tracking
  if (stateMap && currentState) {
    currentState.resultMessageId = resultMsg.message_id;
    stateMap.set(chatId, currentState);
  }
  
  return resultMsg;
};

/**
 * Template complete untuk flow dengan exit functionality
 * @param {Object} bot - Bot instance
 * @param {Object} msg - Message object
 * @param {Map} stateMap - State management map
 * @param {string} flowMode - Mode name untuk state tracking
 * @param {Array} exitKeywords - Custom exit keywords (optional)
 * @returns {Object} - Flow control object { isExit: boolean, shouldContinue: boolean }
 */
const handleFlowWithExit = async (bot, msg, stateMap, flowMode, exitKeywords = ['exit', 'EXIT', 'Exit']) => {
  const chatId = msg.chat.id;
  const state = stateMap.get(chatId);
  
  // Jika sedang dalam flow mode yang ditentukan
  if (state && state.mode === flowMode) {
    // Handle exit flow
    const isExitCommand = await handleExitFlow(bot, msg, stateMap, chatId, state, exitKeywords);
    
    if (isExitCommand) {
      return { isExit: true, shouldContinue: false };
    }
    
    // Handle non-exit input (cleanup user message)
    await handleNonExitInput(bot, msg, chatId);
    return { isExit: false, shouldContinue: false }; // Stop processing, tapi bukan exit
  }
  
  return { isExit: false, shouldContinue: true }; // Lanjutkan processing normal
};

/**
 * Generate standard exit instruction text
 * @param {string} exitKeyword - Kata kunci exit (default: 'exit')
 * @returns {string} - Exit instruction text
 */
const generateExitInstruction = (exitKeyword = 'exit') => {
  return `<i>💡 Ketik "${exitKeyword}" untuk keluar dari tampilan ini</i>`;
};

/**
 * Generate styled input message dengan italic dan exit instruction (seperti pattern cekpulsa.js)
 * @param {string} mainText - Text utama untuk input (misal: "📱 Masukkan nomor untuk cek pulsa . . .")
 * @param {string} subtitle - Subtitle atau instruction tambahan (misal: "Bisa massal, pisahkan dengan Enter.")
 * @param {string} exitText - Custom exit text (default: "membatalkan")
 * @returns {string} - Styled input message dengan format italic lengkap
 */
const generateStyledInputMessage = (mainText, subtitle = '', exitText = 'membatalkan') => {
  let message = `<i>${mainText}`;
  
  if (subtitle) {
    message += `\n${subtitle}`;
  }
  
  message += `\n\n💡 Ketik "exit" untuk ${exitText}</i>`;
  
  return message;
};

/**
 * Kirim styled input message dengan tracking dan exiter support
 * @param {Object} bot - Bot instance
 * @param {string} chatId - Chat ID
 * @param {string} mainText - Text utama untuk input
 * @param {string} subtitle - Subtitle atau instruction tambahan
 * @param {string} exitText - Custom exit text (default: "membatalkan")
 * @param {Object} options - Additional send message options
 * @returns {Object} - Sent message object
 */
const sendStyledInputMessage = async (bot, chatId, mainText, subtitle = '', exitText = 'membatalkan', options = {}) => {
  const styledMessage = generateStyledInputMessage(mainText, subtitle, exitText);
  
  const defaultOptions = { parse_mode: 'HTML' };
  const finalOptions = { ...defaultOptions, ...options };
  
  return await sendMessageWithTracking(bot, chatId, styledMessage, finalOptions);
};

/**
 * Handle exit untuk step-by-step flow (tidak mengganggu logika flow)
 * Fungsi ini untuk digunakan di dalam setiap step, bukan di awal handler
 * @param {Object} bot - Bot instance
 * @param {Object} msg - Message object dari user
 * @param {string} chatId - Chat ID
 * @param {Object} state - Current state object
 * @param {Map} stateMap - State management map
 * @param {Array} exitKeywords - Exit keywords (default: EXIT_KEYWORDS.COMBINED)
 * @returns {boolean} - true jika exit berhasil diproses, false jika bukan exit
 */
const handleStepByStepExit = async (bot, msg, chatId, state, stateMap, exitKeywords = null) => {
  if (!msg.text) return false;
  
  // Default menggunakan EXIT_KEYWORDS.COMBINED jika tidak disediakan
  const keywords = exitKeywords || module.exports.EXIT_KEYWORDS.COMBINED;
  
  if (keywords.includes(msg.text.trim())) {
    // Hapus input message dan user message dengan delay 100ms untuk smooth effect
    if (state.inputMessageId) {
      autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
    }
    autoDeleteMessage(bot, chatId, msg.message_id, 100);
    
    // Clear state dari map
    stateMap.delete(chatId);
    
    return true; // Exit berhasil diproses
  }
  
  return false; // Bukan exit command
};

/**
 * Template untuk step dalam step-by-step flow dengan built-in exit handling
 * Digunakan untuk setiap step dalam multi-step flow
 * @param {Object} bot - Bot instance
 * @param {Object} msg - Message object
 * @param {string} chatId - Chat ID
 * @param {Object} state - Current state object
 * @param {Map} stateMap - State management map
 * @param {string} currentStep - Current step name untuk validasi
 * @param {Function} stepLogic - Function yang berisi logika step (akan dipanggil jika bukan exit)
 * @param {Array} exitKeywords - Custom exit keywords (optional)
 * @returns {boolean} - true jika step selesai diproses (exit atau logic), false jika bukan step ini
 */
const handleStepWithExit = async (bot, msg, chatId, state, stateMap, currentStep, stepLogic, exitKeywords = null) => {
  // Pastikan ini adalah step yang benar
  if (!state || state.step !== currentStep) return false;
  
  // Handle exit untuk step ini
  if (await handleStepByStepExit(bot, msg, chatId, state, stateMap, exitKeywords)) {
    return true; // Exit berhasil diproses
  }
  
  // Jika bukan exit, jalankan logika step
  if (typeof stepLogic === 'function') {
    await stepLogic();
  }
  
  return true; // Step selesai diproses
};

/**
 * Utility untuk transisi antar step dengan smooth message cleanup
 * @param {Object} bot - Bot instance
 * @param {string} chatId - Chat ID
 * @param {Object} state - Current state object
 * @param {Map} stateMap - State management map
 * @param {Object} msg - User message object
 * @param {string} nextStep - Next step name
 * @param {string} mainText - Main text untuk input step berikutnya
 * @param {string} subtitle - Subtitle untuk input step berikutnya
 * @param {string} exitText - Custom exit text (default: "membatalkan")
 */
const transitionToNextStep = async (bot, chatId, state, stateMap, msg, nextStep, mainText, subtitle = '', exitText = 'membatalkan') => {
  // Update state ke step berikutnya
  state.step = nextStep;
  stateMap.set(chatId, state);
  
  // Hapus pesan sebelumnya dengan smooth delete
  autoDeleteMessage(bot, chatId, state.inputMessageId, 100);
  autoDeleteMessage(bot, chatId, msg.message_id, 100);
  
  // Kirim input form untuk step berikutnya
  const nextInputMsg = await sendStyledInputMessage(bot, chatId, mainText, subtitle, exitText);
  state.inputMessageId = nextInputMsg.message_id;
  stateMap.set(chatId, state);
};

/**
 * Inisialisasi flow state
 * @param {Map} stateMap - State management map
 * @param {string} chatId - Chat ID
 * @param {string} mode - Flow mode name
 * @param {Object} additionalData - Data tambahan untuk state (optional)
 */
const initializeFlowState = (stateMap, chatId, mode, additionalData = {}) => {
  stateMap.set(chatId, { 
    mode: mode,
    ...additionalData 
  });
};

module.exports = {
  handleExitFlow,
  handleNonExitInput,
  autoDeleteMessage,
  autoDeleteMultipleMessages,
  handleExitWithAutoDelete,
  handleStepByStepExit,
  handleStepWithExit,
  transitionToNextStep,
  sendMessageWithTracking,
  handleFlowWithExit,
  generateExitInstruction,
  generateStyledInputMessage,
  sendStyledInputMessage,
  initializeFlowState
};

// Export constants untuk consistent exit keywords
module.exports.EXIT_KEYWORDS = {
  STANDARD: ['exit', 'EXIT', 'Exit', 'c', 'C', 'x', 'X'],
  KELUAR: ['keluar', 'KELUAR', 'Keluar'],
  BATAL: ['batal', 'BATAL', 'Batal'],
  STOP: ['stop', 'STOP', 'Stop'],
  COMBINED: ['exit', 'EXIT', 'Exit', 'keluar', 'KELUAR', 'Keluar', 'batal', 'BATAL', 'Batal', 'c', 'C', 'x', 'X']
};