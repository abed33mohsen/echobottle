import cors from 'cors'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isSupabaseEnabled, readSupabaseMessages, replaceSupabaseMessages, supabaseRequest } from './supabase-store.js'

const app = express()
const port = Number(process.env.PORT) || 5000
const fileName = fileURLToPath(import.meta.url)
const directoryName = path.dirname(fileName)
const dataDirectory = path.join(directoryName, 'data')
const messagesFile = path.join(dataDirectory, 'messages.json')

const allowedMoods = new Set(['calm', 'curious', 'heavy', 'bright'])
const allowedReactions = new Set(['wave', 'spark', 'heart'])

const seedMessages = [
  {
    id: 'seed-sunrise',
    content: 'لو كنت تقرأ هذه الرسالة الآن، أتمنى أن يكون اليوم أخف مما توقعت.',
    signature: 'شخص مرّ من هنا',
    mood: 'bright',
    createdAt: '2026-07-24T08:20:00.000Z',
    reactions: { wave: 3, spark: 1, heart: 5 },
    replies: [
      {
        id: 'seed-reply-1',
        content: 'وصلت في الوقت المناسب فعلًا.',
        createdAt: '2026-07-24T10:12:00.000Z',
      },
    ],
  },
  {
    id: 'seed-question',
    content: 'ما هي الفكرة التي تؤجلها لأنك خائف أن تبدو غريبة؟',
    signature: 'فضولي مجهول',
    mood: 'curious',
    createdAt: '2026-07-23T20:35:00.000Z',
    reactions: { wave: 4, spark: 7, heart: 1 },
    replies: [],
  },
  {
    id: 'seed-night',
    content: 'أحيانًا لا نحتاج جوابًا؛ نحتاج فقط مكانًا آمنًا لنسأل فيه.',
    signature: '',
    mood: 'calm',
    createdAt: '2026-07-22T22:05:00.000Z',
    reactions: { wave: 2, spark: 2, heart: 6 },
    replies: [],
  },
]

let writeQueue = Promise.resolve()

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return ''

  return value.replace(/\r\n/g, '\n').trim().slice(0, maxLength)
}

function normaliseMessage(message) {
  return {
    id: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(message.id)
      ? message.id
      : randomUUID(),
    content: cleanText(message.content, 280),
    signature: cleanText(message.signature, 32),
    mood: allowedMoods.has(message.mood) ? message.mood : 'curious',
    userId: message.userId || null,
    createdAt: message.createdAt || new Date().toISOString(),
    reactions: {
      wave: Number(message.reactions?.wave) || 0,
      spark: Number(message.reactions?.spark) || 0,
      heart: Number(message.reactions?.heart) || 0,
    },
    replies: Array.isArray(message.replies)
      ? message.replies.map((reply) => ({
          id: reply.id || randomUUID(),
          content: cleanText(reply.content, 180),
          createdAt: reply.createdAt || new Date().toISOString(),
        }))
      : [],
  }
}

async function ensureStore() {
  await mkdir(dataDirectory, { recursive: true })

  try {
    await readFile(messagesFile, 'utf8')
  } catch {
    await writeFile(messagesFile, JSON.stringify(seedMessages, null, 2), 'utf8')
  }
}

async function readLocalMessages() {
  await ensureStore()
  const rawMessages = await readFile(messagesFile, 'utf8')
  const parsedMessages = JSON.parse(rawMessages)

  if (!Array.isArray(parsedMessages)) {
    throw new Error('The messages store is invalid.')
  }

  return parsedMessages.map(normaliseMessage)
}

async function readMessages() {
  if (!isSupabaseEnabled) return readLocalMessages()

  const remoteMessages = await readSupabaseMessages()
  if (remoteMessages.length > 0) return remoteMessages

  const localMessages = await readLocalMessages()
  if (localMessages.length > 0) await replaceSupabaseMessages(localMessages)
  return localMessages
}

function saveMessages(messages) {
  if (isSupabaseEnabled) return replaceSupabaseMessages(messages)

  writeQueue = writeQueue.then(() =>
    writeFile(messagesFile, JSON.stringify(messages, null, 2), 'utf8'),
  )

  return writeQueue
}

function sortNewestFirst(messages) {
  return [...messages].sort(
    (first, second) => new Date(second.createdAt) - new Date(first.createdAt),
  )
}

async function getAuthenticatedUser(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return null

  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${token}`,
    },
  })
  return response.ok ? response.json() : null
}

app.use(cors())
app.use(express.json({ limit: '16kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.get('/api/messages', async (request, response, next) => {
  try {
    const messages = await readMessages()
    const mood = request.query.mood
    const filteredMessages = allowedMoods.has(mood)
      ? messages.filter((message) => message.mood === mood)
      : messages

    response.json({ messages: sortNewestFirst(filteredMessages) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/messages/random', async (request, response, next) => {
  try {
    const messages = await readMessages()
    const mood = request.query.mood
    const filteredMessages = allowedMoods.has(mood)
      ? messages.filter((message) => message.mood === mood)
      : messages
    const excludedIds = new Set(
      typeof request.query.exclude === 'string'
        ? request.query.exclude.split(',').filter(Boolean)
        : [],
    )
    const unseenMessages = filteredMessages.filter(
      (message) => !excludedIds.has(message.id),
    )
    const availableMessages = unseenMessages.length > 0
      ? unseenMessages
      : filteredMessages

    if (availableMessages.length === 0) {
      response.status(404).json({ error: 'لا توجد رسالة بهذه الموجة بعد.' })
      return
    }

    const index = Math.floor(Math.random() * availableMessages.length)
    response.json({ message: availableMessages[index] })
  } catch (error) {
    next(error)
  }
})

app.get('/api/messages/mine', async (request, response, next) => {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      response.status(401).json({ error: 'سجّل الدخول لعرض رسائلك.' })
      return
    }

    const messages = await readMessages()
    response.json({ messages: sortNewestFirst(messages.filter((message) => message.userId === user.id)) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/favorites', async (request, response, next) => {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || !isSupabaseEnabled) return response.status(401).json({ error: 'سجّل الدخول لعرض المفضلة.' })
    const favorites = await supabaseRequest(`favorites?user_id=eq.${user.id}&select=message_id`)
    response.json({ messageIds: favorites.map((favorite) => favorite.message_id) })
  } catch (error) { next(error) }
})

app.post('/api/favorites/:messageId', async (request, response, next) => {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || !isSupabaseEnabled) return response.status(401).json({ error: 'سجّل الدخول لحفظ الرسالة.' })
    await supabaseRequest('favorites?on_conflict=user_id,message_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ user_id: user.id, message_id: request.params.messageId }) })
    response.status(201).end()
  } catch (error) { next(error) }
})

app.delete('/api/favorites/:messageId', async (request, response, next) => {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || !isSupabaseEnabled) return response.status(401).json({ error: 'سجّل الدخول لإزالة المفضلة.' })
    await supabaseRequest(`favorites?user_id=eq.${user.id}&message_id=eq.${request.params.messageId}`, { method: 'DELETE' })
    response.status(204).end()
  } catch (error) { next(error) }
})

app.post('/api/messages', async (request, response, next) => {
  try {
    const content = cleanText(request.body.content, 280)
    const signature = cleanText(request.body.signature, 32)
    const mood = request.body.mood
    const user = await getAuthenticatedUser(request)

    if (content.length < 3) {
      response.status(400).json({ error: 'الرسالة يجب أن تكون 3 أحرف على الأقل.' })
      return
    }

    if (!allowedMoods.has(mood)) {
      response.status(400).json({ error: 'اختر لون موجة صحيحًا.' })
      return
    }

    const newMessage = {
      id: randomUUID(),
      content,
      signature,
      mood,
      userId: user?.id || null,
      createdAt: new Date().toISOString(),
      reactions: { wave: 0, spark: 0, heart: 0 },
      replies: [],
    }
    const messages = await readMessages()
    messages.unshift(newMessage)
    await saveMessages(messages)

    response.status(201).json({ message: newMessage })
  } catch (error) {
    next(error)
  }
})

app.post('/api/messages/:id/reactions', async (request, response, next) => {
  try {
    const type = request.body.type

    if (!allowedReactions.has(type)) {
      response.status(400).json({ error: 'نوع التفاعل غير صحيح.' })
      return
    }

    const messages = await readMessages()
    const message = messages.find((item) => item.id === request.params.id)

    if (!message) {
      response.status(404).json({ error: 'لم نجد هذه الزجاجة.' })
      return
    }

    message.reactions[type] += 1
    await saveMessages(messages)
    response.json({ message })
  } catch (error) {
    next(error)
  }
})

app.post('/api/messages/:id/replies', async (request, response, next) => {
  try {
    const content = cleanText(request.body.content, 180)

    if (content.length < 3) {
      response.status(400).json({ error: 'الرد يجب أن يكون 3 أحرف على الأقل.' })
      return
    }

    const messages = await readMessages()
    const message = messages.find((item) => item.id === request.params.id)

    if (!message) {
      response.status(404).json({ error: 'لم نجد هذه الزجاجة.' })
      return
    }

    message.replies.unshift({
      id: randomUUID(),
      content,
      createdAt: new Date().toISOString(),
    })
    message.replies = message.replies.slice(0, 5)
    await saveMessages(messages)

    response.status(201).json({ message })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/messages/:id', async (request, response, next) => {
  try {
    const messages = await readMessages()
    const message = messages.find((item) => item.id === request.params.id)

    if (!message) {
      response.status(404).json({ error: 'لم نجد هذه الزجاجة.' })
      return
    }

    const user = await getAuthenticatedUser(request)
    if (!user || message.userId !== user.id) {
      response.status(403).json({ error: 'لا يمكنك حذف رسالة لا تخص حسابك.' })
      return
    }

    const remainingMessages = messages.filter((item) => item.id !== request.params.id)
    await saveMessages(remainingMessages)
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'حدث خطأ غير متوقع في السيرفر.' })
})

await ensureStore()
app.listen(port, () => {
  console.log(`EchoBottle API is listening on http://localhost:${port}`)
})
