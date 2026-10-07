import { useState } from 'react'

function ProductDetails({ product, onBack, onAddToCart }) {
	const images = product.images?.length ? product.images : [product.image]
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
					<p className="product-detail-description">{product.description}</p>

					<div className="product-varieties">
						<h2>Varieties</h2>
						<ul>
							{product.varieties.map((variety) => <li key={variety}>{variety}</li>)}
						</ul>
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
