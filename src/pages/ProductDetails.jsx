import { useState } from 'react'
import { formatCurrency } from '../utils/currency'

//When product details is opened,display:
// product information,
// a function for the Back button
// a function for the Add to Cart button
function ProductDetails({ product, onBack, onAddToCart }) {
	const [customizationNotes, setCustomizationNotes] = useState('')
	
	//If the product has multiple images, use them; otherwise, use the single image
	const images = Array.isArray(product.images) && product.images.length ? product.images : [product.image]
	const specifications = Object.entries(product.specifications ?? {}).filter(([, value]) => {
		if (typeof value === 'string') return value.trim().length > 0
		if (typeof value === 'number') return Number.isFinite(value)
		return Array.isArray(value) && value.length > 0
	})
	const supplementalSpecifications = [
		['Product', product.name],
		['Description', product.description],
		['Available varieties', Array.isArray(product.varieties) ? product.varieties.filter(Boolean).join(', ') : ''],
		['Price', Number.isFinite(Number(product.price)) ? formatCurrency(product.price) : ''],
	].filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
	const specificationLabels = new Set(specifications.map(([label]) => label.toLowerCase()))
	for (const [label, value] of supplementalSpecifications) {
		if (specifications.length >= 6) break
		if (!specificationLabels.has(label.toLowerCase())) {
			specifications.push([label, value])
			specificationLabels.add(label.toLowerCase())
		}
	}

	//If the product has no description, use an empty string
	const description = product.description ?? ''

	//If the product is a headphone, find the index of the tagline in the description
	const taglineIndex = product.name.toLowerCase().includes('headphone')
		? description.toLowerCase().indexOf('experience crystal clear')
		: -1
	//Set the first image as the active image by default
		const [activeImage, setActiveImage] = useState(images[0])

		
	return (
         //Group the product details into a section with a class name of "product-details"
		 <section className="product-details">
			
		
			<button type="button" className="back-arrow-button" aria-label="Back to shop" title="Back to shop" onClick={onBack}>
				<span className="material-symbols-outlined" aria-hidden="true">arrow_back_ios</span>
			</button>

            
			<div className="product-detail-layout">
				<div className="product-gallery">
					<img className="product-detail-image" src={activeImage} alt={product.name} />
					<div className="product-samples" aria-label="Product image samples">
						{images.map((image, index) => (
							<button
								key={image}
								type="button"
								className={activeImage === image ? 'sample-image active' : 'sample-image'}
								onClick={() => setActiveImage(image)}
								aria-label={`Show ${product.name} image ${index + 1}`}
								aria-pressed={activeImage === image}
				
							>
								<img src={image} alt="" />
							</button>
						))}   
					</div>
				</div>

				<div className="product-detail-copy">
					<p className="eyebrow">Product details</p>
					<h1>{product.name}</h1>
					<p className="product-detail-price">{formatCurrency(product.price)}</p>
					<p className="product-detail-description">
						{taglineIndex < 0 ? description : <>
							{description.slice(0, taglineIndex).trim()}
							<br />
							{description.slice(taglineIndex).trim()}
						</>}
					</p>

					<div className="product-varieties">
						<h3>Varieties</h3>
                          <div className="varieties-grid">
                     {(product.varieties ?? []).map((variety) => (
                             <div key={variety} className="variety-item">
                               {variety}
                         </div>
                  ))}
                  </div>
				  </div>

					<div className="product-customization">
						<label htmlFor="product-customization-notes">How would you like this product? (optional)</label>
						<textarea
							id="product-customization-notes"
							value={customizationNotes}
							onChange={(event) => setCustomizationNotes(event.target.value)}
							maxLength={500}
							rows={4}
							placeholder="Describe any preferences or requirements for this product."
						/>
						<p>We’ll attach your request to this product in the order. Requests are subject to availability.</p>
					</div>

					<button type="button" className="primary-btn details-add" onClick={() => onAddToCart(customizationNotes.trim())}>
						Add to Cart
					</button>
				</div>
			</div>

			<section className="product-specifications" aria-labelledby="product-specifications-title">
				<div className="product-specifications__heading">
					<div>
						<p className="eyebrow">Product information</p>
						<h2 id="product-specifications-title">Specifications</h2>
						<p>Key details to help you choose the right product.</p>
					</div>
					{specifications.length > 0 && (
						<span className="product-specifications__count">
							{specifications.length} {specifications.length === 1 ? 'detail' : 'details'}
						</span>
					)}
				</div>
				{specifications.length > 0 ? (
					<div className="product-specifications__grid">
						{specifications.map(([label, value]) => (
							<details className="specification-row" key={label}>
								<summary>{label.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')}</summary>
								<p>{Array.isArray(value) ? value.join(', ') : value}</p>
							</details>
						))}
					</div>
				) : (
					<p className="product-specifications__empty">Specifications are not available for this product yet.</p>
				)}
			</section>
		</section>
	)
}

export default ProductDetails
