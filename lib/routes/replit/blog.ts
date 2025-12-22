import { load } from 'cheerio';

import type { Route } from '@/types';
import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

export const route: Route = {
    path: '/blog',
    name: 'Replit Blog',
    categories: ['programming', 'blog'],
    example: '/replit/blog',
    maintainers: ['claude'],
    handler: async () => {
        try {
            const response = await ofetch('https://blog.replit.com/');
            const $ = load(response);

            // Extract JSON from __NEXT_DATA__ script tag
            const nextDataScript = $('#__NEXT_DATA__').html();
            if (!nextDataScript) {
                throw new Error('Could not find __NEXT_DATA__ script tag');
            }

            const nextData = JSON.parse(nextDataScript);
            const posts = nextData.props?.pageProps?.data?.posts;

            if (!posts || !Array.isArray(posts)) {
                throw new Error('Could not find posts data in __NEXT_DATA__');
            }

            const items = posts.map((post: any) => {
                const title = post.title;
                const slug = post.slug;
                const summary = post.summary;
                const publishedAt = post.publishedAt;
                const coverImage = post.coverImage;
                const authors = post.authors;

                // Build article URL
                const link = `https://blog.replit.com/${slug}`;

                // Parse publication date
                const pubDate = publishedAt ? parseDate(publishedAt) : new Date();

                // Extract author information
                const author = authors && authors.length > 0 ? authors[0].name : 'Replit Team';

                // Extract image URL
                const image = coverImage?.asset?.url || coverImage?.url;

                // Build description with image if available
                let description = summary || '';
                if (image) {
                    description = `<img src="${image}" alt="${title}"><br><br>${description}`;
                }

                return {
                    title,
                    link,
                    description,
                    author,
                    pubDate,
                    category: ['programming', 'blog'],
                };
            });

            const featuredPost = nextData.props?.pageProps?.data?.featuredPost;
            if (!items.some((item) => item.link === `https://blog.replit.com/${featuredPost.slug}`)) {
                const title = featuredPost.title;
                const slug = featuredPost.slug;
                const summary = featuredPost.summary;
                const publishedAt = featuredPost.publishedAt;
                const coverImage = featuredPost.coverImage;
                const authors = featuredPost.authors;

                // Build article URL
                const link = `https://blog.replit.com/${slug}`;

                // Parse publication date
                const pubDate = publishedAt ? parseDate(publishedAt) : new Date();

                // Extract author information
                const author = authors && authors.length > 0 ? authors[0].name : 'Replit Team';

                // Extract image URL
                const image = coverImage?.asset?.url || coverImage?.url;

                // Build description with image if available
                let description = summary || '';
                if (image) {
                    description = `<img src="${image}" alt="${title}"><br><br>${description}`;
                }

                items.push({
                    title,
                    link,
                    description,
                    author,
                    pubDate,
                    category: ['programming', 'blog'],
                });
            }

            return {
                title: 'Replit Blog',
                link: 'https://blog.replit.com/',
                description: 'The official blog from Replit, featuring updates on features, tutorials, and community stories.',
                item: items,
                language: 'en',
            };
        } catch (error) {
            logger.error('Error fetching Replit blog:', error);
            throw new Error('Failed to fetch Replit blog data');
        }
    },
};
