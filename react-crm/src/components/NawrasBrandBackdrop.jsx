/**
 * خلفية باهتة من ملصق النورس + نصوص العلامة (بدل النصوص داخل الصورة الأصلية).
 * الملف: public/nawras-team-hero.png — قص الجزء السفلي (الفوتر) عبر clip-path.
 */
export const NAWRAS_TEAM_HERO_URL = `${import.meta.env.BASE_URL}nawras-team-hero.png`

/** طبقة صورة شبه شفافة — footerCropPct يخفي الشريط السفلي من التصميم */
export function NawrasHeroImageLayer({
  opacity = 0.18,
  footerCropPct = 14,
  className = '',
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage: `url(${NAWRAS_TEAM_HERO_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'top center',
        opacity,
        clipPath: `inset(0 0 ${footerCropPct}% 0)`,
      }}
    />
  )
}

/** العنوان والهاشتاق المطلوبان */
export function NawrasTaglineStack({ light = false, compact = false, className = '' }) {
  const titleCls = light
    ? 'text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]'
    : 'text-violet-950 drop-shadow-sm'
  const hashCls = light ? 'text-violet-100/95' : 'text-fuchsia-700'
  return (
    <div className={`text-right ${className}`} dir="rtl">
      <p
        className={`font-black leading-snug ${titleCls} ${
          compact ? 'text-[10px] sm:text-[11px]' : 'text-xs sm:text-sm'
        }`}
      >
        فريق مبيعات شركة النورس
      </p>
      <p className={`mt-0.5 font-bold ${hashCls} ${compact ? 'text-[9px]' : 'text-[10px] sm:text-[11px]'}`}>
        #فريق_النورس
      </p>
    </div>
  )
}
