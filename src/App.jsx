import { useCallback, useEffect, useMemo, useState } from 'react'
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
const rarities = {
  common: { emoji: '◌', en: 'Common', ar: 'عادية' },
  golden: { emoji: '✦', en: 'Golden', ar: 'ذهبية' },
  night: { emoji: '☾', en: 'Night', ar: 'ليلية' },
  coral: { emoji: '◒', en: 'Coral', ar: 'مرجانية' },
  legendary: { emoji: '✺', en: 'Legendary', ar: 'أسطورية' },
}
const profileAvatars = [
  { id: 'bottle', emoji: '⚱' }, { id: 'moon', emoji: '☾' }, { id: 'wave', emoji: '≋' },
  { id: 'star', emoji: '✦' }, { id: 'shell', emoji: '◖' },
]
const profileColors = ['teal', 'gold', 'coral', 'violet']

const writingPrompts = [
  ['What is a small thing that made you smile today?', 'ما الشيء الصغير الذي جعلك تبتسم اليوم؟'],
  ['Write one sentence you wish someone had told you.', 'اكتب جملة تتمنى لو أن شخصًا قالها لك.'],
  ['What would you leave for a stranger on a quiet shore?', 'ماذا تترك لغريب على شاطئ هادئ؟'],
  ['Describe a moment you want to remember.', 'صف لحظة تريد أن تتذكرها.'],
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

function loadDraft() {
  try {
    const draft = JSON.parse(window.localStorage.getItem('echobottle-draft'))
    return {
      content: typeof draft?.content === 'string' ? draft.content.slice(0, MAX_MESSAGE_LENGTH) : '',
      signature: typeof draft?.signature === 'string' ? draft.signature.slice(0, 32) : '',
      mood: moods.some((mood) => mood.id === draft?.mood) ? draft.mood : 'curious',
      oneTime: draft?.oneTime === true,
    }
  } catch {
    return { content: '', signature: '', mood: 'curious', oneTime: false }
  }
}

function pageFromPath() {
  if (window.location.pathname === '/auth') return 'auth'
  if (window.location.pathname === '/settings') return 'settings'
  return 'home'
}

function App() {
  const [messages, setMessages] = useState([])
  const [dailyMessage, setDailyMessage] = useState(null)
  const [currentBottle, setCurrentBottle] = useState(null)
  const [form, setForm] = useState(loadDraft)
  const [draftSaved, setDraftSaved] = useState(false)
  const [exploreMood, setExploreMood] = useState('all')
  const [replyText, setReplyText] = useState('')
  const [reportReason, setReportReason] = useState('')
  const [isReporting, setIsReporting] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [seenBottleIds, setSeenBottleIds] = useState([])
  const [notice, setNotice] = useState(null)
  const [apiStatus, setApiStatus] = useState('checking')
  const [isSending, setIsSending] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const [isReacting, setIsReacting] = useState(false)
  const [heartBurst, setHeartBurst] = useState(0)
  const [isReplying, setIsReplying] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authUser, setAuthUser] = useState(null)
  const [authToken, setAuthToken] = useState(null)
  const [myMessages, setMyMessages] = useState([])
  const [favoriteIds, setFavoriteIds] = useState([])
  const [displayName, setDisplayName] = useState('')
  const [profileBio, setProfileBio] = useState('')
  const [profileAvatar, setProfileAvatar] = useState('bottle')
  const [profileColor, setProfileColor] = useState('teal')
  const [notifications, setNotifications] = useState([])
  const [futureLetters, setFutureLetters] = useState([])
  const [adminStats, setAdminStats] = useState(null)
  const [futureContent, setFutureContent] = useState('')
  const [futureDate, setFutureDate] = useState('')
  const [accountQuery, setAccountQuery] = useState('')
  const [accountMood, setAccountMood] = useState('all')
  const [accountRarity, setAccountRarity] = useState('all')
  const [accountSort, setAccountSort] = useState('newest')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [authMode, setAuthMode] = useState('signup')
  const [language, setLanguage] = useState(() => window.localStorage.getItem('echobottle-language') || 'en')
  const [reducedMotion, setReducedMotion] = useState(() => window.localStorage.getItem('echobottle-reduced-motion') === 'true')
  const [soundEnabled, setSoundEnabled] = useState(() => window.localStorage.getItem('echobottle-sound') !== 'false')
  const [theme, setTheme] = useState(() => window.localStorage.getItem('echobottle-theme') || 'ocean')
  const [promptIndex, setPromptIndex] = useState(() => new Date().getDate() % writingPrompts.length)
  const [navOpen, setNavOpen] = useState(false)
  const [page, setPage] = useState(pageFromPath)
  const t = copy[language]
  const x = (en, ar) => language === 'ar' ? ar : en
  const moodLabel = (mood) => language === 'ar' ? mood.arLabel : mood.label
  const rarity = (id) => rarities[id] || rarities.common
  const prompt = writingPrompts[promptIndex][language === 'ar' ? 1 : 0]

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
      const dailyResponse = await fetch(`${API_BASE}/messages/daily`)
      if (dailyResponse.ok) {
        const dailyData = await dailyResponse.json()
        setDailyMessage(dailyData.message)
      }
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
    window.localStorage.setItem('echobottle-reduced-motion', String(reducedMotion))
  }, [reducedMotion])

  useEffect(() => {
    window.localStorage.setItem('echobottle-sound', String(soundEnabled))
  }, [soundEnabled])

  useEffect(() => {
    window.localStorage.setItem('echobottle-theme', theme)
  }, [theme])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (form.content || form.signature) {
        window.localStorage.setItem('echobottle-draft', JSON.stringify(form))
        setDraftSaved(true)
      } else {
        window.localStorage.removeItem('echobottle-draft')
        setDraftSaved(false)
      }
    }, 450)
    setDraftSaved(false)
    return () => window.clearTimeout(timer)
  }, [form])

  useEffect(() => {
    const handlePopState = () => setPage(pageFromPath())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (nextPage) => {
    const paths = { home: '/', auth: '/auth', settings: '/settings' }
    window.history.pushState({}, '', paths[nextPage] || '/')
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  const playChime = (frequency = 520) => {
    if (!soundEnabled) return
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, context.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.35, context.currentTime + 0.18)
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.34)
      oscillator.addEventListener('ended', () => context.close())
    } catch {
      // Sound is an enhancement; browser restrictions should never block an action.
    }
  }

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
        loadProfile(storedToken)
        loadNotifications(storedToken)
        loadFutureLetters(storedToken)
        loadAdminStats(storedToken)
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

  const loadProfile = async (token = authToken) => {
    if (!token) return
    const response = await fetch(`${API_BASE}/profile`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await readJson(response, 'Unable to load profile.')
    setDisplayName(data.profile.display_name || '')
    setProfileBio(data.profile.bio || '')
    setProfileAvatar(data.profile.avatar || 'bottle')
    setProfileColor(data.profile.accent_color || 'teal')
  }

  const loadNotifications = async (token = authToken) => {
    if (!token) return
    const response = await fetch(`${API_BASE}/notifications`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await readJson(response, 'Unable to load notifications.')
    setNotifications(data.notifications)
  }

  const loadFutureLetters = async (token = authToken) => {
    if (!token) return
    const response = await fetch(`${API_BASE}/future-letters`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await readJson(response, 'Unable to load future letters.')
    setFutureLetters(data.letters)
  }

  const loadAdminStats = async (token = authToken) => {
    if (!token) return
    const response = await fetch(`${API_BASE}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
    if (response.status === 403) {
      setAdminStats(null)
      return
    }
    const data = await readJson(response, 'Unable to load admin statistics.')
    setAdminStats(data.stats)
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    try {
      const response = await fetch(`${API_BASE}/profile`, { method: 'PATCH', headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName, bio: profileBio, avatar: profileAvatar, accentColor: profileColor }) })
      await readJson(response, x('Unable to save profile.', 'تعذر حفظ الملف الشخصي.'))
      setNotice({ type: 'success', text: x('Profile saved.', 'تم حفظ الملف الشخصي.') })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  const saveFutureLetter = async (event) => {
    event.preventDefault()
    try {
      const response = await fetch(`${API_BASE}/future-letters`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: futureContent, unlockAt: new Date(futureDate).toISOString() }) })
      await readJson(response, x('Unable to save future letter.', 'تعذر حفظ الرسالة المستقبلية.'))
      setFutureContent('')
      setFutureDate('')
      await loadFutureLetters()
      setNotice({ type: 'success', text: x('Your letter is sealed for the future.', 'تم إغلاق رسالتك إلى المستقبل.') })
    } catch (error) { setNotice({ type: 'error', text: error.message }) }
  }

  const toggleFavorite = async () => {
    if (!authToken || !currentBottle) {
      setNotice({ type: 'error', text: x('Sign in first to save messages.', 'سجّل الدخول أولًا لحفظ الرسائل.') })
      return
    }
    const saved = favoriteIds.includes(currentBottle.id)
    try {
      const response = await fetch(`${API_BASE}/favorites/${currentBottle.id}`, { method: saved ? 'DELETE' : 'POST', headers: { Authorization: `Bearer ${authToken}` } })
      if (!response.ok) await readJson(response, 'تعذر تحديث المفضلة.')
      setFavoriteIds((current) => saved ? current.filter((id) => id !== currentBottle.id) : [...current, currentBottle.id])
    } catch (error) { setNotice({ type: 'error', text: error.message }) }
  }

  const openNotification = async (notification, message) => {
    try {
      const response = await fetch(`${API_BASE}/notifications/${notification.id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!response.ok) await readJson(response, 'Unable to mark notification as read.')
      setNotifications((current) => current.filter((item) => item.id !== notification.id))
      if (message) {
        setCurrentBottle(message)
        navigate('home')
      }
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  const reportMessage = async () => {
    if (!currentBottle || !reportReason || isReporting) return
    setIsReporting(true)
    try {
      const response = await fetch(`${API_BASE}/messages/${currentBottle.id}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason }),
      })
      await readJson(response, x('Unable to send report.', 'تعذر إرسال البلاغ.'))
      setReportReason('')
      setNotice({ type: 'success', text: x('Thank you. The report reached moderation.', 'شكرًا لك. وصل البلاغ إلى المراجعة.') })
    } catch (error) { setNotice({ type: 'error', text: error.message }) }
    finally { setIsReporting(false) }
  }

  const moderateReport = async (reportId, action) => {
    try {
      const response = await fetch(`${API_BASE}/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!response.ok) await readJson(response, 'Unable to review report.')
      await loadAdminStats()
      if (action === 'delete') await loadMessages()
    } catch (error) { setNotice({ type: 'error', text: error.message }) }
  }

  const shareMessageCard = async () => {
    if (!currentBottle || isSharing) return
    setIsSharing(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1080
      const context = canvas.getContext('2d')
      const gradient = context.createLinearGradient(0, 0, 1080, 1080)
      gradient.addColorStop(0, '#071724')
      gradient.addColorStop(.58, '#0a3340')
      gradient.addColorStop(1, '#102635')
      context.fillStyle = gradient
      context.fillRect(0, 0, 1080, 1080)
      context.strokeStyle = getMood(currentBottle.mood).color
      context.lineWidth = 5
      context.strokeRect(68, 68, 944, 944)
      context.textAlign = language === 'ar' ? 'right' : 'left'
      context.direction = language === 'ar' ? 'rtl' : 'ltr'
      const textX = language === 'ar' ? 920 : 160
      context.fillStyle = '#7dd3c7'
      context.font = '700 34px sans-serif'
      context.fillText('EchoBottle  ✦', textX, 155)
      context.fillStyle = '#f2c779'
      context.font = '700 28px sans-serif'
      context.fillText(`${getMood(currentBottle.mood).emoji} ${moodLabel(getMood(currentBottle.mood))}`, textX, 225)
      context.fillStyle = '#fff8ec'
      context.font = '600 48px sans-serif'
      const words = currentBottle.content.split(' ')
      const lines = []
      let line = ''
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word
        if (context.measureText(candidate).width > 750 && line) { lines.push(line); line = word } else line = candidate
      }
      if (line) lines.push(line)
      lines.slice(0, 8).forEach((item, index) => context.fillText(item, textX, 360 + index * 68))
      context.fillStyle = '#9fc6c2'
      context.font = '400 27px sans-serif'
      context.fillText(currentBottle.signature || x('An anonymous voice', 'صوت مجهول'), textX, 920)
      context.fillStyle = '#688d8b'
      context.font = '400 22px sans-serif'
      context.fillText('echobottle.onrender.com', textX, 970)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      const file = new File([blob], `echobottle-${currentBottle.id}.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'EchoBottle', text: x('A message from the sea', 'رسالة من البحر') })
      } else {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = file.name
        link.click()
        URL.revokeObjectURL(link.href)
      }
    } catch (error) {
      if (error.name !== 'AbortError') setNotice({ type: 'error', text: x('Unable to create the image.', 'تعذر إنشاء الصورة.') })
    } finally { setIsSharing(false) }
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
      loadProfile(data.access_token)
      loadNotifications(data.access_token)
      loadFutureLetters(data.access_token)
      loadAdminStats(data.access_token)
      setAuthPassword('')
      setNotice({ type: 'success', text: x('Welcome back. Your account is ready.', 'أهلًا بعودتك. حسابك جاهز.') })
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
        loadProfile(data.session.access_token)
        loadNotifications(data.session.access_token)
        loadFutureLetters(data.session.access_token)
        loadAdminStats(data.session.access_token)
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
    if (!authToken || !window.confirm(x('Delete this message permanently?', 'هل تريد حذف هذه الرسالة نهائيًا؟'))) return
    try {
      const response = await fetch(`${API_BASE}/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!response.ok) await readJson(response, 'تعذر حذف الرسالة.')
      setMyMessages((current) => current.filter((message) => message.id !== messageId))
      setMessages((current) => current.filter((message) => message.id !== messageId))
      setCurrentBottle((current) => current?.id === messageId ? null : current)
      setNotice({ type: 'success', text: x('Message deleted.', 'تم حذف الرسالة.') })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  const favoriteMessages = useMemo(
    () => messages.filter((message) => favoriteIds.includes(message.id)),
    [messages, favoriteIds],
  )

  const filterAccountMessages = useCallback((items) => items
    .filter((message) => !accountQuery.trim() || `${message.content} ${message.signature || ''}`.toLowerCase().includes(accountQuery.trim().toLowerCase()))
    .filter((message) => accountMood === 'all' || message.mood === accountMood)
    .filter((message) => accountRarity === 'all' || (accountRarity === 'rare' ? message.rarity && message.rarity !== 'common' : message.rarity === accountRarity))
    .sort((first, second) => {
      if (accountSort === 'engagement') {
        const score = (message) => Object.values(message.reactions || {}).reduce((sum, count) => sum + count, 0) + (message.replies?.length || 0) * 2
        return score(second) - score(first)
      }
      return new Date(second.createdAt) - new Date(first.createdAt)
    }), [accountQuery, accountMood, accountRarity, accountSort])

  const filteredMyMessages = useMemo(
    () => filterAccountMessages(myMessages),
    [myMessages, filterAccountMessages],
  )
  const filteredFavoriteMessages = useMemo(
    () => filterAccountMessages(favoriteMessages),
    [favoriteMessages, filterAccountMessages],
  )
  const profileStats = useMemo(() => ({
    messages: myMessages.length,
    favorites: favoriteIds.length,
    replies: myMessages.reduce((total, message) => total + (message.replies?.length ?? 0), 0),
    reactions: myMessages.reduce((total, message) => total + Object.values(message.reactions || {}).reduce((sum, count) => sum + count, 0), 0),
  }), [myMessages, favoriteIds])

  const achievements = useMemo(() => {
    const rareMessages = myMessages.filter((message) => message.rarity && message.rarity !== 'common').length
    return [
      { id: 'first-bottle', emoji: '⚱', en: 'First Bottle', ar: 'أول زجاجة', unlocked: profileStats.messages >= 1, progress: `${Math.min(profileStats.messages, 1)}/1` },
      { id: 'storyteller', emoji: '✦', en: 'Storyteller', ar: 'حكّاء البحر', unlocked: profileStats.messages >= 10, progress: `${Math.min(profileStats.messages, 10)}/10` },
      { id: 'echo-heard', emoji: '↳', en: 'Echo Heard', ar: 'صدى مسموع', unlocked: profileStats.replies >= 1, progress: `${Math.min(profileStats.replies, 1)}/1` },
      { id: 'heart-keeper', emoji: '♡', en: 'Heart Keeper', ar: 'حارس القلوب', unlocked: profileStats.reactions >= 25, progress: `${Math.min(profileStats.reactions, 25)}/25` },
      { id: 'collector', emoji: '☆', en: 'Shore Collector', ar: 'جامع الشاطئ', unlocked: profileStats.favorites >= 5, progress: `${Math.min(profileStats.favorites, 5)}/5` },
      { id: 'rare-tide', emoji: '◈', en: 'Rare Tide', ar: 'موجة نادرة', unlocked: rareMessages >= 1, progress: `${Math.min(rareMessages, 1)}/1` },
    ]
  }, [myMessages, profileStats])

  const moodMap = useMemo(() => {
    const total = messages.length
    return moods.map((mood) => {
      const count = messages.filter((message) => message.mood === mood.id).length
      return { ...mood, count, percentage: total > 0 ? Math.round((count / total) * 100) : 0 }
    })
  }, [messages])

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
      setNotice({ type: 'error', text: x('Write at least 3 characters.', 'اكتب رسالة من 3 أحرف على الأقل.') })
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
      playChime(460)
      setForm({ content: '', signature: '', mood: 'curious', oneTime: false })
      window.localStorage.removeItem('echobottle-draft')
      setNotice({
        type: 'success',
        text: x('Your message is now drifting at sea. You can open a new bottle.', 'انطلقت رسالتك في البحر. تستطيع الآن فتح رسالة جديدة.'),
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
      playChime(610)
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
      if (reaction.id === 'heart') setHeartBurst((current) => current + 1)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setIsReacting(false)
    }
  }

  const sendReply = async (event) => {
    event.preventDefault()

    if (!currentBottle || replyText.trim().length < 3) {
      setNotice({ type: 'error', text: x('Write a reply with at least 3 characters.', 'اكتب ردًا قصيرًا من 3 أحرف على الأقل.') })
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
      setNotice({ type: 'success', text: x('Your reply reached the bottle.', 'وصل ردك إلى الزجاجة.') })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setIsReplying(false)
    }
  }

  return (
    <div className={`app app--theme-${theme} ${page === 'auth' ? 'app--auth' : ''} ${page === 'settings' ? 'app--settings' : ''} ${reducedMotion ? 'app--reduced-motion' : ''}`}>
      <header className="site-header">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigate('home') }} aria-label="EchoBottle home">
          <span className="brand-bottle" aria-hidden="true"><span /></span>
          <span>EchoBottle</span>
        </a>

        <nav className={`main-nav ${navOpen ? 'is-open' : ''}`} aria-label={x('Main navigation', 'التنقل الرئيسي')}>
          <div className={`nav-heart ${heartBurst > 0 ? 'is-loved' : ''}`} key={heartBurst} aria-hidden="true">
            <span className="nav-heart__spark nav-heart__spark--one" />
            <span className="nav-heart__spark nav-heart__spark--two" />
            <span className="nav-heart__spark nav-heart__spark--three" />
            <svg viewBox="0 0 100 90">
              <path d="M50 82C41 69 12 52 12 28C12 11 33 5 50 24C67 5 88 11 88 28C88 52 59 69 50 82Z" />
            </svg>
          </div>
          <button className="nav-orb" type="button" onClick={() => setNavOpen((current) => !current)} aria-expanded={navOpen} aria-label={x('Open navigation', 'فتح القائمة')}>☾</button>
          <div className="nav-links">
            <a href="#compose" onClick={() => setNavOpen(false)}>{x('Write', 'اكتب')}</a>
            <a href="#discover" onClick={() => setNavOpen(false)}>{x('Discover', 'اكتشف')}</a>
            <a href="#shoreline" onClick={() => setNavOpen(false)}>{x('Shoreline', 'الشاطئ')}</a>
            <button type="button" onClick={() => { setNavOpen(false); navigate('settings') }}>⚙ {x('Settings', 'الإعدادات')}</button>
            {authUser ? <button className="main-nav__profile" type="button" onClick={() => { setNavOpen(false); navigate('auth') }}>{profileAvatars.find((avatar) => avatar.id === profileAvatar)?.emoji} {x('Profile', 'الملف الشخصي')}{displayName ? ` · ${displayName}` : ''}</button> : <button className="main-nav__account" type="button" onClick={() => { setNavOpen(false); navigate('auth') }}>{x('Sign in / Create account', 'تسجيل الدخول / إنشاء حساب')}</button>}
          </div>
        </nav>

        <div className="nav-ecg" aria-hidden="true">
          <svg viewBox="0 0 520 54" preserveAspectRatio="none">
            <defs>
              <linearGradient id="nav-ecg-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ff9e7a" />
                <stop offset="48%" stopColor="#f2c779" />
                <stop offset="100%" stopColor="#7dd3c7" />
              </linearGradient>
              <filter id="nav-ecg-glow" x="-20%" y="-100%" width="140%" height="300%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path className="nav-ecg__base" d="M0 28H82L96 28L108 13L122 43L138 5L154 49L171 28H236L249 28L260 18L272 37L286 28H520" />
            <path className="nav-ecg__pulse" d="M0 28H82L96 28L108 13L122 43L138 5L154 49L171 28H236L249 28L260 18L272 37L286 28H520" />
          </svg>
          <span />
        </div>

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
        {page === 'settings' && <section className="settings-page" aria-labelledby="settings-title">
          <button className="back-home" type="button" onClick={() => navigate('home')}>← {x('Back to EchoBottle', 'العودة إلى EchoBottle')}</button>
          <div className="settings-card">
            <span className="settings-card__eyebrow">⚙ {x('Your experience', 'تجربتك')}</span>
            <h1 id="settings-title">{x('Settings', 'الإعدادات')}</h1>
            <p>{x('Make the sea feel comfortable for you. Changes are saved automatically on this device.', 'اجعل البحر مريحًا لك. تُحفظ التغييرات تلقائيًا على هذا الجهاز.')}</p>
            <div className="settings-list">
              <div className="setting-row setting-row--theme"><div><strong>{x('Sea atmosphere', 'أجواء البحر')}</strong><small>{x('Choose the colors that match your moment.', 'اختر الألوان التي تناسب لحظتك.')}</small></div><div className="theme-picker" role="group" aria-label={x('Color theme', 'نمط الألوان')}><button type="button" className={`theme-swatch theme-swatch--ocean ${theme === 'ocean' ? 'is-active' : ''}`} onClick={() => setTheme('ocean')}><span />{x('Ocean', 'البحر')}</button><button type="button" className={`theme-swatch theme-swatch--midnight ${theme === 'midnight' ? 'is-active' : ''}`} onClick={() => setTheme('midnight')}><span />{x('Night', 'الليل')}</button><button type="button" className={`theme-swatch theme-swatch--sunset ${theme === 'sunset' ? 'is-active' : ''}`} onClick={() => setTheme('sunset')}><span />{x('Sunset', 'الغروب')}</button></div></div>
              <div className="setting-row"><div><strong>{x('Interface language', 'لغة الواجهة')}</strong><small>{x('Choose Arabic or English.', 'اختر العربية أو الإنجليزية.')}</small></div><div className="segmented-control"><button type="button" className={language === 'ar' ? 'is-active' : ''} onClick={() => setLanguage('ar')}>العربية</button><button type="button" className={language === 'en' ? 'is-active' : ''} onClick={() => setLanguage('en')}>English</button></div></div>
              <label className="setting-row"><div><strong>{x('Calm motion', 'حركة هادئة')}</strong><small>{x('Reduce waves, pulses, and page transitions.', 'قلّل حركة الأمواج والنبضات وانتقالات الصفحة.')}</small></div><input className="setting-toggle" type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /></label>
              <label className="setting-row"><div><strong>{x('Sea sounds', 'أصوات البحر')}</strong><small>{x('Play a soft chime when sending or opening a bottle.', 'شغّل نغمة هادئة عند إرسال أو فتح زجاجة.')}</small></div><input className="setting-toggle" type="checkbox" checked={soundEnabled} onChange={(event) => { setSoundEnabled(event.target.checked); if (event.target.checked) window.setTimeout(() => playChime(540), 0) }} /></label>
            </div>
            <p className="settings-card__privacy">◌ {x('These preferences stay in your browser and are not linked to your account.', 'تبقى هذه التفضيلات في متصفحك ولا ترتبط بحسابك.')}</p>
          </div>
        </section>}
        <section id="account" className={`account-bar ${page !== 'auth' ? 'account-bar--hidden' : ''}`} aria-label={t.account}>
          {page === 'auth' && <button className="back-home" type="button" onClick={() => navigate('home')}>← {x('Back to EchoBottle', 'العودة إلى EchoBottle')}</button>}
          {authUser ? (
            <div className="my-account">
              <div><span>✦ {x('Signed in:', 'مسجل الدخول:')} {authUser.email}</span><button type="button" onClick={() => { loadMyMessages(); loadFavorites(); loadProfile(); loadNotifications(); loadFutureLetters(); loadAdminStats() }}>{x('Refresh', 'تحديث')}</button><button type="button" onClick={() => { window.localStorage.removeItem('echobottle-session'); setAuthUser(null); setAuthToken(null); setMyMessages([]); setFavoriteIds([]); setNotifications([]); setFutureLetters([]); setAdminStats(null) }}>{x('Sign out', 'خروج')}</button></div>
              {adminStats && <section className="admin-dashboard"><div className="admin-dashboard__heading"><div><span>{x('Private dashboard', 'لوحة خاصة')}</span><h3>{x('Site pulse', 'نبض الموقع')}</h3></div><button type="button" onClick={() => loadAdminStats()}>{x('Refresh', 'تحديث')}</button></div><div className="admin-dashboard__grid"><span><strong>{adminStats.visitorsToday}</strong>{x('Visitors today', 'زوار اليوم')}</span><span><strong>{adminStats.onlineNow}</strong>{x('Online now', 'متصلون الآن')}</span><span><strong>{adminStats.registeredAccounts}</strong>{x('Accounts', 'حسابات')}</span><span><strong>{adminStats.messages}</strong>{x('Messages', 'رسائل')}</span><span><strong>{adminStats.replies}</strong>{x('Replies', 'ردود')}</span><span><strong>{adminStats.reactions}</strong>{x('Reactions', 'تفاعلات')}</span></div><div className="admin-insights"><div className="visitor-chart"><div><strong>{x('Last 7 days', 'آخر 7 أيام')}</strong><span className={adminStats.visitorChange >= 0 ? 'is-up' : 'is-down'}>{adminStats.visitorChange >= 0 ? '↗' : '↘'} {Math.abs(adminStats.visitorChange)}%</span></div><div className="visitor-chart__bars">{adminStats.visitorTrend?.map((day) => { const peak = Math.max(...adminStats.visitorTrend.map((item) => item.visitors), 1); return <span key={day.date} title={`${day.date}: ${day.visitors}`}><i style={{ height: `${Math.max(8, (day.visitors / peak) * 100)}%` }} /><small>{new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', { weekday: 'narrow' }).format(new Date(`${day.date}T12:00:00Z`))}</small></span> })}</div></div><div className="conversion-card"><span>◎</span><strong>{adminStats.accountConversion}%</strong><small>{x('Visitor-to-account ratio', 'نسبة الزوار إلى الحسابات')}</small></div></div><p>{x('Visitors are counted with a daily anonymous hash; no raw IP addresses are stored.', 'يُحسب الزوار ببصمة يومية مجهولة، ولا يتم تخزين عناوين IP الأصلية.')}</p><div className="moderation-list"><h4>{x('Pending reports', 'بلاغات قيد المراجعة')} ({adminStats.reports?.length || 0})</h4>{adminStats.reports?.map((report) => <div key={report.id}><span>{x('Reason:', 'السبب:')} {report.reason}</span><small>{formatDate(report.created_at)}</small><button type="button" onClick={() => moderateReport(report.id, 'dismiss')}>{x('Dismiss', 'تجاهل')}</button><button type="button" className="delete-message" onClick={() => moderateReport(report.id, 'delete')}>{x('Delete message', 'حذف الرسالة')}</button></div>)}</div></section>}
              <p className="my-account__title">{x('My messages', 'رسائلي')} ({myMessages.length})</p>
              <section className={`profile-customizer profile-customizer--${profileColor}`}><div className="profile-preview"><span>{profileAvatars.find((avatar) => avatar.id === profileAvatar)?.emoji}</span><div><strong>{displayName || x('Anonymous sailor', 'بحّار مجهول')}</strong><p>{profileBio || x('Your short bio will appear here.', 'ستظهر نبذتك القصيرة هنا.')}</p></div></div><form className="profile-form" onSubmit={saveProfile}><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength="32" placeholder={x('Choose a display name', 'اختر اسمًا مستعارًا')} /><textarea value={profileBio} onChange={(event) => setProfileBio(event.target.value)} maxLength="120" placeholder={x('A short bio about you…', 'نبذة قصيرة عنك…')} /><div className="profile-choices"><div>{profileAvatars.map((avatar) => <button type="button" key={avatar.id} className={profileAvatar === avatar.id ? 'is-selected' : ''} onClick={() => setProfileAvatar(avatar.id)}>{avatar.emoji}</button>)}</div><div>{profileColors.map((color) => <button type="button" key={color} className={`profile-color profile-color--${color} ${profileColor === color ? 'is-selected' : ''}`} onClick={() => setProfileColor(color)} aria-label={color} />)}</div></div><button type="submit">{x('Save profile', 'حفظ الملف')}</button></form></section>
              <div className="profile-stats"><span><strong>{profileStats.messages}</strong>{x('Messages', 'رسائل')}</span><span><strong>{profileStats.favorites}</strong>{x('Saved', 'محفوظة')}</span><span><strong>{profileStats.replies}</strong>{x('Replies', 'ردود')}</span><span><strong>{profileStats.reactions}</strong>{x('Reactions', 'تفاعلات')}</span></div>
              <section className="achievements"><div className="achievements__heading"><div><span>{x('Your journey', 'رحلتك')}</span><h3>{x('Sea badges', 'شارات البحر')}</h3></div><strong>{achievements.filter((achievement) => achievement.unlocked).length}/{achievements.length}</strong></div><div className="achievement-grid">{achievements.map((achievement) => <article key={achievement.id} className={achievement.unlocked ? 'is-unlocked' : 'is-locked'}><span>{achievement.emoji}</span><div><strong>{language === 'ar' ? achievement.ar : achievement.en}</strong><small>{achievement.unlocked ? x('Unlocked', 'تم فتحها') : achievement.progress}</small></div></article>)}</div></section>
              <p className="my-account__title">{x('New replies', 'ردود جديدة')} ({notifications.length})</p>
              {notifications.length ? <div className="notification-list">{notifications.map((notification) => {
                const message = myMessages.find((item) => item.id === notification.message_id)
                return <button type="button" key={notification.id} onClick={() => openNotification(notification, message)}>{x('Someone replied to:', 'شخص رد على:')} {message ? preview(message.content, 34) : x('your bottle', 'رسالتك')}</button>
              })}</div> : <p className="my-account__empty">{x('No new replies yet.', 'لا توجد ردود جديدة بعد.')}</p>}
              <p className="my-account__title">{x('A letter to future you', 'رسالة إلى نفسك في المستقبل')}</p>
              <form className="future-letter-form" onSubmit={saveFutureLetter}><textarea value={futureContent} onChange={(event) => setFutureContent(event.target.value)} maxLength="500" placeholder={x('Write something future you should read…', 'اكتب شيئًا يجب أن تقرأه في المستقبل…')} required /><input type="datetime-local" value={futureDate} onChange={(event) => setFutureDate(event.target.value)} required /><button type="submit">{x('Seal this letter', 'أغلق الرسالة')}</button></form>
              {futureLetters.length ? <div className="future-letter-list">{futureLetters.map((letter) => <article key={letter.id} className={letter.is_unlocked ? 'is-unlocked' : 'is-locked'}><time dateTime={letter.unlock_at}>{formatDate(letter.unlock_at)}</time><strong>{letter.is_unlocked ? x('Opened for you', 'فُتحت لك') : x('Sealed until this date', 'مغلقة حتى هذا الموعد')}</strong><p>{letter.is_unlocked ? letter.content : x('The words will remain hidden until their time arrives.', 'ستبقى الكلمات مخفية حتى يحين موعدها.')}</p></article>)}</div> : <p className="my-account__empty">{x('No future letters yet.', 'لا توجد رسائل مستقبلية بعد.')}</p>}
              <div className="account-filters"><input type="search" value={accountQuery} onChange={(event) => setAccountQuery(event.target.value)} placeholder={x('Search your messages…', 'ابحث في رسائلك…')} /><select value={accountMood} onChange={(event) => setAccountMood(event.target.value)}><option value="all">{x('All feelings', 'كل المشاعر')}</option>{moods.map((mood) => <option key={mood.id} value={mood.id}>{moodLabel(mood)}</option>)}</select><select value={accountRarity} onChange={(event) => setAccountRarity(event.target.value)}><option value="all">{x('All rarities', 'كل الندرات')}</option><option value="rare">{x('Rare only', 'النادرة فقط')}</option><option value="legendary">{x('Legendary', 'أسطورية')}</option></select><select value={accountSort} onChange={(event) => setAccountSort(event.target.value)}><option value="newest">{x('Newest first', 'الأحدث أولًا')}</option><option value="engagement">{x('Most engaged', 'الأكثر تفاعلًا')}</option></select></div>
              {filteredMyMessages.length ? <div className="my-account__list">{filteredMyMessages.map((message) => <div key={message.id}><button type="button" onClick={() => { setCurrentBottle(message); navigate('home') }}>{preview(message.content, 46)} <small>♡ {(message.reactions?.heart ?? 0) + (message.reactions?.wave ?? 0) + (message.reactions?.spark ?? 0)} · ↳ {message.replies?.length ?? 0}</small></button><button type="button" className="delete-message" onClick={() => deleteMyMessage(message.id)}>حذف</button></div>)}</div> : <p className="my-account__empty">{x('No messages match these filters.', 'لا توجد رسائل تطابق هذه الفلاتر.')}</p>}
              <p className="my-account__title">{x('Saved', 'المفضلة')} ({favoriteMessages.length})</p>
              {filteredFavoriteMessages.length ? <div className="my-account__list">{filteredFavoriteMessages.map((message) => <div key={message.id}><button type="button" onClick={() => { setCurrentBottle(message); navigate('home') }}>{preview(message.content, 46)} <small>{getMood(message.mood).emoji} {x('Saved message', 'رسالة محفوظة')}</small></button></div>)}</div> : <p className="my-account__empty">{x('No saved messages match these filters.', 'لا توجد رسائل محفوظة تطابق هذه الفلاتر.')}</p>}
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
          <button className="daily-note" type="button" disabled={!dailyMessage} onClick={() => { if (dailyMessage) { setCurrentBottle(dailyMessage); document.querySelector('#discover')?.scrollIntoView({ behavior: 'smooth' }) } }}><span>✦ {x('Message of the day', 'رسالة اليوم')}</span><strong>{dailyMessage ? preview(dailyMessage.content, 110) : x('The sea is choosing today’s message…', 'البحر يختار رسالة اليوم…')}</strong><small>{dailyMessage ? x('Open this bottle', 'افتح هذه الزجاجة') : ''}</small></button>
        </section>

        {notice && (
          <div className={`notice notice--${notice.type}`} role="status">
            <span>{notice.type === 'success' ? '✦' : '!'}</span>
            {notice.text}
            <button type="button" onClick={() => setNotice(null)} aria-label="إغلاق التنبيه">×</button>
          </div>
        )}

        <section className="workspace" aria-label="Message workspace">
          <section id="compose" className="compose-panel panel" aria-labelledby="compose-title">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">01 — {x('WRITE', 'أرسل')}</p>
                <h2 id="compose-title">{x('Write a message in a bottle', 'اكتب رسالة في زجاجة')}</h2>
              </div>
              <span className="tiny-note">{x('Stays anonymous', 'تبقى مجهولة')}</span>
            </div>

            <form className="message-form" onSubmit={handleSubmit}>
              <label className="field-label" htmlFor="message-content">{x('What would you like to tell the sea?', 'ما الذي تريد أن تقوله للبحر؟')}</label>
              <button className="prompt-button" type="button" onClick={() => setPromptIndex((current) => (current + 1) % writingPrompts.length)}>✦ {x('Writing prompt:', 'فكرة للكتابة:')} {prompt}</button>
              <textarea
                id="message-content"
                name="content"
                value={form.content}
                onChange={handleInputChange}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder={x('A thought, a question, or something you do not want to lose…', 'اكتب فكرة، سؤالًا، أو شيئًا لا تريد أن يضيع…')}
                required
              />
              <div className="message-meta">
                <span className={draftSaved ? 'draft-status is-saved' : 'draft-status'} aria-live="polite">
                  {form.content || form.signature
                    ? (draftSaved ? x('Draft saved', 'تم حفظ المسودة') : x('Saving draft…', 'جارٍ حفظ المسودة…'))
                    : x('Drafts save automatically', 'تُحفظ المسودات تلقائيًا')}
                </span>
                <span className="character-count" aria-live="polite">{form.content.length}/{MAX_MESSAGE_LENGTH}</span>
              </div>

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

              <label className={`one-time-option ${form.oneTime ? 'is-selected' : ''}`}>
                <input type="checkbox" checked={form.oneTime} onChange={(event) => setForm((current) => ({ ...current, oneTime: event.target.checked }))} />
                <span>◒</span>
                <div><strong>{x('One Tide', 'موجة واحدة')}</strong><small>{x('Disappears after one person opens it.', 'تختفي بعد أن يفتحها شخص واحد.')}</small></div>
              </label>

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

          <section id="discover" className="discover-panel panel" aria-labelledby="discover-title">
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
                <article className={`message-card message-card--${currentBottle.rarity || 'common'}`} style={{ '--message-color': currentMood.color }}>
                  <div className="message-card__topline">
                    <span className="mood-badge"><span aria-hidden="true">{currentMood.emoji}</span>{moodLabel(currentMood)}</span><span className="rarity-badge">{rarity(currentBottle.rarity).emoji} {language === 'ar' ? rarity(currentBottle.rarity).ar : rarity(currentBottle.rarity).en}</span>
                    <time dateTime={currentBottle.createdAt}>{formatDate(currentBottle.createdAt)}</time>
                  </div>
                  <blockquote>“{currentBottle.content}”</blockquote>
                  <div className="message-signature"><span className="signature-line" />{currentBottle.signature || x('An anonymous voice', 'صوت مجهول')}</div>

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
                  <button type="button" className="share-card-button" onClick={shareMessageCard} disabled={isSharing}>↗ {isSharing ? x('Creating image…', 'جارٍ إنشاء الصورة…') : x('Share as an image', 'مشاركة كصورة')}</button>
                  <div className="report-control"><select value={reportReason} onChange={(event) => setReportReason(event.target.value)} aria-label={x('Report reason', 'سبب البلاغ')}><option value="">{x('Report this message…', 'الإبلاغ عن الرسالة…')}</option><option value="harmful">{x('Harmful content', 'محتوى مؤذٍ')}</option><option value="spam">{x('Spam', 'مزعج أو متكرر')}</option><option value="personal">{x('Personal information', 'معلومات شخصية')}</option><option value="other">{x('Other', 'سبب آخر')}</option></select><button type="button" disabled={!reportReason || isReporting} onClick={reportMessage}>{isReporting ? x('Sending…', 'جارٍ الإرسال…') : x('Send report', 'إرسال البلاغ')}</button></div>

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

        <section id="mood-map" className="mood-map panel" aria-labelledby="mood-map-title">
          <div className="mood-map__heading">
            <div>
              <p className="section-kicker">{x('SEA OF FEELINGS', 'بحر المشاعر')}</p>
              <h2 id="mood-map-title">{x('What is moving through the sea?', 'ما الشعور المنتشر في البحر؟')}</h2>
            </div>
            <span>{x(`${messages.length} public bottles`, `${messages.length} زجاجة عامة`)}</span>
          </div>
          <div className="mood-map__sea">
            <div className="mood-map__waves" aria-hidden="true"><span /><span /><span /></div>
            {moodMap.map((mood, index) => (
              <article className="mood-current" key={mood.id} style={{ '--mood-color': mood.color, '--mood-share': mood.percentage, '--mood-delay': `${index * 180}ms` }}>
                <div className="mood-current__orb"><span>{mood.emoji}</span><strong>{mood.percentage}%</strong></div>
                <h3>{moodLabel(mood)}</h3>
                <p>{mood.count} {x('messages', 'رسائل')}</p>
              </article>
            ))}
          </div>
          <p className="mood-map__note">{x('The map changes whenever new bottles reach the sea.', 'تتغير الخريطة كلما وصلت زجاجات جديدة إلى البحر.')}</p>
        </section>

        <section id="shoreline" className="shoreline panel" aria-labelledby="shoreline-title">
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
                    <small>{message.signature || x('An anonymous voice', 'صوت مجهول')}</small>
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
