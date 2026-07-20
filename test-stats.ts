import axios from 'axios';
(async () => {
    try {
        const res = await axios.get('http://localhost:3000/api/social-stats?force=true');
        console.log(res.data);
    } catch (e: any) {
        console.log("Error:", e.message);
    }
})();
