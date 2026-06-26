**Button** — the primary action control; use for any clickable command (submit, add, update, run).

```jsx
<Button variant="primary" size="md">Add site</Button>
<Button variant="outline">Open tools</Button>
<Button variant="destructive" size="sm">Disable site</Button>
```

Variants: `primary` (amber, default), `secondary`, `outline`, `ghost`, `destructive`. Sizes: `sm` / `md` / `lg`. Corners are square (`--radius:0`). Use exactly one `primary` per action group.
