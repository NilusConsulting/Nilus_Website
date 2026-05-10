
function getCurrentLanguage() {
  const stored =
    localStorage.getItem('language') ||
    localStorage.getItem('selectedLanguage') ||
    document.documentElement.lang ||
    'en';

  return String(stored).toLowerCase().startsWith('es') ? 'es' : 'en';
}

function getUIText() {
  if (getCurrentLanguage() === 'ES') {
    return {
      heading: 'Perspectivas recientes',
      footer:
        'Las perspectivas se actualizan periódicamente para reflejar desarrollos en infraestructura, finanzas de proyectos y asesoría estratégica en América Latina.',
      loading: 'Cargando perspectivas...',
      empty: 'Todavía no hay perspectivas publicadas.',
      error: 'No se pudieron cargar las perspectivas.'
    };
  }

  return {
    heading: 'Recent Insights',
    footer:
      'Insights are updated periodically to reflect developments in infrastructure, project finance and strategic advisory across Latin America.',
    loading: 'Loading insights...',
    empty: 'No published insights yet.',
    error: 'Unable to load insights.'
  };
}

function createArticleCard(article) {
  const category = (article.category || '').toUpperCase();
  const title = article.title || '';
  const summary = article.summary || '';
  const slug = article.slug || article.id || '';

  return `
    <a href="insight.html?slug=${encodeURIComponent(slug)}"
       style="text-decoration:none;color:inherit;display:block;">
      <div style="border-top:2px solid #c7d300;padding-top:24px;">
        <div style="font-size:12px;letter-spacing:2px;color:#c7d300;margin-bottom:12px;text-transform:uppercase;">
          ${category}
        </div>
        <div style="font-weight:700;font-size:20px;line-height:1.35;margin-bottom:12px;">
          ${title}
        </div>
        <div style="font-size:14px;line-height:1.6;color:#5f6b7a;">
          ${summary}
        </div>
      </div>
    </a>
  `;
}

function findInsightsSection() {
  const headings = Array.from(document.querySelectorAll('h1, h2, h3'));

  return headings.find((el) => {
    const text = el.textContent.trim().toLowerCase();
    return (
      text === 'recent insights' ||
      text === 'perspectivas recientes'
    );
  })?.closest('section') || headings.find((el) => {
    const text = el.textContent.trim().toLowerCase();
    return text === 'recent insights' || text === 'perspectivas recientes';
  })?.parentElement;
}

async function renderInsights() {
  const section = findInsightsSection();
  if (!section) return;

  const ui = getUIText();

  section.innerHTML = `
    <div style="padding:48px 0;text-align:center;color:#4f5d6b;">
      ${ui.loading}
    </div>
  `;

  try {
    const lang = getCurrentLanguage();
    const response = await fetch(
      '/.netlify/functions/notion-insights?lang=' + encodeURIComponent(lang),
      { cache: 'no-store' }
    );

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    const data = await response.json();
    const articles = (data.articles || []).slice(0, 3);

    if (!articles.length) {
      section.innerHTML = `
        <div style="padding:48px 0;text-align:center;color:#4f5d6b;">
          ${ui.empty}
        </div>
      `;
      return;
    }

    section.innerHTML = `
      <div style="margin-bottom:44px;">
        <h2 style="font-size:36px;line-height:1.15;margin:0;color:#001b2e;">
          ${ui.heading}
        </h2>
      </div>

      <div class="notion-insights-grid"
           style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:40px;">
        ${articles.map(createArticleCard).join('')}
      </div>

      <div style="margin-top:48px;padding:40px;background:#f4f4ef;text-align:center;color:#4f5d6b;">
        ${ui.footer}
      </div>
    `;
  } catch (error) {
    console.error('Error loading insights:', error);
    section.innerHTML = `
      <div style="padding:48px 0;text-align:center;color:#4f5d6b;">
        ${ui.error}
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', renderInsights);
window.addEventListener('storage', renderInsights);
