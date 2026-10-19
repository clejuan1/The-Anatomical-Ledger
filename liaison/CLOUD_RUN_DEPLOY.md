# CLOUD_RUN_DEPLOY.md

Purpose
- Exact, copy/paste commands to build & deploy the liaison server to Cloud Run.
- Stores the generative API key in Secret Manager and injects it into Cloud Run (so the key never appears in source).

Prereqs
- gcloud authenticated and configured (Cloud Shell is recommended).
- You have permissions: Cloud Run Admin, Cloud Build Editor, Secret Manager Admin (or at least Secret Manager Secret Accessor + ability to create secrets), IAM Service Account Admin.
- Replace placeholders (PROJECT_ID, REGION, SERVICE_NAME, SECRET_NAME) with your values.

Set variables
```bash
export PROJECT_ID=your-gcp-project-id
export REGION=us-central1
export SERVICE_NAME=liaison-server
export IMAGE=gcr.io/$PROJECT_ID/$SERVICE_NAME
export SECRET_NAME=GEN_AI_KEY
```

1) Add / rotate secret in Secret Manager
```bash
# create secret (first time)
echo -n "NEW_GEN_AI_KEY_VALUE" | gcloud secrets create $SECRET_NAME --replication-policy="automatic" --data-file=-

# OR add a new version (rotation)
echo -n "NEW_GEN_AI_KEY_VALUE" | gcloud secrets versions add $SECRET_NAME --data-file=-

# verify
gcloud secrets versions list $SECRET_NAME --project=$PROJECT_ID
```

Security note: use Cloud Shell or the Console UI to avoid leaking the key in shell history.

2) Prepare container (recommended: Cloud Build)
- Place Dockerfile and package.json at repo root or liaison/ (examples below).
- Build & push with Cloud Build (no local Docker required):
```bash
gcloud builds submit --tag $IMAGE --project=$PROJECT_ID
```

Dockerfile (example for Node/Express)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "liaison/server.js"]
```

package.json (example)
```json
{
  "name": "liaison-server",
  "version": "0.1.0",
  "main": "liaison/server.js",
  "scripts": {
    "start": "node liaison/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "node-fetch": "^2.6.7",
    "express-rate-limit": "^6.7.0"
  }
}
```

3) Create a dedicated service account (preferred)
```bash
gcloud iam service-accounts create $SERVICE_NAME-sa --project=$PROJECT_ID \
  --display-name="Cloud Run SA for liaison"

# Get the full SA name
SA_EMAIL=$SERVICE_NAME-sa@$PROJECT_ID.iam.gserviceaccount.com
```

4) Grant Secret Manager access to the service account
```bash
gcloud secrets add-iam-policy-binding $SECRET_NAME \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID
```

5) Deploy to Cloud Run and inject the secret (env var)
```bash
# Deploy using the built image
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE \
  --region $REGION \
  --platform=managed \
  --allow-unauthenticated \
  --service-account=$SA_EMAIL \
  --set-secrets=$SECRET_NAME=projects/$PROJECT_ID/secrets/$SECRET_NAME:latest \
  --project=$PROJECT_ID
```

Notes:
- --set-secrets makes the secret available as an env var named $SECRET_NAME in the container.
- If you prefer source deploy (Cloud Build + deploy in one step):
```bash
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --platform=managed \
  --allow-unauthenticated \
  --service-account=$SA_EMAIL \
  --set-secrets=$SECRET_NAME=projects/$PROJECT_ID/secrets/$SECRET_NAME:latest \
  --project=$PROJECT_ID
```

6) (Optional) Restrict access / set auth
```bash
# To require callers to authenticate (recommended for internal services), remove --allow-unauthenticated and add invoker IAM bindings for allowed principals:

gcloud run services add-iam-policy-binding $SERVICE_NAME \
  --member="user:you@example.com" \
  --role="roles/run.invoker" \
  --region=$REGION \
  --project=$PROJECT_ID
```

7) Test health endpoint
```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --platform=managed --format='value(status.url)' --project=$PROJECT_ID)

# Test
curl "$SERVICE_URL/api/health"
```

8) Rotate secret (future)
```bash
# Add a new version
echo -n "ROTATED_KEY" | gcloud secrets versions add $SECRET_NAME --data-file=-

# Cloud Run using :latest will pick up new version automatically (but you can redeploy to be sure)
gcloud run deploy $SERVICE_NAME --image $IMAGE --region $REGION --service-account=$SA_EMAIL --set-secrets=$SECRET_NAME=projects/$PROJECT_ID/secrets/$SECRET_NAME:latest --project=$PROJECT_ID
```

9) Logging & monitoring
- Logs: Cloud Console → Cloud Run → service → Logs, or:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" --project=$PROJECT_ID --limit 50
```

10) Cleanup
```bash
# delete Cloud Run service
gcloud run services delete $SERVICE_NAME --region $REGION --project=$PROJECT_ID

# delete secret (if needed)
gcloud secrets delete $SECRET_NAME --project=$PROJECT_ID
```

Best practices summary
- Never commit secrets to repo.
- Use dedicated SA with least privilege and secret accessor role.
- Use Secret Manager and configure Cloud Run to mount secrets as env vars.
- Add rate limiting, input validation and authentication to /api/liaison.
- Add alerts/budgets for Cloud usage to detect anomalies if a key leaks.

Example full quick-flow (one-shot)
```bash
export PROJECT_ID=my-project
export REGION=us-central1
export SERVICE_NAME=liaison-server
export IMAGE=gcr.io/$PROJECT_ID/$SERVICE_NAME
export SECRET_NAME=GEN_AI_KEY

echo -n "NEW_KEY_VALUE" | gcloud secrets create $SECRET_NAME --replication-policy="automatic" --data-file=- --project=$PROJECT_ID
gcloud builds submit --tag $IMAGE --project=$PROJECT_ID
gcloud iam service-accounts create $SERVICE_NAME-sa --project=$PROJECT_ID
SA_EMAIL=$SERVICE_NAME-sa@$PROJECT_ID.iam.gserviceaccount.com
gcloud secrets add-iam-policy-binding $SECRET_NAME --member="serviceAccount:$SA_EMAIL" --role="roles/secretmanager.secretAccessor" --project=$PROJECT_ID
gcloud run deploy $SERVICE_NAME --image $IMAGE --region $REGION --platform=managed --allow-unauthenticated --service-account=$SA_EMAIL --set-secrets=$SECRET_NAME=projects/$PROJECT_ID/secrets/$SECRET_NAME:latest --project=$PROJECT_ID
```

---

If you want me to add a tiny GitHub Actions workflow to the branch that builds and deploys to Cloud Run (using a GitHub secret with GCP service account JSON), I can add a template — tell me and I will prepare it on fix/liaison.
