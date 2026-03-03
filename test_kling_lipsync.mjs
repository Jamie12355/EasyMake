import jwt from 'jsonwebtoken';

const ak = 'ALAnrRPrhAb9dfmLgKyKBnYBtJmAeDCM';
const sk = 'YghMPk3NgnY4JrtBJrNbCDkPDPyrdy88';

const token = jwt.sign(
    {
        iss: ak,
        exp: Math.floor(Date.now() / 1000) + 1800,
        nbf: Math.floor(Date.now() / 1000) - 5
    },
    sk,
    { header: { alg: 'HS256', typ: 'JWT' } }
);

async function testLipsync() {
    const modes = [0, 1, 2, 3, "0", "1", "2"];
    for (let mode of modes) {
        const res = await fetch('https://api.klingai.com/v1/videos/lip-sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model_name: "kling-v1",
                input: {
                    mode: mode,
                    video_url: "https://example.com/video.mp4",
                    sound_file: "https://example.com/audio.mp3"
                }
            })
        });
        const json = await res.json();
        console.log(`Mode ${mode}:`, json);
        if (json.code !== 1201 || !json.message.includes('invalid')) {
            console.log("==> PROBABLY VALID MODE:", mode);
            break;
        }
    }
}

testLipsync();
