import jwt from 'jsonwebtoken';

function generateKlingToken() {
    const ak = 'ALAnrRPrhAb9dfmLgKyKBnYBtJmAeDCM';
    const sk = 'YghMPk3NgnY4JrtBJrNbCDkPDPyrdy88';

    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };

    const payload = {
        iss: ak,
        exp: Math.floor(Date.now() / 1000) + 1800,
        nbf: Math.floor(Date.now() / 1000) - 5
    };

    return jwt.sign(payload, sk, { header });
}

async function testKling() {
    const token = generateKlingToken();
    console.log("Token:", token);

    try {
        const res = await fetch('https://api.klingai.com/v1/videos/text2video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model_name: "kling-v1",
                prompt: "A beautiful sunset over the city.",
                duration: "5",
                aspect_ratio: "9:16"
            })
        });
        const data = await res.json();
        console.log("Kling Generation Response:", JSON.stringify(data, null, 2));

        if (data.code === 0 && data.data?.task_id) {
            console.log("Waiting 5 seconds before polling...");
            await new Promise(resolve => setTimeout(resolve, 5000));
            const pollRes = await fetch(`https://api.klingai.com/v1/videos/text2video/${data.data.task_id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const pollData = await pollRes.json();
            console.log("Kling Polling Response:", JSON.stringify(pollData, null, 2));
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

testKling();
