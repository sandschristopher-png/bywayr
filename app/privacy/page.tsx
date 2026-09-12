export default function PrivacyPage() {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#faf8f5', padding: '40px 20px', fontFamily: "var(--font-inter), 'Inter', sans-serif", color: '#1c1917', lineHeight: 1.7 }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>Privacy Policy</h1>
        <p style={{ color: '#78716c', fontSize: '14px' }}>Last updated: September 12, 2026</p>

        <p style={{ fontSize: '15px' }}>Bywayr (&quot;we&quot;, &quot;our&quot;) respects your privacy. This policy explains what we collect when you use the Bywayr app and website (bywayr.com).</p>

        <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: '28px' }}>What we collect</h2>
        <ul style={{ fontSize: '15px', paddingLeft: '20px' }}>
          <li><strong>Account info:</strong> your email address, chosen username, and home country.</li>
          <li><strong>Content you create:</strong> spots you pin (name, description, location, photos), field notes, and comments.</li>
          <li><strong>Location:</strong> with your permission, we use your device location to show nearby spots and send proximity alerts. Location is used on-device and is not tracked in the background.</li>
          <li><strong>Backups:</strong> if you use cloud backup, your data is stored in your own Google Drive (only you can access it) or in a backup file you download.</li>
        </ul>

        <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: '28px' }}>Third-party services</h2>
        <ul style={{ fontSize: '15px', paddingLeft: '20px' }}>
          <li><strong>Supabase:</strong> authentication and data storage.</li>
          <li><strong>Google:</strong> sign-in, Drive backups (Plus), Play billing (Plus purchases), and AdMob advertising on the free tier.</li>
        </ul>

        <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: '28px' }}>Ads</h2>
        <p style={{ fontSize: '15px' }}>The free tier displays ads served by Google AdMob. AdMob may use device identifiers to personalize ads. Bywayr Plus removes ads entirely.</p>

        <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: '28px' }}>Data deletion</h2>
        <p style={{ fontSize: '15px' }}>You can delete your account and all associated data at any time from the app via the Delete Account option. Deletion is permanent and immediate.</p>

        <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: '28px' }}>Contact</h2>
        <p style={{ fontSize: '15px' }}>Questions? Email us at <a href="mailto:bywayrapp@gmail.com" style={{ color: '#e05a47' }}>bywayrapp@gmail.com</a>.</p>

        <p style={{ marginTop: '40px', fontSize: '13px', color: '#a8a29e' }}>See also our <a href="/terms" style={{ color: '#e05a47' }}>Terms of Use</a>.</p>
      </div>
    </main>
  );
}