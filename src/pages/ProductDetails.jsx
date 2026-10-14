import { useState } from 'react'

function ProductDetails({ product, onBack, onAddToCart }) {
	const images = product.images?.length ? product.images : [product.image]
	const description = product.description ?? ''
	const taglineIndex = product.name.toLowerCase().includes('headphone')
		? description.toLowerCase().indexOf('experience crystal clear')
		: -1
	const [activeImage, setActiveImage] = useState(images[0])

	return (
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
					<p className="product-detail-price">${product.price}</p>
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
                     {product.varieties.map((variety) => (
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
					{Object.entries(product.specifications).map(([label, value]) => (
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
