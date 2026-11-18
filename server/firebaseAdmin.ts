import { initializeApp, applicationDefault, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const adminApp =
  getApps().find((app) => app.name === '[DEFAULT]') ??
  (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
    ? initializeApp({
        credential: cert({
          projectId: process.env.GOOGLE_CLOUD_PROJECT || 'dlbc-dallas-church-connect',
          clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          privateKey: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      })
    : initializeApp({
        credential: applicationDefault(),
      }));

export const adminAuth = getAuth(adminApp);

export const adminDb = getFirestore(
  adminApp,
  process.env.FIRESTORE_DATABASE_ID || 'ai-studio-dlbcchurchconnec-d51b846f-e39f-40ba-8929-2e22d9a82610'
);
