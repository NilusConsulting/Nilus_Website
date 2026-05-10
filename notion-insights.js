
function getCurrentLanguage() {
  const stored =
    localStorage.getItem('language') ||
    localStorage.getItem('selectedLanguage') ||
    document.documentElement.lang ||
    'en';
  return String(stored).toLowerCase().startsWith('es') ? 'ES' : 'EN';
}

function getUiText() {
  return getCurrentLanguage() === 'ES'
    ? {
        eyebrow: 'ÚLTIMOS',
        heading: 'Perspectivas recientes',
        footer: 'Las perspectivas se actualizan periódicamente para reflejar desarrollos en infraestructura, finanzas de proyectos y asesoría estratégica en América Latina.',
        loading: 'Cargando perspectivas...',
        empty: 'Todavía no hay perspectivas publicadas.',
        error: 'No se pudieron cargar las perspectivas.'
      }
    : {
        eyebrow: 'LATEST',
        heading: 'Recent Insights',
        footer: 'Insights are updated periodically to reflect developments in infrastructure, project finance and strategic advisory across Latin America.',
        loading: 'Loading insights...',
        empty: 'No published insights yet.',
        error: 'Unable to load insights.'
      };
}

function articleCard(a) {
  const category = (a.category || '').toUpperCase();
  const title = a.title || '';
  const summary = a.summary || '';
  const slug = a.slug || a.id || '';

  return `
    <a href="insight.html?slug=${encodeURIComponent(slug)}" style="text-decoration:none;color:inherit;display:block;">
      <div style="border-top:2px solid #c7d300;padding-top:24px;">
        <div style="font-size:12px;letter-spacing:2px;color:#c7d300;margin-bottom:12px;text-transform:uppercase;">${category}</div>
        <div style="font-weight:700;font-size:20px;line-height:1.35;margin-bottom:12px;">${title}</div>
        <div style="font-size:14px;line-height:1.6;color:#5f6b7a;">${summary}</div>
      </div>
    </a>
  `;
}

async function renderNotionInsights() {
  const mount = document.getElementById('notion-insights-mount');
  if (!mount) return;

  const ui = getUiText();
  mount.innerHTML = `<div style="padding:48px 0;text-align:center;color:#4f5d6b;">${ui.loading}</div>`;

  try {
    const lang = getCurrentLanguage();
    const res = await fetch('/.netlify/functions/notion-insights?lang=' + encodeURIComponent(lang), {
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    const data = await res.json();
    const articles = (data.articles || []).slice(0, 3);

    if (!articles.length) {
      mount.innerHTML = `<div style="padding:48px 0;text-align:center;color:#4f5d6b;">${ui.empty}</div>`;
      return;
    }

    mount.innerHTML = `
      <div style="margin-bottom:44px;">
        <div style="font-size:12px;letter-spacing:3px;color:#9aa6b2;text-transform:uppercase;margin-bottom:14px;">
          — ${ui.eyebrow}
        </div>
        <h2 style="font-size:36px;line-height:1.15;margin:0;color:#001b2e;">${ui.heading}</h2>
      </div>

      <div class="notion-insights-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:40px;">
        ${articles.map(articleCard).join('')}
      </div>

      <div style="margin-top:48px;padding:40px;background:#f4f4ef;text-align:center;color:#4f5d6b;">
        ${ui.footer}
      </div>
    `;
  } catch (error) {
    console.error('Notion insights error:', error);
    mount.innerHTML = `<div style="padding:48px 0;text-align:center;color:#4f5d6b;">${ui.error}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', renderNotionInsights);
window.addEventListener('storage', renderNotionInsights);
