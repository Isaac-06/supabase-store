import { useState } from 'react'
import { formatCurrency } from '../utils/currency'

//When product details is opened,display:
// product information,
// a function for the Back button
// a function for the Add to Cart button
function ProductDetails({ product, onBack, onAddToCart }) {
	
	//If the product has multiple images, use them; otherwise, use the single image
	const images = Array.isArray(product.images) && product.images.length ? product.images : [product.image]

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
			
		
			<button type="button" className="details-back" onClick={onBack}>
				Back to shop
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

					<button type="button" className="primary-btn details-add" onClick={onAddToCart}>
						Add to Cart
					</button>
				</div>
			</div>

			<section className="product-specifications">
				<h2>Specifications</h2>
				<dl>
					{Object.entries(product.specifications ?? {}).map(([label, value]) => (
						<div className="specification-row" key={label}>
							<dt>{label}</dt>
							<dd>{value}</dd>
						</div>
					))}


				</dl>
			</section>
		</section>
	)
}

export default ProductDetails
