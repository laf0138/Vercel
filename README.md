# dinnerplot recipe proxy

A stateless Vercel function that holds a Spoonacular API key server-side and
proxies live recipe searches for the dinnerplot meal-planning app.

- `GET /api/search?q=<term>&ip=0|1&number=N`
- The key lives in the `SPOONACULAR_API_KEY` environment variable (set in
  Vercel's dashboard, never committed here).
- Nothing is cached or stored: every request calls Spoonacular live and
  returns the trimmed response straight through. Spoonacular's terms forbid
  keeping recipe data (ingredients/instructions) beyond a live view, so this
  function is deliberately stateless -- no database, no cache layer.
