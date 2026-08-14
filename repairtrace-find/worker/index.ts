/**
 * Cloudflare Worker entry point
 *
 * This file is not used when deploying to Vercel.
 * Vercel uses Next.js built-in serverless functions instead.
 *
 * For Cloudflare Workers deployment, this would be the entry point.
 * For Vercel deployment, all API routes in app/api/ are used directly.
 */

const worker = {
  fetch: () => new Response("Not deployed on Cloudflare Workers", { status: 500 }),
};

export default worker;
