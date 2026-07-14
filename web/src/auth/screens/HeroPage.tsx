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
          <button
            type="button"
            className="auth-ghost"
            onClick={() => navigate({ to: '/login', search: { intent: 'signin' } })}
          >
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
              <button
                type="button"
                className="auth-btn auth-btn-primary"
                onClick={() => navigate({ to: '/login', search: { intent: 'signup' } })}
              >
                {t.hero_cta_start}
              </button>
              <button
                type="button"
                className="auth-btn"
                onClick={() => navigate({ to: '/login', search: { intent: 'signin' } })}
              >
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
            <svg className="auth-spark" viewBox="0 0 320 70" preserveAspectRatio="none">
              <defs>
                <linearGradient id="auth-spark-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#2dd4bf" stopOpacity=".3" />
                  <stop offset="1" stopColor="#2dd4bf" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 52 C 40 30, 70 20, 110 24 C 150 28, 180 8, 220 14 C 255 19, 285 40, 320 30 L320 70 L0 70 Z"
                fill="url(#auth-spark-fill)"
              />
              <path
                d="M0 52 C 40 30, 70 20, 110 24 C 150 28, 180 8, 220 14 C 255 19, 285 40, 320 30"
                fill="none"
                stroke="#2dd4bf"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
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
            <div className="ic">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" />
              </svg>
            </div>
            <h3>{t.hero_feature1_title}</h3>
            <p>{t.hero_feature1_desc}</p>
          </div>
          <div className="auth-feat">
            <div className="ic">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
              </svg>
            </div>
            <h3>{t.hero_feature2_title}</h3>
            <p>{t.hero_feature2_desc}</p>
          </div>
          <div className="auth-feat">
            <div className="ic">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 17l6-6 4 4 8-8M17 7h4v4" />
              </svg>
            </div>
            <h3>{t.hero_feature3_title}</h3>
            <p>{t.hero_feature3_desc}</p>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
