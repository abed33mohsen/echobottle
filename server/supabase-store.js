const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '')
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

export const isSupabaseEnabled = Boolean(baseUrl && secretKey)

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.message || 'Supabase request failed.')
  return body
}

export async function supabaseRequest(path, options) {
  if (!isSupabaseEnabled) throw new Error('Supabase is not configured.')
  return request(path, options)
}

function fromRow(row) {
  return {
    id: row.id,
    content: row.content,
    signature: row.signature,
    mood: row.mood,
    userId: row.user_id,
    createdAt: row.created_at,
    reactions: { wave: row.wave_count, spark: row.spark_count, heart: row.heart_count },
    replies: (row.replies || []).map((reply) => ({
      id: reply.id,
      content: reply.content,
      createdAt: reply.created_at,
    })),
  }
}

function messageRow(message) {
  return {
    id: message.id,
    content: message.content,
    signature: message.signature,
    mood: message.mood,
    user_id: message.userId,
    created_at: message.createdAt,
    wave_count: message.reactions.wave,
    spark_count: message.reactions.spark,
    heart_count: message.reactions.heart,
  }
}

export async function readSupabaseMessages() {
  const rows = await request('messages?select=*,replies(*)&order=created_at.desc')
  return rows.map(fromRow)
}

// The app is deliberately small, so replacing this tiny JSON-style store keeps
// its existing API intact while Supabase becomes the persistent source of truth.
export async function replaceSupabaseMessages(messages) {
  await request('messages?id=not.is.null', { method: 'DELETE' })
  if (messages.length === 0) return

  await request('messages', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(messages.map(messageRow)),
  })

  const replies = messages.flatMap((message) =>
    message.replies.map((reply) => ({
      id: reply.id,
      message_id: message.id,
      content: reply.content,
      created_at: reply.createdAt,
    })),
  )
  if (replies.length > 0) {
    await request('replies', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(replies),
    })
  }
}
