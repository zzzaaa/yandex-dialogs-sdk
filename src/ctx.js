const ReplyBuilder = require('./replyBuilder')
const ButtonBuilder = require('./ButtonBuilder')

class Ctx {
  constructor({
    req,
  }) {
    this.req = req

    this.sessionId = req.session.session_id
    this.messageId = req.session.message_id
    this.userId = req.session.user_id
    this.payload = req.request.payload
    this.messsage = req.request.original_utterance

    this.replyBuilder = new ReplyBuilder(this.req)
    this.buttonBuilder = new ButtonBuilder()
  }

  async reply(replyMessage) {
    if (!replyMessage) {
      throw new Error('Reply message could not be empty!')
    }

    /*
     * Если @replyMessage — string,
     * то заворачиваем в стандартную форму.
     */
    if (typeof replyMessage === 'string') {
      const reply = this.replyBuilder
        .text(replyMessage)
        .tts(replyMessage)
        .get()
      return reply
    }

    return replyMessage
  }
}

module.exports = Ctx