import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDocFromServer,
  writeBatch,
  type Firestore,
  type Unsubscribe
} from 'firebase/firestore';

// Read config safely from generated config
import configData from '../../firebase-applet-config.json';

const firebaseConfig = {
  projectId: configData.projectId,
  appId: configData.appId,
  apiKey: configData.apiKey,
  authDomain: configData.authDomain,
  storageBucket: configData.storageBucket,
  messagingSenderId: configData.messagingSenderId
};

// Initialize Firebase App
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with custom databaseId if provided
const firestoreDbId = configData.firestoreDatabaseId && configData.firestoreDatabaseId !== '(default)'
  ? configData.firestoreDatabaseId
  : undefined;

export const db: Firestore = firestoreDbId
  ? getFirestore(firebaseApp, firestoreDbId)
  : getFirestore(firebaseApp);

export const isFirebaseActive = Boolean(configData.projectId && configData.apiKey);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// Test Firestore connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, '_connection_test', 'ping'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network is disconnected.');
      return false;
    }
    // Any other response (like document not found or rules check) confirms connection was reached
    return true;
  }
}

// Subscribe to a collection for Real-Time Sync
export function subscribeToCollection<T extends { id: string }>(
  collectionName: string,
  onData: (items: T[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, collectionName);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as T);
      });
      onData(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, collectionName);
      if (onError) onError(err);
    }
  );
}

// Single document upsert
export async function saveDocument<T extends Record<string, any>>(
  collectionName: string,
  id: string,
  data: T
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    // Sanitize any undefined values
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${id}`);
  }
}

// Single document delete
export async function deleteDocument(
  collectionName: string,
  id: string
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

// Batch upsert multiple documents
export async function batchSaveDocuments<T extends { id: string }>(
  collectionName: string,
  items: T[]
): Promise<void> {
  if (!items || items.length === 0) return;
  try {
    // Firestore batches are limited to 500 operations
    const CHUNK_SIZE = 400;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((item) => {
        const clean = JSON.parse(JSON.stringify(item));
        const docRef = doc(db, collectionName, item.id);
        batch.set(docRef, clean, { merge: true });
      });
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, collectionName);
  }
}

// Batch delete multiple documents
export async function batchDeleteDocuments(
  collectionName: string,
  ids: string[]
): Promise<void> {
  if (!ids || ids.length === 0) return;
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        const docRef = doc(db, collectionName, id);
        batch.delete(docRef);
      });
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, collectionName);
  }
}

// Check if collection is empty
export async function isCollectionEmpty(collectionName: string): Promise<boolean> {
  try {
    const snap = await getDocs(collection(db, collectionName));
    return snap.empty;
  } catch {
    return true;
  }
}

// Clear all documents in a collection
export async function clearCollection(collectionName: string): Promise<void> {
  try {
    const snap = await getDocs(collection(db, collectionName));
    const ids = snap.docs.map((d) => d.id);
    if (ids.length > 0) {
      await batchDeleteDocuments(collectionName, ids);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, collectionName);
  }
}

