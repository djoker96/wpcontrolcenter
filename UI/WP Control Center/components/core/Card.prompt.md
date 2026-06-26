**Card** — surface container for KPIs, lists, panels. Compose `Card > CardHeader + CardBody`.

```jsx
<Card>
  <CardHeader title="Sites needing attention" actions={<Button size="sm" variant="outline">View all</Button>} />
  <CardBody>…</CardBody>
</Card>
```

Hairline `--border`, square corners, white `--card` surface. No drop shadow at rest — elevation is reserved for overlays (popover/dialog).
