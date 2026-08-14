# RepairTrace Deployment to Vercel

**Why Vercel?**
- Built for Next.js (your app)
- Free tier with generous limits
- Auto-deploy on GitHub push
- Serverless functions (perfect for APIs)
- Great performance globally
- Easy to scale

**Estimated Setup Time**: 15 minutes

---

## Step 1: Create Vercel Account

1. Go to https://vercel.com/signup
2. Click "Continue with GitHub"
3. Authorize Vercel to access your GitHub repos
4. Complete setup

---

## Step 2: Deploy Find App (Main Marketplace)

### 2.1 Import Project
1. Go to https://vercel.com/new
2. Select "Import Git Repository"
3. Paste your repo URL: `https://github.com/trylegendxd/repair-retail`
4. Click "Import"

### 2.2 Configure Project
1. **Project name**: `repairtrace-find` (or `repair-retail-find`)
2. **Framework**: Should auto-detect as Next.js ✓
3. **Root Directory**: Set to `repairtrace-find/`
   - Click "Edit" next to root directory
   - Change from `.` to `repairtrace-find/`

### 2.3 Environment Variables
Click "Environment Variables" and add:

```
# Database Connection
DATABASE_URL=https://your-cloudflare-d1-url

# R2 Storage (Cloudflare)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket-name

# Admin Email
ADMIN_EMAIL=admin@repairtrace.com

# Optional
NEXT_PUBLIC_BASE_URL=https://your-vercel-domain.vercel.app
PASSWORD_SALT=your-random-salt
```

**How to get these values:**
- Database: From Cloudflare Workers D1
- R2: From Cloudflare R2 bucket settings
- Admin email: Your email

### 2.4 Deploy
Click "Deploy" and wait 3-5 minutes

✅ Your Find app will be live at: `https://repairtrace-find.vercel.app`

---

## Step 3: Deploy Workshop App (Optional)

Repeat Step 2 but:
1. **Root Directory**: `repairtrace-workshop/`
2. **Project name**: `repairtrace-workshop`

✅ Workshop app will be at: `https://repairtrace-workshop.vercel.app`

---

## Step 4: Update Database Connection

Your app uses Cloudflare D1. You need to tell Vercel how to reach it.

### Option A: Use Cloudflare D1 API (Recommended)

D1 databases accessible via REST API. In your app code:

**repairtrace-find/lib/server-marketplace.ts**

Update `getD1()` function to use REST API:

```typescript
async function getD1() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const databaseId = process.env.CLOUDFLARE_DATABASE_ID;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  return {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => ({
        first: async () => {
          const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ sql, params })
            }
          );
          const data = await response.json();
          return data.result?.[0]?.results?.[0];
        },
        // ... other methods
      })
    })
  };
}
```

### Option B: Use Worker Binding (Currently Needed)

Since your code uses Cloudflare Worker bindings, you need a proxy:

1. Keep your current D1 setup in `wrangler.toml`
2. Deploy a Cloudflare Worker that proxies D1 requests
3. Call that Worker from Vercel

**Simple Worker proxy** (`cloudflare-worker-proxy.ts`):

```typescript
export default {
  async fetch(request: Request, env: any) {
    const { sql, params } = await request.json();
    
    const result = await env.DB.prepare(sql).bind(...params).first();
    
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" }
    });
  }
};
```

Deploy this and add to Vercel env vars:
```
D1_PROXY_URL=https://your-worker-proxy.workers.dev
```

---

## Step 5: Update Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click "Settings" → "Environment Variables"
3. Add all variables from Step 2.3

**For D1 Access:**

From your Cloudflare dashboard:
- Account ID: bottom left in sidebar
- API Token: Profile → API Tokens → Create (with D1 read/write)
- Database ID: From D1 database list

---

## Step 6: Test the Deployment

### 6.1 Visit Your App
- Find app: `https://repairtrace-find.vercel.app`
- Workshop app: `https://repairtrace-workshop.vercel.app`

### 6.2 Test Core Features

**Sign In**
- Click "Sign in with ChatGPT"
- You should be able to log in (if using OpenAI auth still)

**Seller Features**
- Visit `/my-shop`
- Register as shop
- Upload verification doc
- Check `/admin/verifications`

**Search**
- Visit `/sellers`
- Search for shops
- View seller profiles

### 6.3 Check Logs
If something fails:
1. Go to Vercel dashboard
2. Click your project
3. Go to "Deployments" → latest deploy
4. Click "View Build Logs"
5. Look for errors

---

## Step 7: Set Up Auto-Deployment

By default, Vercel auto-deploys on every GitHub push to `master`.

**To control this:**
1. Project Settings → Git
2. Production Branch: `master`
3. Auto-deploy enabled ✓

Now every time you push to GitHub, Vercel automatically redeploys!

---

## Step 8: Custom Domain (Optional)

### Add Your Own Domain

1. Go to Vercel project
2. Settings → Domains
3. Add domain: `repairtrace.yourdomain.com`
4. Follow DNS setup instructions
5. Point nameservers to Vercel

Your app will be available at your custom domain with HTTPS.

---

## Step 9: Monitor & Scale

### View Analytics
- Vercel dashboard shows:
  - Request count
  - Bandwidth usage
  - Response times
  - Error rate

### Scale Up When Needed
- Free tier supports ~100k requests/month
- If you exceed: click "Upgrade" in Vercel
- Upgrade to Pro ($20/month) for production apps

---

## 🔧 Troubleshooting

### Database Connection Fails
```
Error: Could not connect to D1
```
**Fix:**
- Check Cloudflare D1 is accessible
- Verify API token has D1 permissions
- Check database ID is correct
- Logs will show exact error

### Environment Variables Not Working
```
Error: DATABASE_URL is undefined
```
**Fix:**
- Re-add environment variables
- Redeploy after adding vars
- Variables take effect on next deployment

### Pages Show 404
```
Error: 404 Not Found
```
**Fix:**
- Check root directory is set to `repairtrace-find/`
- Verify `next.config.js` exists in that directory
- Rebuild: Settings → Deployments → Rebuild

### API Endpoints Return 500
```
Error: Internal Server Error
```
**Fix:**
- Check server logs in Vercel dashboard
- Verify database connection works
- Check R2 bucket is accessible

---

## 📊 Vercel Features You Get

✅ **Zero-Downtime Deployments** - Deploy while users are using app  
✅ **Automatic SSL** - HTTPS by default  
✅ **Global CDN** - Your app served from 30+ locations  
✅ **Serverless Functions** - Your API routes scale automatically  
✅ **Environment Secrets** - All credentials encrypted  
✅ **Analytics** - See how your app performs  
✅ **Preview Deployments** - Test on every PR  

---

## 💰 Pricing

**Free Tier** (includes):
- 100k requests/month
- 100 GB bandwidth/month
- 12 serverless function invocations/second
- Source maps
- Perfect for starting out

**Pro Tier** ($20/month, includes):
- Unlimited requests
- 1 TB bandwidth/month
- More function invocations
- Team support

For your current project, **free tier is enough**.

---

## 🚀 Quick Start Checklist

- [ ] Create Vercel account with GitHub
- [ ] Import your GitHub repo
- [ ] Set root directory to `repairtrace-find/`
- [ ] Add environment variables
- [ ] Deploy and wait 3-5 minutes
- [ ] Visit your new URL
- [ ] Test sign-in and seller features
- [ ] Verify `/sellers`, `/my-shop`, `/admin/verifications` work
- [ ] Check Vercel logs for any errors
- [ ] Optional: Add custom domain
- [ ] Optional: Deploy workshop app to separate Vercel project

---

## 📞 Getting Help

**Vercel Issues:**
- Documentation: https://vercel.com/docs
- Support: vercel.com/support
- Community: https://github.com/vercel/next.js/discussions

**Your App Issues:**
- Check logs: Vercel dashboard
- Test locally: `npm run dev`
- Debug: Add console.log() and redeploy

---

## ✨ Next Steps After Deployment

1. **Share your live link**: Send to users/testers
2. **Monitor**: Watch Vercel analytics for traffic
3. **Iterate**: Push to GitHub, Vercel auto-deploys changes
4. **Scale**: Upgrade to Pro when needed
5. **Customize Domain**: Add your own domain

---

**Status**: Ready to deploy  
**Time to production**: 15 minutes  
**Cost**: Free (with option to upgrade later)

Let me know when you hit a specific step and I'll help troubleshoot!
