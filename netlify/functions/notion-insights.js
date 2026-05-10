const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });

function getPlainText(richText = []) {
  return richText.map(t => t.plain_text || '').join('');
}

function richTextToHtml(richText = []) {
  return richText.map(t => {
    let text = t.plain_text || '';
    const a = t.annotations || {};
    if (a.code) text = `<code>${text}</code>`;
    if (a.bold) text = `<strong>${text}</strong>`;
    if (a.italic) text = `<em>${text}</em>`;
    if (a.strikethrough) text = `<s>${text}</s>`;
    if (a.underline) text = `<u>${text}</u>`;
    const href = t.href || t.text?.link?.url;
    if (href) text = `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    return text;
  }).join('');
}

async function getAllBlocks(blockId) {
  let blocks = [];
  let cursor;
  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100
    });
    blocks = blocks.concat(response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

async function blocksToHtml(blocks) {
  let html = '';
  let inBulleted = false;
  let inNumbered = false;

  const closeLists = () => {
    if (inBulleted) { html += '</ul>'; inBulleted = false; }
    if (inNumbered) { html += '</ol>'; inNumbered = false; }
  };

  for (const block of blocks) {
    const value = block[block.type];
    switch (block.type) {
      case 'paragraph':
        closeLists();
        html += `<p>${richTextToHtml(value.rich_text || [])}</p>`;
        break;
      case 'heading_1':
        closeLists();
        html += `<h1>${richTextToHtml(value.rich_text || [])}</h1>`;
        break;
      case 'heading_2':
        closeLists();
        html += `<h2>${richTextToHtml(value.rich_text || [])}</h2>`;
        break;
      case 'heading_3':
        closeLists();
        html += `<h3>${richTextToHtml(value.rich_text || [])}</h3>`;
        break;
      case 'quote':
        closeLists();
        html += `<blockquote>${richTextToHtml(value.rich_text || [])}</blockquote>`;
        break;
      case 'divider':
        closeLists();
        html += '<hr>';
        break;
      case 'bulleted_list_item':
        if (!inBulleted) { closeLists(); html += '<ul>'; inBulleted = true; }
        html += `<li>${richTextToHtml(value.rich_text || [])}</li>`;
        break;
      case 'numbered_list_item':
        if (!inNumbered) { closeLists(); html += '<ol>'; inNumbered = true; }
        html += `<li>${richTextToHtml(value.rich_text || [])}</li>`;
        break;
      case 'code':
        closeLists();
        html += `<pre><code>${getPlainText(value.rich_text || [])}</code></pre>`;
        break;
      case 'image': {
        closeLists();
        const url = value.type === 'external' ? value.external?.url : value.file?.url;
        const caption = getPlainText(value.caption || []);
        if (url) {
          html += `<figure><img src="${url}" alt="${caption || ''}" loading="lazy">${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
        }
        break;
      }
      default:
        break;
    }
  }
  closeLists();
  return html;
}

function pageToArticle(page, content = '') {
  const props = page.properties || {};
  const titleProp = props.Name || props.Title || Object.values(props).find(p => p.type === 'title');
  return {
    id: page.id,
    slug: page.id.replace(/-/g, ''),
    title: getPlainText(titleProp?.title || []),
    category: props.Category?.select?.name || '',
    summary: getPlainText(props.Summary?.rich_text || []),
    publishDate: props['Publish Date']?.date?.start || null,
    featured: props.Featured?.checkbox || false,
    content,
    body: content,
    articleBody: content
  };
}

function getDbIdForLanguage(lang) {
  const normalized = String(lang || 'EN').toUpperCase();
  if (normalized === 'ES') {
    return process.env.NILUS_INSIGHTS_ES_DB || process.env.ES_DB_ID || process.env.DB_ID;
  }
  return process.env.NILUS_INSIGHTS_EN_DB || process.env.EN_DB_ID || process.env.DB_ID;
}

async function getPublishedPages(lang) {
  const normalized = String(lang || 'EN').toUpperCase();
  const dbId = getDbIdForLanguage(normalized);

  if (!dbId) {
    throw new Error('Missing insights database environment variable');
  }

  // Always filter by BOTH:
  // 1. Status = Published
  // 2. Language = EN or ES
  //
  // This guarantees that even if the Spanish database variable accidentally
  // points to the English database (or vice versa), only the correct language
  // entries will be returned.
  const response = await notion.databases.query({
    database_id: dbId,
    filter: {
      and: [
        { property: 'Status', select: { equals: 'Published' } },
        { property: 'Language', select: { equals: normalized } }
      ]
    },
    sorts: [{ property: 'Publish Date', direction: 'descending' }]
  });

  return response.results;
}

exports.handler = async function(event) {
  try {
    const slug = event.queryStringParameters?.slug || event.queryStringParameters?.id;
    const lang = event.queryStringParameters?.lang || 'EN';
    const pages = await getPublishedPages(lang);

    if (slug) {
      const page = pages.find(p => p.id.replace(/-/g, '') === slug.replace(/-/g, ''));
      if (!page) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Article not found' }) };
      }
      const content = await blocksToHtml(await getAllBlocks(page.id));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article: pageToArticle(page, content) })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articles: pages.map(p => pageToArticle(p, '')) })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unable to load Notion insights', details: error.message })
    };
  }
};
