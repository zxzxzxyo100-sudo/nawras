import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, MessageCircle, PhoneCall, ChevronDown } from 'lucide-react'
import { usePrivateTicketsAlert } from '../contexts/PrivateTicketsAlertContext'
import {
  DEVIATION_URGENT_DAYS_SINCE_LAST_SHIPMENT,
  getDaysSinceShipFromDeviationTicket,
} from '../utils/deviationTicket'

function parseMeta(ticket) {
  if (!ticket?.meta_json) return {}
  try {
    return typeof ticket.meta_json === 'string' ? JSON.parse(ticket.meta_json) : ticket.meta_json
  } catch {
    return {}
  }
}

function playAlertTone() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 880
    o.connect(g)
    g.connect(ctx.destination)
    g.gain.setValueAtTime(0.07, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28)
    o.start(ctx.currentTime)
    o.stop(ctx.currentTime + 0.28)
  } catch {
    /* ignore */
  }
}

const DISMISS_KEY = 'deviation_overlay_soft_dismiss'

export default function DeviationAlertOverlay() {
  const navigate = useNavigate()
  const {
    deviationLockdown,
    primaryDeviationTicket,
    deviationOverlayPulse,
    refreshPrivateTicketsAlert,
  } = usePrivateTicketsAlert()

  const [softDismiss, setSoftDismiss] = useState(false)
  const [cooldown, setCooldown] = useState(6)

  const meta = useMemo(() => parseMeta(primaryDeviationTicket), [primaryDeviationTicket])
  const daysFromTicket = primaryDeviationTicket
    ? getDaysSinceShipFromDeviationTicket(primaryDeviationTicket)
    : null
  const daysSinceShipLabel = daysFromTicket != null ? String(daysFromTicket) : '—'
  const ticketId = primaryDeviationTicket?.id

  useEffect(() => {
    if (!ticketId) return
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      setSoftDismiss(Boolean(parsed[String(ticketId)]))
    } catch {
      setSoftDismiss(false)
    }
  }, [ticketId])

  useEffect(() => {
    if (!deviationLockdown || softDismiss) return
    setCooldown(6)
    const t = setInterval(() => setCooldown(c => (c <= 0 ? 0 : c - 1)), 1000)
    return () => clearInterval(t)
  }, [deviationLockdown, softDismiss, ticketId])

  useEffect(() => {
    if (deviationOverlayPulse > 0) playAlertTone()
  }, [deviationOverlayPulse])

  const openWhatsApp = useCallback(() => {
    const url = meta.whatsapp_url
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }, [meta.whatsapp_url])

  const goCallNow = useCallback(() => {
    openWhatsApp()
    navigate('/', { state: { scrollToDeviationTicketId: ticketId } })
    void refreshPrivateTicketsAlert()
  }, [navigate, openWhatsApp, refreshPrivateTicketsAlert, ticketId])

  const softDismissTicket = useCallback(() => {
    if (ticketId == null) return
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY)
      const o = raw ? JSON.parse(raw) : {}
      o[String(ticketId)] = true
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify(o))
    } catch {
      /* ignore */
    }
    setSoftDismiss(true)
  }, [ticketId])

  if (!deviationLockdown || !primaryDeviationTicket) return null

  const title = primaryDeviationTicket.title || 'تذكرة انحراف'
  const body = primaryDeviationTicket.body || ''

  return (
    <>
      {/* شريط أحمر ثابت */}
      <div
        className="sticky top-0 z-[60] flex flex-wrap items-center justify-between gap-3 border-b-2 border-red-600 bg-gradient-to-l from-red-950 via-red-900 to-red-950 px-4 py-3 text-white shadow-lg shadow-red-900/40"
        role="alert"
      >
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
          <p className="text-sm font-black leading-snug">
            ⚠️ تنبيه انحراف عاجل — أيام منذ آخر شحنة:{' '}
            <span className="tabular-nums text-amber-200">{daysSinceShipLabel}</span>
            {' (≥ '}
            <span className="tabular-nums text-amber-200">{DEVIATION_URGENT_DAYS_SINCE_LAST_SHIPMENT}</span>
            {' أيام). التوقف عن المهام الحالية ومعالجة '}
            <span className="underline decoration-amber-300/90">تذاكر الانحراف</span> فوراً.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goCallNow}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-red-900 shadow-md transition hover:bg-amber-100"
          >
            <PhoneCall className="h-4 w-4" />
            إجراء المكالمة الآن
          </button>
          {meta.whatsapp_url ? (
            <button
              type="button"
              onClick={openWhatsApp}
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-red-800/80 px-3 py-2 text-xs font-bold text-white hover:bg-red-800"
            >
              <MessageCircle className="h-4 w-4" />
              واتساب
            </button>
          ) : null}
        </div>
      </div>

      {/* طبقة تعطيل كاملة حتى «تقليل العرض» أو التنقل */}
      {!softDismiss && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border-2 border-red-500 bg-white p-6 text-right shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-red-700">تذاكر الانحراف</p>
                <h2 className="text-lg font-black text-slate-900">{title}</h2>
              </div>
            </div>
            <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{body}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={goCallNow}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg hover:bg-red-700"
              >
                <PhoneCall className="h-4 w-4" />
                إجراء المكالمة الآن
              </button>
              {meta.whatsapp_url ? (
                <button
                  type="button"
                  onClick={openWhatsApp}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900 hover:bg-emerald-100"
                >
                  <MessageCircle className="h-4 w-4" />
                  فتح واتساب
                </button>
              ) : null}
            </div>
            <button
              type="button"
              disabled={cooldown > 0}
              onClick={softDismissTicket}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronDown className="h-4 w-4" />
              {cooldown > 0 ? `تقليل العرض (${cooldown})…` : 'تقليل العرض — يبقى الشريط الأحمر'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
