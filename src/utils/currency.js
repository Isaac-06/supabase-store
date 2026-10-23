const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  currencyDisplay: 'symbol',
})

export function formatCurrency(value) {
  return nairaFormatter.format(Number(value) || 0)
}
