# Authentication

The template uses [Better Auth](https://www.better-auth.com/) with the Drizzle adapter. Email/password is enabled by default with the following constraints:

- Min password length: 8
- Max password length: 128

User model includes `organizationId` (optional) and `role` (default `member`) as additional fields.

## OAuth Providers (optional)

OAuth login with Google and GitHub is supported but disabled by default. You can enable one or both providers independently. If no env vars are set, the OAuth buttons won't appear in the login/register modals.

### Google

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or select an existing one)
3. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**
4. Select **Web application**
5. Add `http://localhost:3001/api/auth/callback/google` to **Authorized redirect URIs** (replace with your production URL when deploying)
6. Copy the **Client ID** and **Client Secret**

### GitHub

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Set **Homepage URL** to `http://localhost:5173`
4. Set **Authorization callback URL** to `http://localhost:3001/api/auth/callback/github`
5. Copy the **Client ID** and generate a **Client Secret**

### Environment variables

Add to `apps/server/.env`:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

Add to `apps/web/.env`:

```env
VITE_OAUTH_GOOGLE=true
VITE_OAUTH_GITHUB=true
```

## Protected Routes

The frontend uses TanStack Router layout routes for protection. `_authenticated.tsx` checks the session in `beforeLoad` and passes it via route context — child routes access it with `Route.useRouteContext()` without redundant auth checks.
