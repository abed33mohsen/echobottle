import cors from 'cors'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isSupabaseEnabled, readSupabaseMessages, replaceSupabaseMessages, supabaseRequest, createSupabaseMessage, patchSupabaseMessage, createSupabaseReply, deleteSupabaseMessage } from './supabase-store.js'

const app = express()
const port = Number(process.env.PORT) || 5000
const fileName = fileURLToPath(import.meta.url)
const directoryName = path.dirname(fileName)
const dataDirectory = path.join(directoryName, 'data')
const messagesFile = path.join(dataDirectory, 'messages.json')

const allowedMoods = new Set(['calm', 'curious', 'heavy', 'bright'])
const allowedReactions = new Set(['wave', 'spark', 'heart'])
const allowedRarities = new Set(['common', 'golden', 'night', 'coral', 'legendary'])

function pickRarity() {
  const roll = Math.random() * 100
  if (roll < 1) return 'legendary'
  if (roll < 7) return 'golden'
  if (roll < 18) return 'night'
  if (roll < 35) return 'coral'
  return 'common'
}

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
    rarity: allowedRarities.has(message.rarity) ? message.rarity : 'common',
    oneTime: Boolean(message.oneTime),
    claimedAt: message.claimedAt || null,
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

function toPublicMessage(message) {
  const publicMessage = { ...message }
  delete publicMessage.userId
  return publicMessage
}

async function getAuthenticatedUser(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!token || !process.env.SUPABASE_URL || !serviceKey) return null

  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
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
    const filteredMessages = (allowedMoods.has(mood)
      ? messages.filter((message) => message.mood === mood)
      : messages).filter((message) => !message.oneTime)

    response.json({ messages: sortNewestFirst(filteredMessages).map(toPublicMessage) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/messages/random', async (request, response, next) => {
  try {
    const messages = await readMessages()
    const mood = request.query.mood
    if (isSupabaseEnabled) {
      const claimedId = await supabaseRequest('rpc/claim_one_time_message', {
        method: 'POST',
        body: JSON.stringify({ p_mood: allowedMoods.has(mood) ? mood : null }),
      })
      if (claimedId) {
        const claimed = messages.find((message) => message.id === claimedId)
        if (claimed) {
          const publicMessage = toPublicMessage(claimed)
          publicMessage.claimedAt = new Date().toISOString()
          response.json({ message: publicMessage })
          return
        }
      }
    } else {
      const claimableMessages = messages.filter(
        (message) =>
          message.oneTime &&
          !message.claimedAt &&
          (!allowedMoods.has(mood) || message.mood === mood),
      )
      if (claimableMessages.length > 0) {
        const claimed = claimableMessages[Math.floor(Math.random() * claimableMessages.length)]
        claimed.claimedAt = new Date().toISOString()
        await saveMessages(messages)
        response.json({ message: toPublicMessage(claimed) })
        return
      }
    }
    const filteredMessages = (allowedMoods.has(mood)
      ? messages.filter((message) => message.mood === mood)
      : messages).filter((message) => !message.oneTime)
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
    response.json({ message: toPublicMessage(availableMessages[index]) })
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
    response.json({
      messages: sortNewestFirst(messages.filter((message) => message.userId === user.id))
        .map(toPublicMessage),
    })
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

app.get('/api/profile', async (request, response, next) => {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || !isSupabaseEnabled) return response.status(401).json({ error: 'Authentication required.' })
    let profiles = await supabaseRequest(`profiles?id=eq.${user.id}&select=*`)
    if (profiles.length === 0) {
      profiles = await supabaseRequest('profiles', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ id: user.id }) })
    }
    response.json({ profile: profiles[0] })
  } catch (error) { next(error) }
})

app.patch('/api/profile', async (request, response, next) => {
  try {
    const user = await getAuthenticatedUser(request)
    const displayName = cleanText(request.body.displayName, 32)
    if (!user || !isSupabaseEnabled) return response.status(401).json({ error: 'Authentication required.' })
    const profiles = await supabaseRequest(`profiles?id=eq.${user.id}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ display_name: displayName, updated_at: new Date().toISOString() }) })
    response.json({ profile: profiles[0] })
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
    const oneTime = request.body.oneTime === true
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
      rarity: pickRarity(),
      oneTime,
      claimedAt: null,
      userId: user?.id || null,
      createdAt: new Date().toISOString(),
      reactions: { wave: 0, spark: 0, heart: 0 },
      replies: [],
    }
    if (isSupabaseEnabled) await createSupabaseMessage(newMessage)
    else { const messages = await readMessages(); messages.unshift(newMessage); await saveMessages(messages) }

    response.status(201).json({ message: toPublicMessage(newMessage) })
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
    if (isSupabaseEnabled) await patchSupabaseMessage(message)
    else await saveMessages(messages)
    response.json({ message: toPublicMessage(message) })
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

    const reply = {
      id: randomUUID(),
      content,
      createdAt: new Date().toISOString(),
    }
    message.replies.unshift(reply)
    message.replies = message.replies.slice(0, 5)
    if (isSupabaseEnabled) {
      await createSupabaseReply(message.id, reply)
      await patchSupabaseMessage(message)
    } else await saveMessages(messages)

    if (message.userId && isSupabaseEnabled) {
      await supabaseRequest('notifications', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ user_id: message.userId, message_id: message.id, reply_id: reply.id }),
      })
    }

    response.status(201).json({ message: toPublicMessage(message) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/notifications', async (request, response, next) => {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || !isSupabaseEnabled) return response.status(401).json({ error: 'Authentication required.' })
    const notifications = await supabaseRequest(`notifications?user_id=eq.${user.id}&select=*&order=created_at.desc&limit=8`)
    response.json({ notifications })
  } catch (error) { next(error) }
})

app.get('/api/future-letters', async (request, response, next) => {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user || !isSupabaseEnabled) return response.status(401).json({ error: 'Authentication required.' })
    const letters = await supabaseRequest(`future_letters?user_id=eq.${user.id}&select=id,unlock_at,created_at,content&order=unlock_at.asc`)
    const now = Date.now()
    response.json({
      letters: letters.map((letter) => ({
        id: letter.id,
        unlock_at: letter.unlock_at,
        created_at: letter.created_at,
        is_unlocked: new Date(letter.unlock_at).getTime() <= now,
        ...(new Date(letter.unlock_at).getTime() <= now ? { content: letter.content } : {}),
      })),
    })
  } catch (error) { next(error) }
})

app.post('/api/future-letters', async (request, response, next) => {
  try {
    const user = await getAuthenticatedUser(request)
    const content = cleanText(request.body.content, 500)
    const unlockAt = new Date(request.body.unlockAt)
    if (!user || !isSupabaseEnabled) return response.status(401).json({ error: 'Authentication required.' })
    if (content.length < 3 || Number.isNaN(unlockAt.getTime()) || unlockAt <= new Date()) return response.status(400).json({ error: 'Choose a future date and write at least 3 characters.' })
    const letters = await supabaseRequest('future_letters', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ user_id: user.id, content, unlock_at: unlockAt.toISOString() }) })
    response.status(201).json({
      letter: {
        id: letters[0].id,
        unlock_at: letters[0].unlock_at,
        created_at: letters[0].created_at,
        is_unlocked: false,
      },
    })
  } catch (error) { next(error) }
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

    if (isSupabaseEnabled) await deleteSupabaseMessage(message.id)
    else await saveMessages(messages.filter((item) => item.id !== request.params.id))
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
