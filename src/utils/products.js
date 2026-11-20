export function getProductCategory(product) {
  const category = product.specifications?.Category
  const use = product.specifications?.Use
  const isGamingProduct = [category, use, product.name].some(
    (value) => typeof value === 'string' && /\bgaming\b/i.test(value)
  )

  if (isGamingProduct) return 'Gaming'
  return typeof category === 'string' ? category.trim() : ''
}
