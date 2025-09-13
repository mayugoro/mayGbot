/**
 * Utility untuk mengelola flow sendMessage dengan exit functionality
 * Template reusable untuk pattern exit yang konsisten di seluruh bot
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
    // Hapus result message jika ada
    if (state.resultMessageId) {
      try {
        await bot.deleteMessage(chatId, state.resultMessageId);
      } catch (e) {
        // Ignore delete error
      }
    }
    
    // Hapus user message
    try {
      await bot.deleteMessage(chatId, msg.message_id);
    } catch (e) {
      // Ignore delete error
    }
    
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
  return `💡 Ketik <b>"${exitKeyword}"</b> untuk keluar dari tampilan ini`;
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
  sendMessageWithTracking,
  handleFlowWithExit,
  generateExitInstruction,
  initializeFlowState
};

// Export constants untuk consistent exit keywords
module.exports.EXIT_KEYWORDS = {
  STANDARD: ['exit', 'EXIT', 'Exit'],
  KELUAR: ['keluar', 'KELUAR', 'Keluar'],
  BATAL: ['batal', 'BATAL', 'Batal'],
  STOP: ['stop', 'STOP', 'Stop'],
  COMBINED: ['exit', 'EXIT', 'Exit', 'keluar', 'KELUAR', 'Keluar', 'batal', 'BATAL', 'Batal']
};