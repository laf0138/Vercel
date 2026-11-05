// Stateless proxy for dinnerplot's live "Find recipes" dialog.
// Holds the Spoonacular key server-side (never sent to the browser) and returns
// only what's needed to DISPLAY results live. Nothing is cached or stored here --
// Spoonacular's terms forbid keeping ingredients/instructions beyond a live view,
// so every request goes straight through to Spoonacular and the response is
// never written to disk, a database, or any cache layer.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const key = process.env.SPOONACULAR_API_KEY;
  if (!key) { res.status(500).json({ error: 'server_misconfigured' }); return; }

  const q = (req.query.q || '').toString().trim();
  if (!q) { res.status(400).json({ error: 'missing_query' }); return; }
  const ip = req.query.ip === '1';
  const number = Math.max(1, Math.min(8, parseInt(req.query.number, 10) || 6));

  const params = new URLSearchParams({
    apiKey: key,
    query: q + (ip ? ' instant pot' : ''),
    number: String(number),
    type: 'main course',
    instructionsRequired: 'true',
    addRecipeInformation: 'true',
    fillIngredients: 'true',
    sort: 'popularity',
  });

  let upstream;
  try {
    upstream = await fetch('https://api.spoonacular.com/recipes/complexSearch?' + params.toString());
  } catch (e) {
    res.status(502).json({ error: 'upstream_unreachable' }); return;
  }

  if (upstream.status === 402) { res.status(402).json({ error: 'quota_exceeded' }); return; }
  if (upstream.status === 401) { res.status(401).json({ error: 'bad_key' }); return; }
  if (!upstream.ok) { res.status(502).json({ error: 'upstream_error', status: upstream.status }); return; }

  const quotaLeft = upstream.headers.get('x-api-quota-left');
  let data;
  try { data = await upstream.json(); } catch (e) { res.status(502).json({ error: 'bad_upstream_json' }); return; }

  // Trim to exactly what the page needs to show a live result -- nothing extra is kept on our side either.
  const results = (data.results || []).map(r => ({
    id: r.id,
    name: r.title,
    minutes: r.readyInMinutes || null,
    servings: r.servings || null,
    cuisine: (r.cuisines && r.cuisines[0]) || '',
    sourceName: r.sourceName || '',
    sourceUrl: r.sourceUrl || '',
    ingredients: (r.extendedIngredients || []).map(i => ({
      name: i.nameClean || i.name || i.originalName || '',
      amount: i.amount || null,
      unit: i.unit || '',
      original: i.original || '',
    })),
    steps: ((r.analyzedInstructions && r.analyzedInstructions[0] && r.analyzedInstructions[0].steps) || []).map(s => s.step),
  })).filter(r => r.steps.length && r.ingredients.length);

  res.status(200).json({ results, quotaLeft });
};
