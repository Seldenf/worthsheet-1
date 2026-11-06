import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      seoTitle: z.string().max(60).optional(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image().optional(),
      heroAlt: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
      draft: z.boolean().default(false),
    }),
});

const glossary = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/glossary' }),
  schema: z.object({
    term: z.string(),
    definition: z.string(),
    description: z.string(),
    related: z.array(z.string()).optional(),
    relatedLinks: z.array(z.object({ label: z.string(), path: z.string() })).optional(),
  }),
});

export const collections = { blog, glossary };
