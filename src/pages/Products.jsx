import '../styles/Products.css';
import ProductTable from '../components/ProductTable';

const TOTAL_PRODUCTS = 8_240;

const MOCK_PRODUCTS = [
  {
    id: '1',
    name: 'iPhone 15 Pro',
    category: 'Electronics',
    rating: '⭐ 4.8',
  },
  {
    id: '2',
    name: 'Dyson V15 Detect',
    category: 'Home App',
    rating: '⭐ 4.6',
  },
  {
    id: '3',
    name: 'Nike Air Force 1',
    category: 'Fashion',
    rating: '⭐ 4.2',
  },
  {
    id: '4',
    name: 'Sony WH-1000XM5',
    category: 'Electronics',
    rating: '⭐ 4.9',
  },
  {
    id: '5',
    name: 'The Ordinary Serum',
    category: 'Cosmetics',
    rating: '⭐ 4.1',
  },
  {
    id: '6',
    name: 'Stanley Quencher',
    category: 'Lifestyle',
    rating: '⭐ 4.5',
  },
];

const Products = () => {
  const formattedTotal = TOTAL_PRODUCTS.toLocaleString('en-US');
  const showingFrom = 1;
  const showingTo = MOCK_PRODUCTS.length;

  return (
    <div className="products-page">
      <h2 className="products-main-title">Product Catalog Management</h2>

      <div className="products-toolbar" aria-label="Product list controls">
        <div className="products-toolbar-count">
          <span>All Products ({formattedTotal})</span>
        </div>
        <span className="products-toolbar-meta">Filter: All ⌄</span>
        <span className="products-toolbar-meta">+ Add New</span>
      </div>

      <ProductTable products={MOCK_PRODUCTS} />

      <footer className="products-footer">
        <p className="products-footer-summary">
          Showing {showingFrom}-{showingTo} of {formattedTotal} products
        </p>
        <nav className="products-pagination" aria-label="Pagination">
          <button type="button" disabled>
            &lt; Prev
          </button>
          <span className="products-pagination-page" aria-current="page">
            1
          </span>
          <span className="products-pagination-page">2</span>
          <button type="button">Next &gt;</button>
        </nav>
      </footer>
    </div>
  );
};

export default Products;
