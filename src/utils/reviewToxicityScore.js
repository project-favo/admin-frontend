/**
 * ReviewResponseDto / JSON: toxicityScore (Double 0–1). Bazı ortamlar snake_case dönebilir.
 * @see https://github.com/project-favo/backend/blob/main/src/main/java/com/favo/backend/Domain/review/ReviewResponseDto.java
 */
export function extractToxicityScore(review) {
  if (!review || typeof review !== 'object') return null;
  const nested =
    review.toxicity && typeof review.toxicity === 'object' ? review.toxicity.score : undefined;
  const v =
    review.toxicityScore ??
    review.toxicity_score ??
    review.toxicScore ??
    nested;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Backend HF analizi yalnızca description üzerinde; tahminde de ağırlık buna yakın. */
export function buildTextForLocalToxicityEstimate(review) {
  const title = review?.title != null ? String(review.title).trim() : '';
  const desc = review?.description != null ? String(review.description).trim() : '';
  if (desc && title && desc !== title) return `${desc}\n${title}`;
  return desc || title || '';
}

/**
 * API skoru yokken (DB'de null — çoğunlukla HUGGINGFACE_API_TOKEN eksik veya eski kayıt) gösterilebilir bir 0–100 tahmin.
 * Gerçek model skoru değildir; ToxicityService ile aynı değeri vermez.
 */
export function estimateToxicityPercentFromText(text) {
  const s = text != null ? String(text).trim() : '';
  if (!s) return null;
  const lower = s.toLowerCase();
  let hits = 0;
  const wordPatterns = [
    /\b(siktir|sikerim|orospu|piç|aptal|salak|gerizekalı|şerefsiz|kahpe|öldür|katil)\b/giu,
    /\b(fuck|shit|bitch|asshole|crap|damn|hate|kill|idiot|stupid|moron|dumb)\b/giu,
  ];
  for (const p of wordPatterns) {
    const m = lower.match(p);
    if (m) hits += m.length;
  }
  const chaos =
    (s.match(/[!]{3,}/g) || []).length + (s.match(/[A-Za-z]{20,}/g) || []).length;
  hits += chaos;
  const raw = Math.min(95, hits * 16 + (s.length > 800 ? 8 : 0));
  return Math.round(raw);
}

/** 0–1 veya 0–100 değerini yüzde tamsayıya çevirir (HuggingFace "toxic" skoru 0–1). */
export function toxicityToPercent(raw) {
  if (raw == null) return null;
  if (raw >= 0 && raw <= 1) return Math.round(raw * 100);
  if (raw > 1 && raw <= 100) return Math.round(raw);
  return null;
}

/**
 * Moderation filtresi ve otomatik red ile aynı yüzde kaynağı (API skoru veya metin tahmini).
 * @returns {number|null} 0–100 veya skor yoksa null
 */
export function getReviewToxicityPercent(review) {
  const raw = extractToxicityScore(review);
  let pct = toxicityToPercent(raw);
  if (pct == null) {
    const text = buildTextForLocalToxicityEstimate(review);
    pct = estimateToxicityPercentFromText(text);
  }
  return pct != null && Number.isFinite(pct) ? pct : null;
}
