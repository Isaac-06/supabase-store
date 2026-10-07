import { supabase } from "../supabase";

function UpdateProduct() {
  async function updateProduct() {
    const { error } = await supabase
      .from("products")
      .update({
        price: 150,
      })
      .eq("id", 1);

    if (error) {
      console.log(error.message);
    } else {
      console.log("Product updated");
    }
  }

  return <button type="button" onClick={updateProduct}>Update product</button>;
}

export default UpdateProduct;