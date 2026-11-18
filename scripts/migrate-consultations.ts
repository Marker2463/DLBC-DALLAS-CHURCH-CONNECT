import dotenv from 'dotenv';
import { initializeApp as initClientApp } from 'firebase/app';
import { getFirestore as getClientFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { getAdminFirestore } from '../src/server/firebaseAdmin';

dotenv.config();

const clientFirebaseConfig = {
  projectId: "dlbc-dallas-church-connect",
  appId: "1:571793135981:web:59ea0ffd2bc3915f5e6264",
  apiKey: "AIzaSyD_qDevRG_VtrBh1anEAWRVWgPLtlG9qhg",
  authDomain: "dlbc-dallas-church-connect.firebaseapp.com",
};

/**
 * Migration Script: One-time migration for consultations created before the leader host control fix.
 *
 * Usage:
 *   npx tsx scripts/migrate-consultations.ts --dry-run
 *   npx tsx scripts/migrate-consultations.ts
 */
async function runMigration() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`[Migration] Running consultation migration (Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE COMMIT'})...`);

  let docsList: { id: string; data: any; ref: any }[] = [];

  // Try Admin SDK first
  try {
    const adminFs = getAdminFirestore();
    const snap = await adminFs.collection('consultations').get();
    docsList = snap.docs.map(d => ({ id: d.id, data: d.data(), ref: d.ref }));
  } catch (adminErr: any) {
    console.warn(`[Migration] Admin SDK connection notice (${adminErr?.message || adminErr}). Falling back to Firebase Web SDK client...`);
    const clientApp = initClientApp(clientFirebaseConfig, 'migration-app');
    const clientFs = getClientFirestore(clientApp, "ai-studio-dlbcchurchconnec-d51b846f-e39f-40ba-8929-2e22d9a82610");
    const snap = await getDocs(collection(clientFs, 'consultations'));
    docsList = snap.docs.map(d => ({ id: d.id, data: d.data(), ref: d.ref }));
  }

  const now = new Date();
  let examinedCount = 0;
  let migratedCount = 0;
  let skippedCount = 0;

  for (const item of docsList) {
    examinedCount++;
    const { id, data, ref } = item;

    const scheduledIso = data.scheduledStart || data.selectedTime;
    const scheduledDate = scheduledIso ? new Date(scheduledIso) : null;
    const isFuture = scheduledDate ? scheduledDate.getTime() > now.getTime() : false;
    const isScheduled = data.status === 'scheduled';

    if (isScheduled && isFuture) {
      console.log(`[Migration] Found future scheduled consultation: ${id} (Leader: ${data.leaderEmail || data.leaderName || 'Unknown'}, Member: ${data.memberName || 'Member'}, Time: ${scheduledIso})`);

      if (isDryRun) {
        console.log(`  [DRY-RUN] Would reset meet links, set status to 'submitted', and queue for pastor confirmation.`);
        migratedCount++;
      } else {
        const timeline = data.journeyTimeline || [];
        timeline.push({
          status: 'Migrated to Leader Host Workflow',
          timestamp: new Date().toISOString(),
          description: 'Consultation migrated to pastoral host control. Assigned leader will confirm appointment to generate host-controlled Google Meet room.',
        });

        const updatePayload = {
          status: 'submitted',
          isLocked: false,
          meetUrl: null,
          googleMeetUrl: null,
          meetingLink: null,
          hostMeetingLink: null,
          calendarEventId: null,
          meetingHostEmail: null,
          meeting: null,
          journeyTimeline: timeline,
          updatedAt: new Date().toISOString(),
        };

        if (typeof ref.update === 'function') {
          await ref.update(updatePayload);
        } else {
          await updateDoc(ref, updatePayload);
        }

        console.log(`  [COMMITTED] Reset consultation ${id} to 'submitted' for pastor confirmation.`);
        migratedCount++;
      }
    } else {
      skippedCount++;
    }
  }

  console.log('\n========================================');
  console.log(`[Migration Summary]`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (no changes made)' : 'LIVE'}`);
  console.log(`Total consultations examined: ${examinedCount}`);
  console.log(`Total consultations migrated: ${migratedCount}`);
  console.log(`Total consultations unchanged: ${skippedCount}`);
  console.log('========================================\n');
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[Migration Error]:', err);
    process.exit(1);
  });
