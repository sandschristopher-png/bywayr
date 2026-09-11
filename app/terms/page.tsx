import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Bywayr',
  description: 'Terms of Service for Bywayr, the pocket field guide for unmapped local spots.',
};

export default function Terms() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f4', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: '#1c1917', padding: '40px 16px 80px 16px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#e05a47', textDecoration: 'none', marginBottom: '28px' }}>
          ← Back to Bywayr
        </Link>

        <h1 style={{ margin: '0 0 6px 0', fontSize: '30px', fontWeight: 800, letterSpacing: '-0.02em' }}>Terms of Service</h1>
        <p style={{ margin: '0 0 32px 0', fontSize: '13px', color: '#78716c' }}>Last updated: September 11, 2026</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', fontSize: '14px', lineHeight: 1.7, color: '#44403c' }}>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#1c1917' }}>1. What Bywayr is</h2>
            <p style={{ margin: 0 }}>Bywayr is a community field guide for discovering and sharing lesser-known local places. Users ("curators") pin locations, leave notes, and share tips. By creating an account or using the app, you agree to these terms.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#1c1917' }}>2. User-generated content</h2>
            <p style={{ margin: '0 0 8px 0' }}>All pinned spots, field notes, comments, and tips are submitted by users, not verified by Bywayr. We do not guarantee the accuracy, legality, safety, or current status (open/closed) of any location or note.</p>
            <p style={{ margin: 0 }}>You retain ownership of content you submit. By submitting content, you grant Bywayr a worldwide, royalty-free license to display it within the app. Do not post content that is illegal, private property you don't have permission to promote, or dangerous locations presented as safe.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#1c1917' }}>3. Safety disclaimer</h2>
            <p style={{ margin: 0 }}>Bywayr points users toward unofficial, unmapped, and off-the-beaten-path locations. Such places may involve risks including rough terrain, restricted access, or unsafe conditions. You visit any pinned location at your own risk. Always obey local laws, posted signage, and private property rights.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#1c1917' }}>4. Accounts</h2>
            <p style={{ margin: '0 0 8px 0' }}>You are responsible for keeping your account credentials secure and for activity under your account. You may delete your account at any time from the Field Journal. Deleting your account removes your profile and bookmarks; your public pins remain as anonymous community field notes.</p>
            <p style={{ margin: 0 }}>We reserve the right to suspend accounts that abuse the service: spam, scraping, posting false locations, harassment, or attempts to manipulate other users.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#1c1917' }}>5. Bywayr Plus (paid tier)</h2>
            <p style={{ margin: '0 0 8px 0' }}>Bywayr Plus is a one-time, non-recurring purchase made through Google Play Billing. It grants a lifetime license to premium features, including cloud backup and premium app features, on the Google account used for purchase.</p>
            <p style={{ margin: 0 }}>Refunds for Bywayr Plus are handled under Google Play's refund policy. Purchases can be restored at any time via the "Restore Purchase" option in the app on the same Google account.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#1c1917' }}>6. Advertising</h2>
            <p style={{ margin: 0 }}>The free version of Bywayr displays advertisements served by Google AdMob. Bywayr Plus subscribers do not see ads. Advertising never interferes with core map functionality.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#1c1917' }}>7. Third-party services</h2>
            <p style={{ margin: 0 }}>Bywayr relies on third-party providers including map tiles (CARTO/OpenStreetMap), geocoding (Nominatim), hosting (Vercel), database and authentication (Supabase), and Google Play services. Your use of the app is also subject to those providers' terms where applicable.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#1c1917' }}>8. Limitation of liability</h2>
            <p style={{ margin: 0 }}>Bywayr is provided "as is" without warranties of any kind. To the fullest extent permitted by law, Bywayr and its operator are not liable for any indirect, incidental, or consequential damages, including losses arising from reliance on user-submitted locations or navigational directions.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#1c1917' }}>9. Changes to these terms</h2>
            <p style={{ margin: 0 }}>We may update these terms from time to time. Material changes will be reflected by the "Last updated" date above. Continued use of the app after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#1c1917' }}>10. Governing law</h2>
            <p style={{ margin: 0 }}>These terms are governed by the laws of the State of Nevada, United States, without regard to conflict-of-law principles.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#1c1917' }}>11. Contact</h2>
            <p style={{ margin: 0 }}>Questions about these terms? Reach us through the contact options listed on bywayr.com.</p>
          </section>

        </div>
      </div>
    </div>
  );
}