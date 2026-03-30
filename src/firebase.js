import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
apiKey: "AIzaSyA6C7CzOEJuqWvVPWk2-lPJGHaqDjPGyxk",
authDomain: "bassflow-pro.firebaseapp.com",
projectId: "bassflow-pro",
storageBucket: "bassflow-pro.firebasestorage.app",
messagingSenderId: "735579933666",
appId: "1:735579933666:web:e1c4480d1050a8469607bb"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);