/**
 * اسم المتجر مع رقم/كود المتجر بجانبه — للنوافذ، البطاقات، القوائم
 */
export default function StoreNameWithId({
  store,
  wrapClassName = '',
  nameClassName = '',
  idClassName = 'font-mono tabular-nums shrink-0 opacity-90',
  idPrefix = '#',
}) {
  if (!store) return null
  const id = store.id ?? store.store_id
  return (
    <span className={`inline-flex items-center gap-1.5 flex-wrap min-w-0 ${wrapClassName}`}>
      <span className={`truncate ${nameClassName}`}>{store.name ?? '—'}</span>
      {id != null && id !== '' && (
        <span className={idClassName} dir="ltr">
          {idPrefix}
          {id}
        </span>
      )}
    </span>
  )
}
