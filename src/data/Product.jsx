import { useEffect, useState } from "react";
import { supabase } from "../supabase";

function Products() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    async function getProducts() {
      const { data, error } = await supabase
        .from("products")
        .select("*");

      if (error) {
        console.log(error.message);
      } else {
        setProducts(data);
      }
    }

    getProducts();
  }, []);

  return (
    <div>
      {products.map((product) => (
        <h3 key={product.id}>{product.name}</h3>
      ))}
    </div>
  );
}

export default Products;