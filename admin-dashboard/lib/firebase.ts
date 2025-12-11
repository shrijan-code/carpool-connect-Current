import admin from './firebase-admin';

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();

export default admin;
