document.addEventListener('DOMContentLoaded', async () => {
  const heading = Array.from(document.querySelectorAll('h1,h2,h3'))
    .find(el => el.textContent.trim().toLowerCase() === 'recent insights');
  if (!heading) return;

  try {
    const res = await fetch('/.netlify/functions/notion-insights');
    if (!res.ok) return;
    const data = await res.json();
    const articles = (data.articles || []).slice(0, 3);
    if (!articles.length) return;

    const section = heading.closest('section') || heading.parentElement;
    if (!section) return;

    const grid = `
      <div class="notion-insights-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:40px;margin-top:40px;">
        ${articles.map(a => `
          <a href="insight.html?slug=${a.slug}" style="text-decoration:none;color:inherit;display:block;">
            <div style="border-top:2px solid #c7d300;padding-top:24px;">
              <div style="font-size:12px;letter-spacing:2px;color:#c7d300;margin-bottom:12px;text-transform:uppercase;">${(a.category || '').toUpperCase()}</div>
              <div style="font-weight:700;font-size:20px;line-height:1.35;margin-bottom:12px;">${a.title}</div>
              <div style="font-size:14px;line-height:1.6;color:#5f6b7a;">${a.summary || ''}</div>
            </div>
          </a>
        `).join('')}
      </div>
      <div style="margin-top:48px;padding:40px;background:#f4f4ef;text-align:center;color:#4f5d6b;">
        Insights are updated periodically to reflect developments in infrastructure, project finance and strategic advisory across Latin America.
      </div>`;

    const html = section.innerHTML;
    if (html.toLowerCase().includes('coming soon')) {
      section.innerHTML = html.replace(/<div[\s\S]*?Insights are updated periodically[\s\S]*?<\/div>/i, grid);
    }
  } catch (e) {
    console.error(e);
  }
});