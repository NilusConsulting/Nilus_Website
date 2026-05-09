const { Client } = require('@notionhq/client');

exports.handler = async function () {
  try {
    const token = process.env.NOTION_TOKEN;
    const databaseId = process.env.NOTION_DATABASE_ID;
    if (!token || !databaseId) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing environment variables' }) };
    }

    const notion = new Client({ auth: token });
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: { property: 'Status', select: { equals: 'Published' } },
      sorts: [{ property: 'Publish Date', direction: 'descending' }],
      page_size: 6
    });

    const articles = response.results.map(page => {
      const p = page.properties || {};
      const title = ((p.Name?.title) || []).map(t => t.plain_text).join('') || 'Untitled';
      const category = p.Category?.select?.name || '';
      const summary = ((p.Summary?.rich_text) || []).map(t => t.plain_text).join('');
      const publishDate = p['Publish Date']?.date?.start || null;
      const featured = !!p.Featured?.checkbox;
      const slug = page.id.replace(/-/g, '');
      return { title, category, summary, publishDate, featured, slug };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articles })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
