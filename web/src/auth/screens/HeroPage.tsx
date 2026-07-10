import { useNavigate } from '@tanstack/react-router';
import AuthShell from '../AuthShell';
import BrandMark from '../BrandMark';
import { useLocale } from '@/context/LocaleContext';

export default function HeroPage() {
  const { t } = useLocale();
  const navigate = useNavigate();

  return (
    <AuthShell>
      <div className="auth-hero-page">
        <div className="auth-topbar">
          <div className="auth-brandrow">
            <BrandMark size={34} />
            <span>{t.app_title}</span>
          </div>
          <button type="button" className="auth-ghost" onClick={() => navigate({ to: '/login' })}>
            {t.hero_topbar_cta}
          </button>
        </div>

        <div className="auth-hero-main">
          <div>
            <h1>
              {t.hero_title_line1}
              <br />
              <span className="auth-grad">{t.hero_title_line2}</span>
            </h1>
            <p className="auth-hero-sub">{t.hero_subtitle}</p>
            <div className="auth-hero-ctas">
              <button type="button" className="auth-btn auth-btn-primary" onClick={() => navigate({ to: '/login' })}>
                {t.hero_cta_start}
              </button>
              <button type="button" className="auth-btn" onClick={() => navigate({ to: '/login/email' })}>
                {t.hero_cta_email}
              </button>
            </div>
          </div>

          <div className="auth-preview">
            <div className="auth-pv-top">
              <div>
                <div className="auth-pv-label">{t.hero_preview_label}</div>
                <div className="auth-pv-value">R$ 3.379,76</div>
              </div>
              <span className="pill down">-2,45%</span>
            </div>
            <div className="auth-pv-row">
              <span className="coin" style={{ background: '#f7931a' }}>B</span>
              <span className="auth-pv-nm">Bitcoin</span>
              <span className="pill down">-7,39%</span>
            </div>
            <div className="auth-pv-row">
              <span className="coin" style={{ background: '#2775ca' }}>$</span>
              <span className="auth-pv-nm">USDC</span>
              <span className="pill up">+3,17%</span>
            </div>
            <div className="auth-pv-row">
              <span className="coin" style={{ background: '#9945ff' }}>S</span>
              <span className="auth-pv-nm">Solana</span>
              <span className="pill up">+7,82%</span>
            </div>
          </div>
        </div>

        <div className="auth-features">
          <div className="auth-feat">
            <h3>{t.hero_feature1_title}</h3>
            <p>{t.hero_feature1_desc}</p>
          </div>
          <div className="auth-feat">
            <h3>{t.hero_feature2_title}</h3>
            <p>{t.hero_feature2_desc}</p>
          </div>
          <div className="auth-feat">
            <h3>{t.hero_feature3_title}</h3>
            <p>{t.hero_feature3_desc}</p>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
