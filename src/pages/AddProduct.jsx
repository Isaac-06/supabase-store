
import { supabase } from "../supabase";

function AddProduct() {
  async function addProduct() {
    const { error } = await supabase
      .from("products")
      .insert([
        {
          name: "Wireless Headphones",
          price: 120,
          image: "wireless.webp",
          description: "Premium wireless headphones",
        },
      ]);

    if (error) {
      console.log(error.message);
    } else {
      console.log("Product added");
    }
  }

  return (
    <button onClick={addProduct}>
      Add Product
    </button>
  );
}

export default AddProduct;
