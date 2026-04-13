import '../styles/Products.css';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductCategoryPicker from '../components/ProductCategoryPicker';
import {
  buildProductCreateBody,
  messageFromFailedResponse,
  postProduct,
} from '../api/adminApi';

function AddProduct() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(
    /** @type {null | { id: number, name: string, categoryPath?: string }} */ (null)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const body = buildProductCreateBody({
      name,
      description,
      imageURL,
      tagId: selectedCategory?.id ?? '',
    });

    if (!body.name) {
      setError('Name is required.');
      return;
    }
    if (!Number.isFinite(body.tagId)) {
      setError('Choose a leaf category (navigate until a category is selected).');
      return;
    }

    const payload = {
      name: body.name,
      description: body.description,
      imageURL: body.imageURL,
      tagId: body.tagId,
    };

    setSubmitting(true);
    try {
      const res = await postProduct(payload);
      if (!res.ok) {
        const detail = await messageFromFailedResponse(res);
        throw new Error(
          detail ||
            `Could not create product (${res.status}). The category must be a leaf tag.`
        );
      }
      let newProductId = null;
      try {
        const created = await res.json();
        if (created && typeof created === 'object' && created.id != null) {
          newProductId = created.id;
        }
      } catch {
        /* ignore parse errors */
      }
      navigate('/products', {
        state: { refreshProducts: true, newProductId },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="products-page">
      <div className="products-page-inner">
        <header className="products-header">
          <p className="products-add-back">
            <Link to="/products">← Back to catalog</Link>
          </p>
          <h2 className="products-main-title">Add product</h2>
          <p className="products-subtitle">
            Pick a category by browsing or search. Products attach to a{' '}
            <span className="products-add-em">leaf</span> category (no subcategories). You can
            add a new category if it does not exist yet.
          </p>
        </header>

        {error && (
          <div className="products-alert products-alert--error" role="alert">
            {error}
          </div>
        )}

        <form className="products-add-card products-add-card--wide" onSubmit={handleSubmit}>
          <div className="products-modal-field">
            <label htmlFor="product-add-name">Name</label>
            <input
              id="product-add-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              autoComplete="off"
              required
            />
          </div>
          <div className="products-modal-field">
            <label htmlFor="product-add-desc">Description</label>
            <textarea
              id="product-add-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="products-modal-field">
            <label htmlFor="product-add-img">Image URL</label>
            <input
              id="product-add-img"
              value={imageURL}
              onChange={(e) => setImageURL(e.target.value)}
              disabled={submitting}
              autoComplete="off"
              placeholder="https://…"
            />
          </div>

          <div className="products-modal-field">
            <span className="products-category-section-label">Category</span>
            <ProductCategoryPicker
              value={selectedCategory}
              onChange={setSelectedCategory}
              disabled={submitting}
            />
          </div>

          <div className="products-add-actions">
            <Link className="products-add-cancel" to="/products">
              Cancel
            </Link>
            <button type="submit" className="products-add-submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddProduct;
