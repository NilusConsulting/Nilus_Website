const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

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
    if (href) {
      text = `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }

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
  let inBulletedList = false;
  let inNumberedList = false;

  const closeLists = () => {
    if (inBulletedList) {
      html += '</ul>';
      inBulletedList = false;
    }
    if (inNumberedList) {
      html += '</ol>';
      inNumberedList = false;
    }
  };

  for (const block of blocks) {
    const type = block.type;
    const value = block[type];

    switch (type) {
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
        if (!inBulletedList) {
          closeLists();
          html += '<ul>';
          inBulletedList = true;
        }
        html += `<li>${richTextToHtml(value.rich_text || [])}</li>`;
        break;

      case 'numbered_list_item':
        if (!inNumberedList) {
          closeLists();
          html += '<ol>';
          inNumberedList = true;
        }
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

  const titleProp =
    props.Name ||
    props.Title ||
    Object.values(props).find(p => p.type === 'title');

  const title = getPlainText(titleProp?.title || []);
  const category = props.Category?.select?.name || '';
  const summary = getPlainText(props.Summary?.rich_text || []);
  const publishDate = props['Publish Date']?.date?.start || null;
  const featured = props.Featured?.checkbox || false;
  const slug = page.id.replace(/-/g, '');

  return {
    id: page.id,
    slug,
    title,
    category,
    summary,
    publishDate,
    featured,
    content,
    body: content,
    articleBody: content
  };
}

async function getPublishedPages() {
  const response = await notion.databases.query({
    database_id: process.env.NOTION_DATABASE_ID,
    filter: {
      property: 'Status',
      select: {
        equals: 'Published'
      }
    },
    sorts: [
      {
        property: 'Publish Date',
        direction: 'descending'
      }
    ]
  });

  return response.results;
}

exports.handler = async function(event) {
  try {
    if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Missing NOTION_TOKEN or NOTION_DATABASE_ID'
        })
      };
    }

    const slug =
      event.queryStringParameters?.slug ||
      event.queryStringParameters?.id;

    const pages = await getPublishedPages();

    if (slug) {
      const page = pages.find(
        p => p.id.replace(/-/g, '') === slug.replace(/-/g, '')
      );

      if (!page) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            error: 'Article not found'
          })
        };
      }

      const blocks = await getAllBlocks(page.id);
      const content = await blocksToHtml(blocks);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60, s-maxage=300'
        },
        body: JSON.stringify({
          article: pageToArticle(page, content)
        })
      };
    }

    const articles = pages.map(page => pageToArticle(page, ''));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=300'
      },
      body: JSON.stringify({
        articles
      })
    };
  } catch (error) {
    console.error('Notion Insights Error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Unable to load Notion insights',
        details: error.message
      })
    };
  }
};
