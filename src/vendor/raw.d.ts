// Type declarations for ?raw imports (Vite-style)
declare module '*.md?raw' {
  const content: string;
  export default content;
}
