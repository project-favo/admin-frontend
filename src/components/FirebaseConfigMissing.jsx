export default function FirebaseConfigMissing() {
  return (
    <div className="auth-loading" style={{ padding: '2rem', maxWidth: 520 }}>
      <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.75rem', fontFamily: 'system-ui, sans-serif' }}>
        Firebase yapılandırması eksik
      </h1>
      <p style={{ margin: '0 0 0.75rem', lineHeight: 1.5, fontFamily: 'system-ui, sans-serif', color: '#333' }}>
        Proje kökünde <code style={{ fontSize: '0.9em' }}>.env</code> dosyası oluştur (veya{' '}
        <code style={{ fontSize: '0.9em' }}>.env.example</code> dosyasını kopyala) ve Firebase Console →
        Project settings → Your apps → Web uygulamasından gelen değerleri ekle:
      </p>
      <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6, fontFamily: 'system-ui, sans-serif', color: '#333' }}>
        <li>
          <code>VITE_FIREBASE_API_KEY</code>, <code>VITE_FIREBASE_AUTH_DOMAIN</code>,{' '}
          <code>VITE_FIREBASE_PROJECT_ID</code>, …
        </li>
      </ul>
      <p style={{ margin: '0.75rem 0 0', lineHeight: 1.5, fontFamily: 'system-ui, sans-serif', color: '#555' }}>
        Dosyayı kaydettikten sonra <strong>npm run dev</strong> ile sunucuyu yeniden başlat.
      </p>
    </div>
  );
}
