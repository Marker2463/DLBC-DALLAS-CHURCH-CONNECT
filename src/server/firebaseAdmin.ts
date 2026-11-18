import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = 'dlbc-dallas-church-connect';
const DATABASE_ID = 'ai-studio-dlbcchurchconnec-d51b846f-e39f-40ba-8929-2e22d9a82610';

export function getAdminFirestore() {
  if (!getApps().length) {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId: PROJECT_ID,
          clientEmail,
          privateKey,
        }),
        projectId: PROJECT_ID,
      });
    } else {
      initializeApp({ projectId: PROJECT_ID });
    }
  }
  const app = getApps()[0];
  return getFirestore(app, DATABASE_ID);
}

export function getAdminAuth() {
  getAdminFirestore();
  return getAuth(getApps()[0]);
}
