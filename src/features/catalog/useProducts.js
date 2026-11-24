import { useEffect, useState } from 'react'
import { getSupabaseConfigError, isSupabaseConfigured, supabase } from '../../shared/services/supabase.js'

export default function useProducts() {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      if (!isSupabaseConfigured) {
        setError(getSupabaseConfigError())
        setIsLoading(false)
        return
      }

      const { data, error: queryError } = await supabase.from('products').select('*').order('id')
      if (!isMounted) return

      if (queryError) {
        setError(queryError.message)
      } else {
        setProducts(data.map((product) => ({
          ...product,
          varieties: Array.isArray(product.varieties) ? product.varieties.flat() : [],
          specifications: product.specifications && typeof product.specifications === 'object'
            ? product.specifications
            : {},
        })))
      }
      setIsLoading(false)
    }

    void loadProducts()

    return () => {
      isMounted = false
    }
  }, [])

  return { products, isLoading, error }
}
