import '../styles/ProductTable.css';

/**
 * @typedef {Object} ProductTableRow
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {string} rating
 */

/**
 * @param {{ products: ProductTableRow[] }} props
 */
const ProductTable = ({ products }) => {
  return (
    <section className="products-table-wrap" aria-label="Product list">
      <div className="products-table-scroll">
        <table className="products-table">
          <colgroup>
            <col className="products-table-col-image" />
            <col className="products-table-col-name" />
            <col className="products-table-col-category" />
            <col className="products-table-col-rating" />
            <col className="products-table-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Image</th>
              <th scope="col">Product Name</th>
              <th scope="col">Category</th>
              <th scope="col">Rating</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(({ id, name, category, rating }) => (
              <tr key={id}>
                <td>🖼️</td>
                <td>{name}</td>
                <td>{category}</td>
                <td>{rating}</td>
                <td>⋮</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ProductTable;
