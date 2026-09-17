/**
 * Conexion a Firebase.
 *
 * La configuracion web (apiKey y compania) NO es un secreto: viaja en el
 * bundle de cualquier sitio con Firebase y puede vivir en el repositorio.
 * Lo que realmente protege los datos son las reglas de firestore.rules.
 *
 * NUNCA subir al repositorio un service account JSON.
 */

import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/**
 * Valores del proyecto de Firebase.
 *
 * El proyecto es "ttl-incentives".
 *
 * PENDIENTE: pegar el apiKey, el messagingSenderId y el appId reales. Se copian
 * de: Firebase Console > Configuracion del proyecto > Tus apps > App web > SDK.
 *
 * Verifica tambien authDomain y storageBucket contra lo que muestre la consola:
 * aqui van armados con el patron normal de un proyecto nuevo, pero si el
 * proyecto se creo de otra forma el bucket podria terminar en .appspot.com.
 *
 * No reutilizar el proyecto ttms-59aa5.
 *
 * Tambien se pueden pasar por variables de entorno de Vite (.env.local) si se
 * prefiere no tocar este archivo; las variables ganan sobre los valores de aqui.
 */
const FALLBACK_CONFIG: FirebaseOptions = {
  apiKey: 'AIzaSyAGVI_XgtqOYuTEVcqoERjZ7CqMWWyFBRs',
  authDomain: 'ttl-incentives.firebaseapp.com',
  projectId: 'ttl-incentives',
  storageBucket: 'ttl-incentives.firebasestorage.app',
  messagingSenderId: '775512278680',
  appId: '1:775512278680:web:94264cba38b2dc54edf2ed',
}

const env = import.meta.env

export const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY || FALLBACK_CONFIG.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || FALLBACK_CONFIG.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || FALLBACK_CONFIG.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || FALLBACK_CONFIG.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || FALLBACK_CONFIG.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || FALLBACK_CONFIG.appId,
}

/** true mientras la configuracion siga trayendo los valores de relleno. */
export const firebaseConfigured = !String(firebaseConfig.apiKey).startsWith('REEMPLAZAR')

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

export const googleProvider = new GoogleAuthProvider()
/** Sugiere la cuenta corporativa en el selector de Google. */
googleProvider.setCustomParameters({ hd: 'totaltransportlogistics.us', prompt: 'select_account' })

/** Nombres de las colecciones, en un solo lugar. */
export const COLLECTIONS = {
  brokers: 'brokers',
  members: 'members',
  entries: 'entries',
  comments: 'comments',
} as const
