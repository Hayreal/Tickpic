# Black Window Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the visible light outer border by making the app content fill the Electron window and shifting the shell to a black-first theme.

**Architecture:** Update the window shell in two layers. First, add regression tests that describe the expected full-window shell and dark sidebar. Then change the Electron background and React layout components so the renderer fills the window without the existing cream card wrapper.

**Tech Stack:** Electron, React 19, TypeScript, Tailwind utility classes, Vitest, Testing Library

---

### Task 1: Add shell regression tests

**Files:**
- Modify: `src/components/WindowFrame.test.tsx`
- Modify: `src/components/Sidebar.test.tsx`
- Test: `src/components/WindowFrame.test.tsx`
- Test: `src/components/Sidebar.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
it('uses a full-window dark shell instead of a card frame', () => {
  const { container } = render(
    <WindowFrame title="Tickpic">
      <div>content</div>
    </WindowFrame>,
  );

  expect(container.querySelector('#desktop-environment')).toHaveClass('min-h-screen', 'bg-[#050505]', 'p-0');
  expect(container.querySelector('#electron-main-window')).toHaveClass('h-screen', 'w-screen', 'rounded-none', 'border-0');
});
```

```tsx
it('renders the sidebar as a dark segmented panel', () => {
  const { container } = render(<Sidebar activeTab="sticker" onTabChange={() => {}} />);

  expect(container.querySelector('#app-sidebar')).toHaveClass('bg-[#111111]', 'border-r', 'border-[#1f1f1f]');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/components/WindowFrame.test.tsx src/components/Sidebar.test.tsx`
Expected: FAIL because the current classes still describe the cream outer shell and light sidebar.

- [ ] **Step 3: Write the minimal implementation**

Update the shell classes in `WindowFrame.tsx` and the sidebar classes in `Sidebar.tsx` to match the new full-window dark shell and segmented sidebar.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/WindowFrame.test.tsx src/components/Sidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/WindowFrame.test.tsx src/components/Sidebar.test.tsx src/components/WindowFrame.tsx src/components/Sidebar.tsx
git commit -m "fix: remove light outer shell"
```

### Task 2: Align the Electron window background

**Files:**
- Modify: `electron/main.ts`
- Test: `pnpm lint`
- Test: `pnpm build`

- [ ] **Step 1: Update the window background**

```ts
backgroundColor: '#050505',
```

- [ ] **Step 2: Run typecheck and build**

Run: `pnpm lint && pnpm build`
Expected: both commands exit successfully.

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "fix: align electron window background with dark shell"
```
