**Switch** — boolean toggle for remote operations (maintenance mode, object cache).

```jsx
<Switch checked={on} onChange={setOn} />
```

Controlled: pass `checked` and handle `onChange(next)`. Track is pill-shaped; amber when on, neutral when off. Use a Button (not a Switch) for one-shot actions like "Clear cache".
