// Configurazione Firebase e Firestore

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBVDmTWzggC_adtlRRNDpdTmriIxz4R67Q",
  authDomain: "bioquest-fb-e842a.firebaseapp.com",
  projectId: "bioquest-fb-e842a",
  storageBucket: "bioquest-fb-e842a.firebasestorage.app",
  messagingSenderId: "891968255335",
  appId: "1:891968255335:web:0eff22f4dfbe9e946aebc2"
}

const app = initializeApp(firebaseConfig)

const db = getFirestore(app)

export { db }