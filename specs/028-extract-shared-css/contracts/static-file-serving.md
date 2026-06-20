# Contract: Static CSS File Serving

## Route

**GET /static/base.css**

## Response

| Field | Value |
|-------|-------|
| Status | `200 OK` |
| Content-Type | `text/css; charset=utf-8` |
| Cache-Control (prod) | `public, max-age=31536000, immutable` |
| Cache-Control (dev) | `no-cache, must-revalidate` |

## Implementation

Registered as a Hono route handler in `src/index.ts`:

```typescript
app.get("/static/:file", async (c) => {
  const file = c.req.param("file");
  // Security: only allow specific CSS files, prevent path traversal
  if (!/^[\w.-]+\.css$/.test(file)) return c.notFound();
  const filePath = filePathFromRoot(`src/views/${file}`);
  if (!fs.existsSync(filePath)) return c.notFound();
  const content = fs.readFileSync(filePath, "utf-8");
  c.header("Content-Type", "text/css; charset=utf-8");
  c.header("Cache-Control", process.env.NODE_ENV === "production"
    ? "public, max-age=31536000, immutable"
    : "no-cache, must-revalidate");
  return c.body(content);
});
```

## Security

- Only `.css` files from `src/views/` are served
- Path traversal is prevented by regex validation (`/^[\w.-]+\.css$/`)
- No user input is reflected in the file path

## Caching Notes

- In production, the `immutable` directive tells browsers never to revalidate on repeat visits. To update `base.css`, use a new filename (e.g., `base.v2.css`) and update the `<link>` tag in `HTMX_HEAD`, OR use a query parameter.
- In development, `no-cache` ensures developers always see their latest CSS changes after a page reload.
