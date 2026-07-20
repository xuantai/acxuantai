import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

(async () => {
    try {
        const configPath = path.join(process.cwd(), "firebase-applet-config.json");
        const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        
        const firebaseApp = initializeApp(firebaseConfig);
        const dbId = firebaseConfig.firestoreDatabaseId || "ai-studio-c02b7e6b-3a86-4bca-8854-20a8c0a0fc52";
        const db = initializeFirestore(firebaseApp, { experimentalForceLongPolling: true }, dbId);
        
        const docRef = doc(db, "configs", "admin_config");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const config = docSnap.data();
            if (config.socials) {
                config.socials.facebookFollowers = 27736;
                // Leave YouTube alone for now or update it too if we want
                config.socials.youtubeFollowers = 18100;
                await setDoc(docRef, config, { merge: true });
                console.log("Successfully updated Firestore config.");
            }
        }
    } catch(e: any) {
        console.error("Error:", e.message);
    }
    process.exit(0);
})();
