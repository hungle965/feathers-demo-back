import express from '@feathersjs/express'
import feathers, { NullableId, Params, HookContext } from '@feathersjs/feathers'
import socketio from '@feathersjs/socketio'
import '@feathersjs/transport-commons'

// This is the interface for the message data
interface Message {
  id: number
  text: string
}

const DEFAULT_MESSAGES: Message[] = []

// A messages service that allows to create new
// and return all existing messages
class MessageService {
  messages = DEFAULT_MESSAGES

  async find() {
    return this.messages
  }

  async create(data: Pick<Message, 'text'>) {
    const message: Message = {
      id: this.messages.length,
      text: data.text
    }
    this.messages.push(message)
    return message
  }

  async remove(id: NullableId, params: Params) {
    const index = this.messages.findIndex((mess) => mess.id === id)
    if (index !== -1) this.messages.splice(index, 1)
    return Promise.resolve(this.messages)
  }
}

// Creates an ExpressJS compatible Feathers application
const app = express(feathers())

// Express middleware to parse HTTP JSON bodies
app.use(express.json())
// Express middleware to parse URL-encoded params
app.use(express.urlencoded({ extended: true }))
// Express middleware to to host static files from the current folder
app.use(express.static(__dirname))
// Add REST API support
app.configure(express.rest())
// Configure Socket.io real-time APIs
app.configure(socketio())
// Register our messages service
app.use('messages', new MessageService())

const setTimestamp = (name: string) => {
  return async (context: HookContext) => {
    context.data[name] = new Date()
    console.log('created at: ', context.data[name])
    return context
  }
}

app.hooks({
  error(context) {
    console.error(
      `Error in '${context.path}' service method '${context.method}'`,
      context.error.stack
    )
  }
})

app.service('messages').hooks({
  before: {
    create: [setTimestamp('createdAt')],
    update: [setTimestamp('updatedAt')]
  }
})

app.service('messages').hooks({
  before: {
    create: setTimestamp('createdAt'),
    update: setTimestamp('updatedAt')
  },
  after: {}
})

// Express middleware with a nicer error handler
app.use(express.errorHandler())

// Add any new real-time connection to the `everybody` channel
app.on('connection', (connection) => app.channel('everybody').join(connection))
// Publish all events to the `everybody` channel
app.publish((data) => app.channel('everybody'))

// Start the server
app
  .listen(3030)
  .on('listening', () =>
    console.log('Feathers server listening on localhost:3030')
  )

// For good measure let's create a message
