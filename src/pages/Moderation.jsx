import '../styles/Moderation.css';
import ModerationTable from '../components/ModerationTable';

const TOTAL_PENDING = 142;

const MOCK_MODERATION_ITEMS = [
  {
    id: '1',
    contentPreview: '🖼️ "Terrible, don\'t buy.."',
    flagReason: 'Spam / Bot',
    aiScore: '🔴 98%',
  },
  {
    id: '2',
    contentPreview: '🖼️ Suspicious Image.jpg',
    flagReason: 'NSFW Photo',
    aiScore: '🔴 95%',
  },
  {
    id: '3',
    contentPreview: '🖼️ "Click link for %50.."',
    flagReason: 'Scam Link',
    aiScore: '🟠 82%',
  },
  {
    id: '4',
    contentPreview: '🖼️ "Fake review from..."',
    flagReason: 'Harassment',
    aiScore: '🟡 65%',
  },
  {
    id: '5',
    contentPreview: '🖼️ "Not as described!!"',
    flagReason: 'Misleading',
    aiScore: '🟡 60%',
  },
];

const Moderation = () => {
  const showingFrom = 1;
  const showingTo = MOCK_MODERATION_ITEMS.length;

  return (
    <div className="moderation-page">
      <h2 className="moderation-main-title">Content Moderation Queue</h2>

      <div className="moderation-toolbar" aria-label="Moderation queue controls">
        <div className="moderation-toolbar-count">
          <span>Pending ({TOTAL_PENDING})</span>
        </div>
        <span className="moderation-toolbar-meta">Filter: High Risk ⌄</span>
        <span className="moderation-toolbar-meta">Auto-Reject Spam</span>
      </div>

      <ModerationTable items={MOCK_MODERATION_ITEMS} />

      <footer className="moderation-footer">
        <p className="moderation-footer-summary">
          Showing {showingFrom}-{showingTo} of {TOTAL_PENDING} flagged items
        </p>
        <nav className="moderation-pagination" aria-label="Pagination">
          <button type="button" disabled>
            &lt; Prev
          </button>
          <span className="moderation-pagination-page" aria-current="page">
            1
          </span>
          <span className="moderation-pagination-page">2</span>
          <button type="button">Next &gt;</button>
        </nav>
      </footer>
    </div>
  );
};

export default Moderation;
