import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    // tsconfig keeps "jsx": "preserve" for Next.js; Vite 8's oxc transform would otherwise leave JSX untransformed.
    oxc: { jsx: { runtime: 'automatic' } },
    test: {
        environment: 'jsdom',
        watch: false,
    },
})
