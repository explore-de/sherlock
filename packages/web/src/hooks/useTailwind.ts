'use client';

const tailwind = {
    theme: {
        colors: {
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            highlight: 'hsl(var(--highlight))',
        },
    },
};

export const useTailwind = () => tailwind;
