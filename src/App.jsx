import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = '/api'
const MAX_MESSAGE_LENGTH = 280
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const copy = {
  en: { switch: 'العربية', online: 'Sea is online', offline: 'Sea is offline', checking: 'Checking the sea…', account: 'Account', english: 'English' },
  ar: { switch: 'English', online: 'البحر متصل', offline: 'البحر غير متصل', checking: 'نتحقق من البحر…', account: 'الحساب', english: 'الإنجليزية' },
}

const moods = [
  { id: 'calm', label: 'Calm', arLabel: 'هادئ', emoji: '☾', color: '#7dd3c7' },
  { id: 'curious', label: 'Curious', arLabel: 'فضولي', emoji: '✦', color: '#f2c879' },
  { id: 'heavy', label: 'Heavy', arLabel: 'مثقل', emoji: '☁', color: '#9c9ab6' },
  { id: 'bright', label: 'Bright', arLabel: 'مضيء', emoji: '☀', color: '#ff9e7a' },
]

const reactions = [
  { id: 'wave', emoji: '〰', label: 'I felt this' },
  { id: 'spark', emoji: '✦', label: 'Thoughtful' },
  { id: 'heart', emoji: '♡', label: 'Loved it' },
]

function getMood(moodId) {
  return moods.find((mood) => mood.id === moodId) ?? moods[0]
}

async function readJson(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.msg || payload.message || payload.error_description || payload.error || fallbackMessage)
  }

  return payload
}

function formatDate(dateString) {
  const date = new Date(dateString)

  if (Number.isNaN(date.getTime())) return 'Just now'

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function preview(text, length = 80) {
  return text.length > length ? `${text.slice(0, length).trim()}…` : text
}

function App() {
  const [messages, setMessages] = useState([])
  const [currentBottle, setCurrentBottle] = useState(null)
  const [form, setForm] = useState({ content: '', signature: '', mood: 'curious' })
  const [exploreMood, setExploreMood] = useState('all')
  const [replyText, setReplyText] = useState('')
  const [seenBottleIds, setSeenBottleIds] = useState([])
  const [notice, setNotice] = useState(null)
  const [apiStatus, setApiStatus] = useState('checking')
  const [isSending, setIsSending] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const [isReacting, setIsReacting] = useState(false)
  const [isReplying, setIsReplying] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authUser, setAuthUser] = useState(null)
  const [authToken, setAuthToken] = useState(null)
  const [myMessages, setMyMessages] = useState([])
  const [favoriteIds, setFavoriteIds] = useState([])
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [authMode, setAuthMode] = useState('signup')
  const [language, setLanguage] = useState(() => window.localStorage.getItem('echobottle-language') || 'en')
  const t = copy[language]
  const x = (en, ar) => language === 'ar' ? ar : en
  const moodLabel = (mood) => language === 'ar' ? mood.arLabel : mood.label

  const currentMood = useMemo(
    () => (currentBottle ? getMood(currentBottle.mood) : null),
    [currentBottle],
  )

  const loadMessages = async () => {
    setApiStatus('checking')

    try {
      const response = await fetch(`${API_BASE}/messages`)
      const data = await readJson(response, 'تعذر تحميل الرسائل.')
      setMessages(data.messages)
      setApiStatus('online')
    } catch {
      setApiStatus('offline')
      setNotice({
        type: 'error',
        text: 'تعذر الاتصال بالباك إند. شغّل السيرفر ثم حدّث الصفحة.',
      })
    }
  }

  useEffect(() => {
    loadMessages()
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    window.localStorage.setItem('echobottle-language', language)
  }, [language])

  useEffect(() => {
    const storedToken = window.localStorage.getItem('echobottle-session')
    if (!storedToken || !SUPABASE_URL || !SUPABASE_KEY) return

    fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${storedToken}` } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((user) => {
        setAuthUser(user)
        setAuthToken(storedToken)
        loadMyMessages(storedToken)
        loadFavorites(storedToken)
      })
      .catch(() => window.localStorage.removeItem('echobottle-session'))
  }, [])

  const loadMyMessages = async (token = authToken) => {
    if (!token) return
    try {
      const response = await fetch(`${API_BASE}/messages/mine`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await readJson(response, 'تعذر تحميل رسائلك.')
      setMyMessages(data.messages)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  const loadFavorites = async (token = authToken) => {
    if (!token) return
    const response = await fetch(`${API_BASE}/favorites`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await readJson(response, 'تعذر تحميل المفضلة.')
    setFavoriteIds(data.messageIds)
  }

  const toggleFavorite = async () => {
    if (!authToken || !currentBottle) {
      setNotice({ type: 'error', text: 'سجّل الدخول أولًا لحفظ الرسائل.' })
      return
    }
    const saved = favoriteIds.includes(currentBottle.id)
    try {
      const response = await fetch(`${API_BASE}/favorites/${currentBottle.id}`, { method: saved ? 'DELETE' : 'POST', headers: { Authorization: `Bearer ${authToken}` } })
      if (!response.ok) await readJson(response, 'تعذر تحديث المفضلة.')
      setFavoriteIds((current) => saved ? current.filter((id) => id !== currentBottle.id) : [...current, currentBottle.id])
    } catch (error) { setNotice({ type: 'error', text: error.message }) }
  }

  const authenticate = async (event) => {
    event.preventDefault()
    setIsAuthenticating(true)
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      })
      const data = await readJson(response, 'تعذر تسجيل الدخول.')
      setAuthUser(data.user)
      setAuthToken(data.access_token)
      window.localStorage.setItem('echobottle-session', data.access_token)
      loadMyMessages(data.access_token)
      loadFavorites(data.access_token)
      setAuthPassword('')
      setNotice({ type: 'success', text: `أهلًا بعودتك، ${data.user.email}.` })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setIsAuthenticating(false)
    }
  }

  const signUp = async () => {
    setIsSigningUp(true)
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      })
      const data = await readJson(response, 'تعذر إنشاء الحساب.')
      if (data.session) {
        setAuthUser(data.user)
        setAuthToken(data.session.access_token)
        window.localStorage.setItem('echobottle-session', data.session.access_token)
        loadMyMessages(data.session.access_token)
        loadFavorites(data.session.access_token)
      }
      setAuthPassword('')
      setNotice({ type: 'success', text: data.session ? 'تم إنشاء حسابك وتسجيل دخولك.' : 'تم إنشاء الحساب. راجع بريدك لتأكيده ثم سجّل الدخول.' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setIsSigningUp(false)
    }
  }

  const deleteMyMessage = async (messageId) => {
    if (!authToken || !window.confirm('هل تريد حذف هذه الرسالة نهائيًا؟')) return
    try {
      const response = await fetch(`${API_BASE}/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!response.ok) await readJson(response, 'تعذر حذف الرسالة.')
      setMyMessages((current) => current.filter((message) => message.id !== messageId))
      setMessages((current) => current.filter((message) => message.id !== messageId))
      setCurrentBottle((current) => current?.id === messageId ? null : current)
      setNotice({ type: 'success', text: 'تم حذف الرسالة.' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  const favoriteMessages = useMemo(
    () => messages.filter((message) => favoriteIds.includes(message.id)),
    [messages, favoriteIds],
  )

  const syncMessage = (updatedMessage) => {
    setCurrentBottle((current) =>
      current?.id === updatedMessage.id ? updatedMessage : current,
    )

    setMessages((current) => {
      const exists = current.some((message) => message.id === updatedMessage.id)
      if (!exists) return [updatedMessage, ...current]

      return current.map((message) =>
        message.id === updatedMessage.id ? updatedMessage : message,
      )
    })
  }

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (form.content.trim().length < 3) {
      setNotice({ type: 'error', text: 'اكتب رسالة من 3 أحرف على الأقل.' })
      return
    }

    setIsSending(true)
    setNotice(null)

    try {
      const response = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify(form),
      })
      const data = await readJson(response, 'تعذر إرسال الرسالة.')

      setMessages((current) => [data.message, ...current])
      setCurrentBottle(data.message)
      setForm({ content: '', signature: '', mood: 'curious' })
      setNotice({
        type: 'success',
        text: 'انطلقت رسالتك في البحر. تستطيع الآن فتح رسالة جديدة.',
      })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setIsSending(false)
    }
  }

  const openBottle = async () => {
    setIsOpening(true)
    setNotice(null)

    try {
      const params = new URLSearchParams()
      if (exploreMood !== 'all') params.set('mood', exploreMood)
      if (seenBottleIds.length > 0) params.set('exclude', seenBottleIds.join(','))
      const query = params.size > 0 ? `?${params.toString()}` : ''
      const response = await fetch(`${API_BASE}/messages/random${query}`)
      const data = await readJson(response, 'لا توجد رسالة بهذه الموجة بعد.')
      setCurrentBottle(data.message)
      setSeenBottleIds((current) => [...new Set([...current, data.message.id])])
      setReplyText('')
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setIsOpening(false)
    }
  }

  const reactToMessage = async (reaction) => {
    if (!currentBottle || isReacting) return

    setIsReacting(true)

    try {
      const response = await fetch(
        `${API_BASE}/messages/${currentBottle.id}/reactions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: reaction.id }),
        },
      )
      const data = await readJson(response, 'تعذر حفظ التفاعل.')
      syncMessage(data.message)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setIsReacting(false)
    }
  }

  const sendReply = async (event) => {
    event.preventDefault()

    if (!currentBottle || replyText.trim().length < 3) {
      setNotice({ type: 'error', text: 'اكتب ردًا قصيرًا من 3 أحرف على الأقل.' })
      return
    }

    setIsReplying(true)

    try {
      const response = await fetch(
        `${API_BASE}/messages/${currentBottle.id}/replies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: replyText }),
        },
      )
      const data = await readJson(response, 'تعذر إرسال الرد.')
      syncMessage(data.message)
      setReplyText('')
      setNotice({ type: 'success', text: 'وصل ردك إلى الزجاجة.' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setIsReplying(false)
    }
  }

  return (
    <div className="app">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="EchoBottle home">
          <span className="brand-bottle" aria-hidden="true"><span /></span>
          <span>EchoBottle</span>
        </a>

        <button className="language-switch" type="button" onClick={() => setLanguage((current) => current === 'en' ? 'ar' : 'en')} aria-label="Change language">{t.switch}</button>

        <div className={`api-status api-status--${apiStatus}`}>
          <span aria-hidden="true" />
          {apiStatus === 'online'
            ? t.online
            : apiStatus === 'offline'
              ? t.offline
              : t.checking}
        </div>
      </header>

      <main id="top" className="page-shell">
        <section className="account-bar" aria-label={t.account}>
          {authUser ? (
            <div className="my-account">
              <div><span>✦ مسجل الدخول: {authUser.email}</span><button type="button" onClick={() => { loadMyMessages(); loadFavorites() }}>تحديث</button><button type="button" onClick={() => { window.localStorage.removeItem('echobottle-session'); setAuthUser(null); setAuthToken(null); setMyMessages([]); setFavoriteIds([]) }}>خروج</button></div>
              <p className="my-account__title">رسائلي ({myMessages.length})</p>
              {myMessages.length ? <div className="my-account__list">{myMessages.map((message) => <div key={message.id}><button type="button" onClick={() => setCurrentBottle(message)}>{preview(message.content, 46)} <small>♡ {(message.reactions?.heart ?? 0) + (message.reactions?.wave ?? 0) + (message.reactions?.spark ?? 0)} · ↳ {message.replies?.length ?? 0}</small></button><button type="button" className="delete-message" onClick={() => deleteMyMessage(message.id)}>حذف</button></div>)}</div> : <p className="my-account__empty">لا توجد رسائل مرتبطة بهذا الحساب بعد.</p>}
              <p className="my-account__title">المفضلة ({favoriteMessages.length})</p>
              {favoriteMessages.length ? <div className="my-account__list">{favoriteMessages.map((message) => <div key={message.id}><button type="button" onClick={() => setCurrentBottle(message)}>{preview(message.content, 46)} <small>{getMood(message.mood).emoji} رسالة محفوظة</small></button></div>)}</div> : <p className="my-account__empty">احفظ رسالة تعجبك لتظهر هنا.</p>}
            </div>
          ) : (
            <div className="auth-card">
              <div className="auth-card__tabs">
                <button type="button" className={authMode === 'signup' ? 'is-active' : ''} onClick={() => setAuthMode('signup')}>{x('Create account', 'إنشاء حساب')}</button>
                <button type="button" className={authMode === 'signin' ? 'is-active' : ''} onClick={() => setAuthMode('signin')}>{x('Sign in', 'تسجيل الدخول')}</button>
              </div>
              <form onSubmit={authMode === 'signup' ? (event) => { event.preventDefault(); signUp() } : authenticate}>
                <h2>{authMode === 'signup' ? x('Join the shore', 'انضم إلى الشاطئ') : x('Welcome back', 'مرحبًا بعودتك')}</h2>
                <p>{authMode === 'signup' ? x('Keep messages under your account, or stay anonymous whenever you wish.', 'احفظ رسائلك باسمك، أو استمر مجهولًا متى شئت.') : x('Sign in to follow your messages.', 'سجّل دخولك لمتابعة رسائلك.')}</p>
                <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder={x('Email address', 'البريد الإلكتروني')} required />
                <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder={x('Password (6 characters minimum)', 'كلمة مرور من 6 أحرف على الأقل')} minLength="6" required />
                <button type="submit" disabled={isAuthenticating || isSigningUp}>{authMode === 'signup' ? (isSigningUp ? x('Creating account…', 'جارٍ إنشاء الحساب…') : x('Create account', 'إنشاء حساب')) : (isAuthenticating ? x('Signing in…', 'جارٍ الدخول…') : x('Sign in', 'تسجيل الدخول'))}</button>
              </form>
            </div>
          )}
        </section>
        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">{x('A small place for thoughts looking for somewhere to land', 'مكان صغير للرسائل التي لا تعرف إلى أين تذهب')}</p>
          <h1 id="hero-title">{x('Cast a thought into the sea.', 'ارمِ فكرة في البحر.')}<br />{x('Find a note from someone else.', 'افتح صدفةً من شخص آخر.')}</h1>
          <p className="hero-copy">
            {x('EchoBottle is an anonymous space for leaving a short note and finding one left behind by a stranger.', 'EchoBottle مساحة مجهولة، تترك فيها رسالة قصيرة وتجد رسالة عشوائية تركها شخص لا تعرفه.')}
          </p>
          <div className="hero-tide" aria-hidden="true"><span /><span /><span /></div>
        </section>

        {notice && (
          <div className={`notice notice--${notice.type}`} role="status">
            <span>{notice.type === 'success' ? '✦' : '!'}</span>
            {notice.text}
            <button type="button" onClick={() => setNotice(null)} aria-label="إغلاق التنبيه">×</button>
          </div>
        )}

        <section className="workspace" aria-label="Message workspace">
          <section className="compose-panel panel" aria-labelledby="compose-title">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">01 — {x('WRITE', 'أرسل')}</p>
                <h2 id="compose-title">{x('Write a message in a bottle', 'اكتب رسالة في زجاجة')}</h2>
              </div>
              <span className="tiny-note">{x('Stays anonymous', 'تبقى مجهولة')}</span>
            </div>

            <form className="message-form" onSubmit={handleSubmit}>
              <label className="field-label" htmlFor="message-content">{x('What would you like to tell the sea?', 'ما الذي تريد أن تقوله للبحر؟')}</label>
              <textarea
                id="message-content"
                name="content"
                value={form.content}
                onChange={handleInputChange}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder={x('A thought, a question, or something you do not want to lose…', 'اكتب فكرة، سؤالًا، أو شيئًا لا تريد أن يضيع…')}
                required
              />
              <div className="character-count" aria-live="polite">{form.content.length}/{MAX_MESSAGE_LENGTH}</div>

              <fieldset className="mood-picker">
                <legend>{x('The feeling of this wave', 'لون الموجة')}</legend>
                <div className="mood-options">
                  {moods.map((mood) => (
                    <button
                      className={`mood-option ${form.mood === mood.id ? 'is-selected' : ''}`}
                      type="button"
                      key={mood.id}
                      onClick={() => setForm((current) => ({ ...current, mood: mood.id }))}
                      style={{ '--mood-color': mood.color }}
                      aria-pressed={form.mood === mood.id}
                    >
                      <span aria-hidden="true">{mood.emoji}</span>
                      {moodLabel(mood)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="field-label field-label--optional" htmlFor="signature">
                {x('Optional signature', 'توقيع اختياري')} <span>— {x('leave it empty to stay anonymous', 'اتركه فارغًا لتبقى مجهولًا')}</span>
              </label>
              <input
                id="signature"
                name="signature"
                value={form.signature}
                onChange={handleInputChange}
                maxLength="32"
                placeholder={x('For example: someone passing by', 'مثال: شخص مرّ من هنا')}
              />

              <button className="primary-button" type="submit" disabled={isSending}>
                <span aria-hidden="true">↗</span>
                {isSending ? x('Casting your bottle…', 'نرمي الزجاجة…') : x('Send to the sea', 'أرسل إلى البحر')}
              </button>
            </form>
          </section>

          <section className="discover-panel panel" aria-labelledby="discover-title">
            <div className="panel-heading panel-heading--discover">
              <div>
                <p className="section-kicker">02 — {x('DISCOVER', 'اكتشف')}</p>
                <h2 id="discover-title">{x('Open a random bottle', 'افتح زجاجة عشوائية')}</h2>
              </div>
              <label className="explore-filter">
                <span>{x('Feeling', 'الموجة')}</span>
                <select value={exploreMood} onChange={(event) => setExploreMood(event.target.value)}>
                  <option value="all">{x('All', 'كلها')}</option>
                  {moods.map((mood) => <option key={mood.id} value={mood.id}>{moodLabel(mood)}</option>)}
                </select>
              </label>
            </div>

            <div className="bottle-stage">
              {currentBottle ? (
                <article className="message-card" style={{ '--message-color': currentMood.color }}>
                  <div className="message-card__topline">
                    <span className="mood-badge"><span aria-hidden="true">{currentMood.emoji}</span>{moodLabel(currentMood)}</span>
                    <time dateTime={currentBottle.createdAt}>{formatDate(currentBottle.createdAt)}</time>
                  </div>
                  <blockquote>“{currentBottle.content}”</blockquote>
                  <div className="message-signature"><span className="signature-line" />{currentBottle.signature || 'An anonymous voice'}</div>

                  <div className="reaction-row" aria-label="Reactions">
                    {reactions.map((reaction) => (
                      <button
                        type="button"
                        key={reaction.id}
                        onClick={() => reactToMessage(reaction)}
                        disabled={isReacting}
                        title={reaction.label}
                      >
                        <span aria-hidden="true">{reaction.emoji}</span>
                        {currentBottle.reactions?.[reaction.id] ?? 0}
                      </button>
                    ))}
                  </div>
                  <button type="button" className={`favorite-button ${favoriteIds.includes(currentBottle.id) ? 'is-saved' : ''}`} onClick={toggleFavorite}>☆ {favoriteIds.includes(currentBottle.id) ? x('Saved', 'محفوظة') : x('Save this message', 'حفظ في المفضلة')}</button>

                  <form className="reply-form" onSubmit={sendReply}>
                    <label htmlFor="reply">{x('Leave a small trace', 'اترك أثرًا صغيرًا')}</label>
                    <div>
                      <input
                        id="reply"
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        maxLength="180"
                        placeholder={x('A short, kind reply…', 'رد قصير ولطيف…')}
                      />
                      <button type="submit" disabled={isReplying}>{isReplying ? '…' : x('Send', 'أرسل')}</button>
                    </div>
                  </form>

                  {currentBottle.replies?.length > 0 && (
                    <div className="reply-list">
                      <p>Traces on this bottle</p>
                      {currentBottle.replies.map((reply) => (
                        <div key={reply.id}><span>↳</span>{reply.content}</div>
                      ))}
                    </div>
                  )}
                </article>
              ) : (
                <div className="empty-bottle">
                  <div className="floating-bottle" aria-hidden="true"><span /></div>
                  <p>{x('The sea is calm right now.', 'البحر هادئ الآن.')}</p>
                  <span>{x('Open a bottle to see what a stranger left behind.', 'افتح زجاجة لترى ما تركه شخص مجهول.')}</span>
                </div>
              )}
            </div>

            <button className="open-button" type="button" onClick={openBottle} disabled={isOpening}>
              <span aria-hidden="true">⌁</span>
              {isOpening ? x('Searching the waves…', 'نبحث بين الأمواج…') : x('Open a message from the sea', 'افتح رسالة من البحر')}
            </button>
            {seenBottleIds.length > 0 && (
              <button
                className="reset-journey"
                type="button"
                onClick={() => {
                  setSeenBottleIds([])
                  setNotice({ type: 'success', text: 'بدأنا رحلة جديدة بين الأمواج.' })
                }}
              >
                {x('Start a new journey', 'ابدأ رحلة جديدة')}
              </button>
            )}
          </section>
        </section>

        <section className="shoreline panel" aria-labelledby="shoreline-title">
          <div className="shoreline-heading">
            <div>
              <p className="section-kicker">{x('JUST ARRIVED', 'ما وصل حديثًا')}</p>
              <h2 id="shoreline-title">{x('Latest bottles on the shore', 'آخر الزجاجات على الشاطئ')}</h2>
            </div>
            <button className="text-button" type="button" onClick={loadMessages}>{x('Refresh messages', 'تحديث الرسائل')} ↻</button>
          </div>

          {messages.length > 0 ? (
            <div className="message-shelf">
              {messages.slice(0, 4).map((message) => {
                const messageMood = getMood(message.mood)

                return (
                  <button
                    type="button"
                    className="shelf-message"
                    key={message.id}
                    onClick={() => {
                      setCurrentBottle(message)
                      setReplyText('')
                    }}
                    style={{ '--shelf-color': messageMood.color }}
                  >
                    <span className="shelf-message__mood">{messageMood.emoji} {moodLabel(messageMood)}</span>
                    <strong>{preview(message.content)}</strong>
                    <small>{message.signature || 'An anonymous voice'}</small>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="empty-shelf">No bottles have reached the shore yet. Be the first to cast one.</p>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <span>EchoBottle — A React + Node.js project</span>
        <span>One message can change the mood of an entire day.</span>
      </footer>
    </div>
  )
}

export default App
