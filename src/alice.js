const express = require('express')
const bodyParser = require('body-parser')
const Fuse = require('fuse.js')

const Ctx = require('./ctx')
const selectCommand = req => req.request.command

const makeStringLower = str => typeof str === 'string' ? str.toLowerCase() : str
const isFunction = fn => fn && typeof fn === 'function'

const DEFAULT_ANY_CALLBACK = () => 'Что-то пошло не так. Я не знаю, что на это сказать.'

// declaring possible command types
const TYPE_STRING = 'string'
const TYPE_REGEXP = 'regexp'
const TYPE_ARRAY = 'array'

class Alice {
  constructor(config = {}) {
    this.commands = []
    this.anyCallback = DEFAULT_ANY_CALLBACK
    this.fuseOptions = {
      tokenize: true,
      treshold: config.fuzzyTreshold || 0.2,
      distance: config.fuzzyDistance || 10,
      keys: ['name']
    }
    this.middlewares = []
  }

  /* @TODO: Implement watchers (errors, messages) */
  on() {

  }

  use(middleware) {
    this.middlewares.push(middleware)
  }

  /*
   * Set up the command
   * @param {string | Array<string> | regex} name — Trigger for the command
   * @param {Function} callback — Handler for the command
   */
  command(name, callback) {
    let type

    if (typeof name === 'string') {
      type = TYPE_STRING
      name = name.toLowerCase()
    } else if (name instanceof RegExp) {
      type = TYPE_REGEXP
    } else if (Array.isArray(name)) {
      name = name.map(makeStringLower)
      type = TYPE_ARRAY
    } else {
      throw new Error(`Command name is not of proper type.
        Could be only string, array of strings or regular expression`)
    }

    this.commands.push({
      name: name,
      type: type,
      callback: callback
    })
  }

  /*
   * Если среди команд не нашлось той,
   * которую запросил пользователь,
   * вызывается этот колбек
   */
  any(callback) {
    this.anyCallback = callback
  }

  /*
   * Match the request with action handler,
   * compose and return a reply.
   * @param {Object} req — JSON request from the client
   * @param {Function} sendResponse — Express res function while listening on port.
   */
  async handleRequestBody(req, sendResponse) {
    const requestedCommandName = selectCommand(req)
    let requestedCommands = []

    const stringCommands = this.commands.filter(cmd => cmd.type !== TYPE_REGEXP)
    const fuse = new Fuse(stringCommands, this.fuseOptions)
    const fuzzyMatches = fuse.search(requestedCommandName)

    const regexpCommands = this.commands.filter(cmd => cmd.type === TYPE_REGEXP)
    // @TODO: include matches and captured groups
    const regexpMatches = regexpCommands.filter(reg => requestedCommandName.match(reg))

    if (fuzzyMatches.length > 0) {
      requestedCommands = fuzzyMatches
    } else if (regexpCommands.length > 0) {
      requestedCommands = regexpMatches
    }

    /*
     * Инициализация контекста запроса
     */
    const ctx = new Ctx({
      req: req,
      sendResponse: sendResponse || null
    })
    /*
     * Команда нашлась в списке.
     * Запускаем её обработчик.
     */
    if (requestedCommands.length !== 0) {
      const requestedCommand = requestedCommands[0]
      return await requestedCommand.callback.call(this, ctx)
    }

    /*
     * Такой команды не было зарегестрировано.
     * Переходим в обработчик исключений
     */
    return await this.anyCallback.call(this, ctx)
  }

  /*
   * Метод создаёт сервер, который слушает указанный порт.
   * Когда на указанный URL приходит POST запрос, управление
   * передаётся в @handleRequestBody
   *
   * При получении ответа от @handleRequestBody, результат
   * отправляется обратно.
   */
  async listen(callbackUrl = '/', port = 80, callback) {
    return new Promise(resolve => {
      const app = express()
      app.use(bodyParser.json())
      app.post(callbackUrl, async (req, res) => {
        const handleResponseCallback = response => res.send(response)
        const replyMessage = await this.handleRequestBody(req.body, handleResponseCallback)
      })
      this.server = app.listen(port, () => {
        // Resolves with callback function
        if (isFunction(callback)) {
          return callback.call(this)
        }

        // If no callback specified, resolves as a promise.
        return resolve()
        // Resolves with promise if no callback set
      })
    })
  }

  stopListening() {
    if (this.server && this.server.close) {
      this.server.close()
    }
  }
}

module.exports = Alice
